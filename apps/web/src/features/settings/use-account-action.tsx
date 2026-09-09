import { useReverification } from "@clerk/react";
import { isReverificationCancelledError } from "@clerk/react/errors";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { DialogFrame } from "../../components/ui/dialog-frame";
import { accountError } from "./account-errors";
import { ReverificationDialog, type ReverificationRequest } from "./reverification-dialog";

type Action = {
  run: () => Promise<unknown>;
  confirmation?: string;
  success?: string;
  tone?: "success" | "info";
  silent?: boolean;
};
export function useAccountAction() {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const [confirmation, setConfirmation] = useState<Action | null>(null);
  const [verification, setVerification] = useState<ReverificationRequest | null>(null);
  const pendingVerification = useRef<ReverificationRequest | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingVerification.current?.cancel();
      pendingVerification.current = null;
    };
  }, []);
  const verified = useReverification((run: Action["run"]) => run(), {
    onNeedsReverification: (request) => {
      if (!mounted.current) {
        request.cancel();
        return;
      }
      const wrapped: ReverificationRequest = {
        ...request,
        cancel: () => {
          pendingVerification.current = null;
          setVerification(null);
          request.cancel();
        },
        complete: () => {
          pendingVerification.current = null;
          setVerification(null);
          request.complete();
        },
      };
      pendingVerification.current = wrapped;
      setVerification(wrapped);
    },
  });
  async function execute(action: Action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setConfirmation(null);
    try {
      await verified(action.run);
      if (mounted.current && !action.silent)
        toast[action.tone ?? "success"](action.success ?? "Perubahan akun berhasil.");
    } catch (error) {
      if (mounted.current) {
        if (isReverificationCancelledError(error)) toast.info(accountError(error));
        else toast.error(accountError(error));
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function run(action: Action) {
    if (lock.current) return;
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (action.confirmation) setConfirmation(action);
    else void execute(action);
  }
  const feedback = (
    <>
      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          Memproses aksi akun…
        </p>
      )}
      <DialogFrame
        open={!!confirmation}
        title="Konfirmasi perubahan akun"
        description={confirmation?.confirmation ?? ""}
        onClose={() => setConfirmation(null)}
        returnFocus={() => trigger.current?.focus()}
      >
        <div className="flex gap-3">
          <Button
            type="button"
            onClick={() => {
              if (confirmation) void execute(confirmation);
            }}
          >
            Lanjutkan
          </Button>
          <Button type="button" variant="outline" onClick={() => setConfirmation(null)}>
            Batal
          </Button>
        </div>
      </DialogFrame>
      {verification && (
        <ReverificationDialog request={verification} returnFocus={() => trigger.current?.focus()} />
      )}
    </>
  );
  return { run, busy, feedback };
}
