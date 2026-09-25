import type { ChatInteraction, RespondChatInteraction } from "@ngertiin/contracts/api";
import { useState } from "react";
import { ChatPracticeApproval } from "./chat-practice-approval";
import { ChatQuestionForm } from "./chat-question-form";

type ChatInteractionCardProps = {
  interaction: ChatInteraction;
  onRespond: (decision: RespondChatInteraction) => Promise<void>;
};

export function ChatInteractionCard({ interaction, onRespond }: ChatInteractionCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (decision: RespondChatInteraction) => {
    setBusy(true);
    setError(null);
    try {
      await onRespond(decision);
    } catch {
      setError("Keputusan belum tersimpan. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };
  const statusLabel = {
    pending: "Perlu persetujuan",
    approved: "Disetujui",
    answered: "Dijawab",
    revising: "Revisi diminta",
    rejected: "Dibatalkan",
    cancelled: "Dibatalkan",
  }[interaction.status];
  return (
    <section
      className="mt-4 w-full min-w-0 max-w-xl overflow-hidden rounded-2xl border border-border bg-card text-sm text-card-foreground"
      aria-label={interaction.kind === "ask_user" ? "Pertanyaan latihan" : "Usulan latihan"}
      aria-busy={busy}
    >
      {interaction.kind === "ask_user" ? (
        <ChatQuestionForm
          interaction={interaction}
          busy={busy}
          statusLabel={statusLabel}
          submit={submit}
        />
      ) : (
        <ChatPracticeApproval
          interaction={interaction}
          busy={busy}
          statusLabel={statusLabel}
          submit={submit}
          setError={setError}
        />
      )}
      {error ? (
        <p role="alert" className="border-t border-border px-5 py-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
