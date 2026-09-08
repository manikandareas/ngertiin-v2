import { ArrowLeft01Icon, ArrowRight01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode, useState } from "react";
import { Button } from "../../components/ui/button";
import { UsageNotice } from "../usage/usage-notice";
import { useUsage } from "../usage/use-usage";
import { BuilderFocus } from "./builder-focus";
import { BuilderLayout } from "./builder-layout";
import { BuilderReview } from "./builder-review";
import { MaterialBoard, type MaterialLibrary } from "./material-board";
import type { ModuleBuilderState } from "./use-module-builder";

export function BuilderForm({
  state,
  library,
  statuses,
}: {
  state: ModuleBuilderState;
  library: MaterialLibrary;
  statuses: ReactNode;
}) {
  const usage = useUsage();
  const quotaBlocked =
    !usage.data || usage.data.modules.remaining === 0 || !!usage.data.activeModuleId;
  const [step, setStep] = useState(0);
  const [validation, setValidation] = useState<string | null>(null);
  function go(next: number) {
    setValidation(null);
    setStep(next);
  }
  function advance() {
    if (step === 0) {
      if (!state.selected.length) {
        setValidation("Tambahkan minimal satu materi untuk melanjutkan.");
        return;
      }
      if (state.text.trim() || state.url.trim() || state.file) {
        setValidation(
          "Tambahkan materi yang masih diisi ke daftar, atau kosongkan inputnya sebelum lanjut.",
        );
        return;
      }
    }
    if (step === 1 && !state.generationSettings.activityTypes.length) {
      setValidation("Pilih minimal satu jenis aktivitas.");
      return;
    }
    if (step === 1 && Array.from(state.instruction.trim()).length > 4000) {
      setValidation("Fokus belajar maksimal 4.000 karakter.");
      return;
    }
    go(step + 1);
  }
  return (
    <BuilderLayout
      step={step}
      onStep={state.busy ? undefined : go}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-4">
          {step > 0 ? (
            <Button variant="ghost" disabled={state.busy} onClick={() => go(step - 1)}>
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                size={16}
                strokeWidth={1.5}
                aria-hidden="true"
              />
              Kembali
            </Button>
          ) : null}
          {step === 2 ? (
            <div className="order-first w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
              <UsageNotice category="modules" />
            </div>
          ) : null}
          <Button
            className="ml-auto"
            disabled={state.busy || (step === 2 && (!!state.blocked || quotaBlocked))}
            onClick={() => (step === 2 ? void state.submit() : advance())}
          >
            {state.busy ? "Menyiapkan…" : step === 2 ? "Buat modul" : "Lanjut"}
            {step === 2 ? (
              <HugeiconsIcon icon={SparklesIcon} size={16} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={16}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            )}
          </Button>
        </div>
      }
    >
      <fieldset disabled={state.busy} className="min-w-0 space-y-8">
        {step === 0 ? (
          <MaterialBoard state={state} library={library} />
        ) : step === 1 ? (
          <BuilderFocus state={state} />
        ) : (
          <BuilderReview state={state} onEdit={go} />
        )}
        {statuses}
      </fieldset>
      {validation || state.error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {validation || state.error}
        </p>
      ) : null}
    </BuilderLayout>
  );
}
