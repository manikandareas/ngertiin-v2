import { practiceConfigurationSchema } from "@ngertiin/contracts/api";
import { Check, ChevronDown, Clock3, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import { useModules } from "../../modules/api/use-modules";
import type { InteractionFormProps } from "./chat-interaction-types";
import { ChatPracticeSettings } from "./chat-practice-settings";

const actionClass =
  "h-9 rounded-full border px-3 text-sm font-semibold normal-case tracking-normal shadow-none active:translate-y-0";

export function ChatPracticeApproval({
  interaction,
  busy,
  statusLabel,
  submit,
  setError,
}: InteractionFormProps & { setError: (message: string) => void }) {
  const [config, setConfig] = useState(interaction.practice);
  const [editing, setEditing] = useState(false);
  const [revision, setRevision] = useState("");
  const modules = useModules({ status: "ready" });
  const available = modules.data?.pages.flatMap((page) => page.data) ?? [];
  const pending = interaction.status === "pending";
  const moduleName = (moduleId: string) =>
    available.find((module) => module.id === moduleId)?.title ?? moduleId;
  if (!config) return null;
  return (
    <>
      <div className="px-5 pb-5 pt-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium">
          <span className="rounded-md bg-accent px-2 py-1 text-accent-foreground">
            {config.kind === "flashcard" ? "Flashcard" : config.kind === "quiz" ? "Kuis" : "Exam"}
          </span>
          <span className="mr-auto text-muted-foreground">Usulan latihan</span>
          {pending && (
            <Button
              size="icon"
              variant="ghost"
              className="size-8 rounded-full text-muted-foreground"
              aria-label="Batalkan usulan latihan"
              disabled={busy}
              onClick={() => void submit({ decision: "reject", responseId: crypto.randomUUID() })}
            >
              <X aria-hidden="true" />
            </Button>
          )}
        </div>
        <h3 className="break-words text-base font-semibold leading-6">{config.title}</h3>
        <p className="mt-2 break-words leading-6 text-muted-foreground">{config.focus}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>
            {config.itemCount} {config.kind === "flashcard" ? "kartu" : "soal"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {
              { beginner: "Pemula", intermediate: "Menengah", advanced: "Lanjutan" }[
                config.difficulty
              ]
            }
          </span>
          <span aria-hidden="true">·</span>
          <span>{config.language === "id" ? "Bahasa Indonesia" : "English"}</span>
          {config.durationMinutes ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{config.durationMinutes} menit</span>
            </>
          ) : null}
        </div>
        <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-border pt-4 text-xs leading-5">
          <dt className="text-muted-foreground">Simpan ke</dt>
          <dd className="break-words font-medium">{moduleName(config.destinationModuleId)}</dd>
          <dt className="text-muted-foreground">Sumber</dt>
          <dd className="break-words">
            {config.sources
              .map((source) =>
                source.kind === "module" ? moduleName(source.moduleId) : "Lampiran chat",
              )
              .join(", ")}
          </dd>
          {config.composition && (
            <>
              <dt className="text-muted-foreground">Komposisi</dt>
              <dd>
                {config.composition.multipleChoice} pilihan ganda · {config.composition.trueFalse}{" "}
                benar/salah · {config.composition.shortAnswer} esai singkat
              </dd>
            </>
          )}
        </dl>
      </div>
      {pending && editing ? (
        <ChatPracticeSettings
          config={config}
          setConfig={setConfig}
          busy={busy}
          revision={revision}
          setRevision={setRevision}
          modules={modules}
          submit={submit}
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3">
        <span
          className={cn(
            "flex items-center gap-2 text-xs",
            interaction.status === "approved" ? "text-success-foreground" : "text-muted-foreground",
          )}
        >
          {interaction.status === "approved" ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Clock3 className="size-3.5" aria-hidden="true" />
          )}
          {statusLabel}
        </span>
        {pending && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className={actionClass}
              disabled={busy}
              aria-expanded={editing}
              onClick={() => setEditing((value) => !value)}
            >
              <SlidersHorizontal aria-hidden="true" />
              Pengaturan
              <ChevronDown
                className={cn("motion-safe:transition-transform", editing && "rotate-180")}
                aria-hidden="true"
              />
            </Button>
            <Button
              size="sm"
              className={actionClass}
              disabled={busy}
              onClick={() => {
                const parsed = practiceConfigurationSchema.safeParse(config);
                if (!parsed.success) {
                  setError(parsed.error.issues[0]?.message ?? "Pengaturan belum valid.");
                  return;
                }
                void submit({
                  decision: "approve",
                  responseId: crypto.randomUUID(),
                  practice: parsed.data,
                });
              }}
            >
              <Check aria-hidden="true" />
              {busy ? "Menyimpan…" : "Buat latihan"}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
