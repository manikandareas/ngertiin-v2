import type { ChatInteraction, RespondChatInteraction } from "@ngertiin/contracts/api";
import { useRef, useState } from "react";
import { ChatPracticeApproval } from "./chat-practice-approval";
import { ChatQuestionForm } from "./chat-question-form";

type ChatInteractionCardProps = {
  interaction: ChatInteraction;
  onRespond: (decision: RespondChatInteraction) => Promise<void>;
};

export function ChatInteractionCard({ interaction, onRespond }: ChatInteractionCardProps) {
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (decision: RespondChatInteraction) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await onRespond(decision);
    } catch {
      setError("Keputusan belum tersimpan. Coba lagi.");
    } finally {
      submitting.current = false;
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
      className="min-w-0"
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
