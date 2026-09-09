import { useUser } from "@clerk/react";
import { useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Field, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { SettingsRow } from "./settings-row";
import { useAccountAction } from "./use-account-action";

export function EmailSettings() {
  const { user } = useUser();
  const action = useAccountAction();
  const [email, setEmail] = useState("");
  const [verifying, setVerifying] = useState<string | null>(null);
  const [code, setCode] = useState("");
  return (
    <SettingsRow
      title="Alamat email"
      description="Kelola alamat email dan status verifikasinya. Email utama dipakai sebagai kontak akun."
    >
      {user?.emailAddresses.map((address) => (
        <div key={address.id} className="space-y-3 rounded-xl border p-4">
          <p className="break-all text-sm font-semibold">{address.emailAddress}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant={address.verification.status === "verified" ? "secondary" : "outline"}>
              {address.verification.status === "verified" ? "Terverifikasi" : "Belum terverifikasi"}
            </Badge>
            {address.id === user.primaryEmailAddressId && <Badge>Utama</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            {address.verification.status !== "verified" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={action.busy}
                onClick={() =>
                  action.run({
                    run: async () => {
                      await address.prepareVerification({ strategy: "email_code" });
                      setVerifying(address.id);
                      setCode("");
                    },
                    success: "Kode verifikasi sudah dikirim.",
                    tone: "info",
                  })
                }
              >
                {verifying === address.id ? "Kirim ulang kode" : "Verifikasi email"}
              </Button>
            )}
            {address.id !== user.primaryEmailAddressId && (
              <>
                {address.verification.status === "verified" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={action.busy}
                    onClick={() =>
                      action.run({
                        confirmation: `Jadikan ${address.emailAddress} sebagai email utama?`,
                        run: async () => {
                          await user.update({ primaryEmailAddressId: address.id });
                          await user.reload();
                        },
                      })
                    }
                  >
                    Jadikan utama
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={action.busy}
                  onClick={() =>
                    action.run({
                      confirmation: `Hapus ${address.emailAddress} dari akun?`,
                      run: async () => {
                        await address.destroy();
                        if (verifying === address.id) setVerifying(null);
                        await user.reload();
                      },
                    })
                  }
                >
                  Hapus email
                </Button>
              </>
            )}
          </div>
          {verifying === address.id && address.verification.status !== "verified" && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                action.run({
                  run: async () => {
                    const result = await address.attemptVerification({ code });
                    if (result.verification.status !== "verified")
                      throw new Error("Verification incomplete");
                    setVerifying(null);
                    setCode("");
                    await user.reload();
                  },
                  success: "Email berhasil diverifikasi.",
                });
              }}
            >
              <Field>
                <FieldLabel htmlFor={`email-code-${address.id}`}>Kode verifikasi email</FieldLabel>
                <Input
                  id={`email-code-${address.id}`}
                  autoComplete="one-time-code"
                  value={code}
                  required
                  disabled={action.busy}
                  onChange={(event) => setCode(event.target.value)}
                />
              </Field>
              <Button type="submit" size="sm" disabled={action.busy || !code.trim()}>
                Konfirmasi kode
              </Button>
            </form>
          )}
        </div>
      ))}
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          action.run({
            run: async () => {
              if (!user) return;
              await user.createEmailAddress({ email: email.trim() });
              setEmail("");
              await user.reload();
            },
            success: "Email ditambahkan. Verifikasi alamat tersebut untuk melanjutkan.",
          });
        }}
      >
        <Field>
          <FieldLabel htmlFor="new-email">Tambah alamat email</FieldLabel>
          <Input
            id="new-email"
            type="email"
            autoComplete="email"
            value={email}
            required
            disabled={action.busy}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Button type="submit" variant="outline" disabled={action.busy || !email.trim()}>
          Tambah email
        </Button>
      </form>
      {action.feedback}
    </SettingsRow>
  );
}
