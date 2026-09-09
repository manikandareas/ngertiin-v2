import { useClerk, useSession, useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { SettingsRow } from "./settings-row";
import { useAccountAction } from "./use-account-action";

export function SessionSettings({ unsavedChanges = false }: { unsavedChanges?: boolean }) {
  const { user } = useUser();
  const { session } = useSession();
  const { signOut } = useClerk();
  const action = useAccountAction();
  const sessions = useQuery({
    queryKey: ["account-sessions", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Session unavailable");
      return user.getSessions();
    },
    enabled: !!user,
    refetchOnWindowFocus: "always",
  });
  return (
    <SettingsRow
      title="Perangkat dan sesi"
      description="Lihat perangkat yang masih masuk. Kamu bisa keluar dari perangkat yang tidak lagi dipakai."
    >
      {sessions.isPending && (
        <p role="status" className="text-sm">
          Memuat sesi perangkat…
        </p>
      )}
      {sessions.isError && (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">
            Sesi perangkat belum dapat dimuat.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={sessions.isFetching}
            onClick={() => void sessions.refetch()}
          >
            Coba lagi
          </Button>
        </div>
      )}
      {sessions.data
        ?.filter((item) => item.status === "active")
        .map((item) => {
          const current = item.id === session?.id;
          const activity = item.latestActivity;
          return (
            <div key={item.id} className="space-y-3 rounded-xl border p-4">
              <p className="text-sm font-semibold">
                {activity?.browserName || "Browser"} · {activity?.deviceType || "Perangkat"}
              </p>
              <p className="text-sm text-muted-foreground">
                {[activity?.city, activity?.country].filter(Boolean).join(", ") ||
                  "Lokasi tidak tersedia"}
              </p>
              {current && <Badge variant="secondary">Perangkat ini</Badge>}
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={action.busy}
                  onClick={() =>
                    action.run({
                      confirmation: current
                        ? `${unsavedChanges ? "Perubahan form belum disimpan dan akan hilang. " : ""}Keluar dari akun? Kamu perlu masuk kembali untuk melanjutkan belajar.`
                        : "Keluar dari perangkat ini? Sesi perangkat tersebut akan dicabut.",
                      run: async () => {
                        if (current) await signOut({ redirectUrl: "/sign-in" });
                        else {
                          await item.revoke();
                          await sessions.refetch();
                        }
                      },
                      success: "Sesi perangkat telah dicabut.",
                    })
                  }
                >
                  {current ? "Keluar dari akun" : "Keluar dari perangkat"}
                </Button>
              </div>
            </div>
          );
        })}
      {action.feedback}
    </SettingsRow>
  );
}
