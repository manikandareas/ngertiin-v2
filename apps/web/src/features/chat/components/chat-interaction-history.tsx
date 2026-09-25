import type { ChatInteraction } from "@ngertiin/contracts/api";
import { ChevronDown, MessageCircle } from "lucide-react";
import { ToolResultViewport } from "./chat-tool-result-viewport";

export function InteractionHistory({ interaction }: { interaction: ChatInteraction }) {
  const status = {
    pending: "Menunggu jawaban",
    answered: "Dijawab",
    approved: "Disetujui",
    revising: "Revisi diminta",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
  }[interaction.status];
  const title = interaction.kind === "ask_user" ? "Pertanyaan untukmu" : "Persetujuan latihan";
  return (
    <details className="group/tool">
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-md py-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <MessageCircle aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="text-xs">{status}</span>
        <ChevronDown aria-hidden className="group-open/tool:rotate-180 size-3.5 shrink-0" />
      </summary>
      <ToolResultViewport>
        <dl className="space-y-3">
          {interaction.kind === "ask_user" ? (
            interaction.questions?.map((question) => {
              const value = interaction.answers?.[question.id];
              const values = Array.isArray(value) ? value : value ? [value] : [];
              const answer = values
                .map(
                  (value) =>
                    question.options?.find((option) => option.value === value)?.label ?? value,
                )
                .join(", ");
              return (
                <div
                  key={question.id}
                  className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2 gap-y-1"
                >
                  <dt className="font-semibold">Q</dt>
                  <dd className="whitespace-pre-wrap break-words text-foreground">
                    {question.label}
                  </dd>
                  <dt className="font-semibold">A</dt>
                  <dd className="whitespace-pre-wrap break-words">
                    {answer ||
                      (interaction.status === "answered"
                        ? interaction.answers
                          ? "Tidak diisi"
                          : "Jawaban tidak tersedia pada riwayat ini."
                        : status)}
                  </dd>
                </div>
              );
            })
          ) : (
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
              <dt>Usulan</dt>
              <dd className="break-words text-foreground">
                {interaction.practice?.title ?? "Latihan"}
              </dd>
              {interaction.practice ? (
                <>
                  <dt>Isi</dt>
                  <dd className="break-words">
                    {interaction.practice.itemCount}{" "}
                    {interaction.practice.kind === "flashcard" ? "kartu" : "soal"} ·{" "}
                    {interaction.practice.focus}
                  </dd>
                </>
              ) : null}
              <dt>Keputusan</dt>
              <dd className="whitespace-pre-wrap break-words">
                {interaction.instruction ?? status}
              </dd>
            </div>
          )}
        </dl>
      </ToolResultViewport>
    </details>
  );
}
