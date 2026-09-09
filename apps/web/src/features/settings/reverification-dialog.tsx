import { useSession } from "@clerk/react";
import type { SessionVerificationResource } from "@clerk/react/types";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { DialogFrame } from "../../components/ui/dialog-frame";
import { Field, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { accountError } from "./account-errors";

export type ReverificationRequest = {
  level: "first_factor" | "second_factor" | "multi_factor" | undefined;
  complete: () => void;
  cancel: () => void;
};
type Factor =
  | NonNullable<SessionVerificationResource["supportedFirstFactors"]>[number]
  | NonNullable<SessionVerificationResource["supportedSecondFactors"]>[number];
const supported = ["email_code", "phone_code", "password", "totp", "backup_code"];
const labels: Record<string, string> = {
  email_code: "Kode email",
  phone_code: "Kode SMS",
  password: "Kata sandi",
  totp: "Kode autentikator",
  backup_code: "Kode cadangan",
};
function factorKey(factor: Factor): string {
  if ("emailAddressId" in factor) return `${factor.strategy}:${factor.emailAddressId}`;
  if ("phoneNumberId" in factor) return `${factor.strategy}:${factor.phoneNumberId}`;
  return `${factor.strategy}:`;
}

export function ReverificationDialog({
  request,
  returnFocus,
}: {
  request: ReverificationRequest;
  returnFocus: () => void;
}) {
  const { session } = useSession();
  const [verification, setVerification] = useState<SessionVerificationResource | null>(null);
  const [selected, setSelected] = useState("");
  const [prepared, setPrepared] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initial = useRef<Promise<SessionVerificationResource> | null>(null);
  useEffect(() => {
    let active = true;
    if (!session) {
      setBusy(false);
      setError("Sesi tidak tersedia. Masuk kembali lalu coba lagi.");
      return;
    }
    initial.current ??= session.startVerification({ level: request.level ?? "first_factor" });
    void initial.current
      .then((result) => {
        if (active) {
          if (result.status === "complete") request.complete();
          else setVerification(result);
        }
      })
      .catch((error) => {
        if (active) setError(accountError(error));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [session, request]);
  const second = verification?.status === "needs_second_factor";
  const factors =
    (second ? verification?.supportedSecondFactors : verification?.supportedFirstFactors)?.filter(
      (factor) => supported.includes(factor.strategy),
    ) ?? [];
  const factor = factors.find((candidate) => factorKey(candidate) === selected) ?? factors[0];
  const needsCode = factor?.strategy === "email_code" || factor?.strategy === "phone_code";
  async function prepare() {
    if (!session || !factor) return;
    setBusy(true);
    setError(null);
    try {
      if (factor.strategy === "phone_code") {
        if (second)
          await session.prepareSecondFactorVerification({
            strategy: "phone_code",
            phoneNumberId: factor.phoneNumberId,
          });
        else
          await session.prepareFirstFactorVerification({
            strategy: "phone_code",
            phoneNumberId: factor.phoneNumberId,
          });
      } else if (factor.strategy === "email_code" && !second)
        await session.prepareFirstFactorVerification({
          strategy: "email_code",
          emailAddressId: factor.emailAddressId,
        });
      setPrepared(true);
    } catch (error) {
      setError(accountError(error));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!session || !factor) return;
    setBusy(true);
    setError(null);
    try {
      let result: SessionVerificationResource;
      if (
        second &&
        (factor.strategy === "phone_code" ||
          factor.strategy === "totp" ||
          factor.strategy === "backup_code")
      )
        result = await session.attemptSecondFactorVerification({ strategy: factor.strategy, code });
      else if (!second && factor.strategy === "password")
        result = await session.attemptFirstFactorVerification({
          strategy: "password",
          password: code,
        });
      else if (!second && (factor.strategy === "email_code" || factor.strategy === "phone_code"))
        result = await session.attemptFirstFactorVerification({ strategy: factor.strategy, code });
      else throw new Error("Unsupported factor");
      setCode("");
      setPrepared(false);
      setSelected("");
      if (result.status === "complete") request.complete();
      else setVerification(result);
    } catch (error) {
      setError(accountError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <DialogFrame
      open
      title="Verifikasi ulang akun"
      description="Konfirmasikan identitasmu sebelum melanjutkan perubahan akun."
      onClose={request.cancel}
      returnFocus={returnFocus}
      busy={busy}
    >
      {busy && !verification && <p role="status">Memeriksa metode verifikasi…</p>}
      {verification && !factors.length && (
        <p role="alert" className="text-sm leading-6">
          Akun ini belum memiliki metode verifikasi ulang yang didukung. Google dan GitHub tidak
          dapat dipakai untuk langkah ini. Aksi dihentikan; profil belajar, tema, dan preferensi
          tetap bisa digunakan.
        </p>
      )}
      {factor && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field>
            <FieldLabel htmlFor="verification-factor">Metode verifikasi</FieldLabel>
            <Select
              value={factorKey(factor)}
              disabled={busy}
              onValueChange={(value) => {
                setSelected(value);
                setPrepared(false);
                setCode("");
                setError(null);
              }}
            >
              <SelectTrigger id="verification-factor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {factors.map((item) => (
                  <SelectItem key={factorKey(item)} value={factorKey(item)}>
                    {labels[item.strategy]}
                    {"safeIdentifier" in item ? ` · ${item.safeIdentifier}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {needsCode && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void prepare()}>
              {prepared ? "Kirim ulang kode" : "Kirim kode"}
            </Button>
          )}
          {(!needsCode || prepared) && (
            <>
              <Field>
                <FieldLabel htmlFor="reverification-code">
                  {factor.strategy === "password" ? "Kata sandi" : "Kode verifikasi"}
                </FieldLabel>
                <Input
                  id="reverification-code"
                  type={factor.strategy === "password" ? "password" : "text"}
                  autoComplete={
                    factor.strategy === "password" ? "current-password" : "one-time-code"
                  }
                  required
                  value={code}
                  disabled={busy}
                  onChange={(event) => setCode(event.target.value)}
                />
              </Field>
              <Button type="submit" disabled={busy || !code.trim()}>
                {busy ? "Memverifikasi…" : "Verifikasi"}
              </Button>
            </>
          )}
        </form>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="button"
        className="mt-4"
        variant="ghost"
        disabled={busy}
        onClick={request.cancel}
      >
        Batalkan aksi
      </Button>
    </DialogFrame>
  );
}
