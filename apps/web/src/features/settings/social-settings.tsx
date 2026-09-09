import { useUser } from "@clerk/react";
import type { UserResource } from "@clerk/react/types";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { SettingsRow } from "./settings-row";
import { useAccountAction } from "./use-account-action";

const providers = [
  { id: "google", label: "Google", icon: "/icons/google.svg" },
  { id: "github", label: "GitHub", icon: "/icons/github.svg" },
] as const;
function getLoginConnections(user: UserResource) {
  return user.externalAccounts.filter(
    (account) =>
      providers.some((provider) => provider.id === account.provider) &&
      account.verification?.status === "verified",
  );
}

export function SocialSettings() {
  const { user } = useUser();
  const action = useAccountAction();
  const usable = user ? getLoginConnections(user) : [];
  return (
    <SettingsRow
      title="Akun terhubung"
      description="Masuk ke Ngerti.in dengan Google atau GitHub. Pertahankan setidaknya satu koneksi aktif."
    >
      {providers.map((provider) => {
        const accounts =
          user?.externalAccounts.filter((account) => account.provider === provider.id) ?? [];
        return (
          <div key={provider.id} className="space-y-3 rounded-xl border p-4">
            <p className="flex items-center gap-2 font-semibold">
              <img src={provider.icon} className="size-5 shrink-0" width={20} height={20} alt="" />
              {provider.label}
            </p>
            {accounts.map((account) => {
              const last = usable.length <= 1 && usable.some((item) => item.id === account.id);
              return (
                <div key={account.id} className="space-y-2">
                  <p className="break-all text-sm text-muted-foreground">
                    {account.emailAddress || account.username || provider.label} ·{" "}
                    {account.verification?.status === "verified" ? "Terhubung" : "Belum selesai"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={action.busy || last}
                    onClick={() =>
                      action.run({
                        confirmation: `Putuskan koneksi ${provider.label}? Kamu tidak bisa masuk melalui koneksi ini lagi.`,
                        run: async () => {
                          if (!user) return;
                          await user.reload();
                          const current = getLoginConnections(user);
                          if (current.some((item) => item.id === account.id) && current.length <= 1)
                            throw new Error("Last login connection");
                          await account.destroy();
                          await user.reload();
                        },
                      })
                    }
                  >
                    Putuskan
                  </Button>
                  {last && (
                    <p className="text-xs text-muted-foreground">
                      Hubungkan metode masuk lain sebelum memutus koneksi ini.
                    </p>
                  )}
                </div>
              );
            })}
            {!accounts.some((account) => account.verification?.status === "verified") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={action.busy}
                onClick={() =>
                  action.run({
                    silent: true,
                    run: async () => {
                      if (!user) return;
                      const redirectUrl = new URL(
                        `/settings/account-callback?provider=${provider.id}`,
                        window.location.origin,
                      ).href;
                      const existing = accounts[0];
                      const account = existing
                        ? await existing.reauthorize({ redirectUrl })
                        : await user.createExternalAccount({
                            strategy: provider.id === "google" ? "oauth_google" : "oauth_github",
                            redirectUrl,
                          });
                      const url = account.verification?.externalVerificationRedirectURL;
                      if (url) window.location.assign(url.toString());
                      else {
                        await user.reload();
                        if (account.verification?.status !== "verified")
                          throw new Error("Connection incomplete");
                        toast.success("Koneksi akun berhasil diperbarui.");
                      }
                    },
                  })
                }
              >
                Hubungkan {provider.label}
              </Button>
            )}
          </div>
        );
      })}
      {action.feedback}
    </SettingsRow>
  );
}
