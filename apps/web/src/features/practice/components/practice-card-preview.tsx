import type { PracticeSummary } from "@ngertiin/contracts/api";
import { CircleAlert, LoaderCircle } from "lucide-react";

export function PracticeCardPreview({ practice }: { practice: PracticeSummary }) {
  if (practice.status !== "ready") {
    const generating = practice.status === "generating";
    return (
      <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl bg-muted text-muted-foreground">
        {generating ? (
          <LoaderCircle className="size-7 motion-safe:animate-spin" />
        ) : (
          <CircleAlert className="size-7 text-destructive" />
        )}
        <span className="text-sm">
          {generating ? "Latihan sedang disusun" : "Pembuatan belum berhasil"}
        </span>
      </div>
    );
  }

  const text = practice.preview?.text ?? practice.title;
  if (practice.kind === "flashcard") {
    return (
      <div className="relative isolate h-56 overflow-hidden rounded-xl bg-[light-dark(#f1eaff,#a184d5)] text-[light-dark(#62418c,#382255)]">
        <div className="absolute inset-x-[17%] top-9 h-44 rotate-10 rounded-2xl border border-current/35 bg-[light-dark(#fff,#eee5fa)]" />
        <div className="absolute inset-x-[13%] top-10 h-44 -rotate-7 rounded-2xl border border-current/35 bg-[light-dark(#fff,#eee5fa)]" />
        <div className="absolute inset-x-[12%] top-11 flex h-42 -rotate-3 flex-col items-center justify-between rounded-2xl border border-current/50 bg-[light-dark(#fff,#eee5fa)] px-5 py-5 text-center">
          <span className="text-[10px]">Ingat kembali</span>
          <p className="line-clamp-3 font-serif text-xl leading-snug wrap-anywhere">{text}</p>
          <span className="text-[10px] opacity-75">Balik kartu untuk memahami</span>
        </div>
      </div>
    );
  }

  if (practice.kind === "exam") {
    return (
      <div className="relative h-56 overflow-hidden rounded-xl bg-[light-dark(#fff4ce,#d9af58)] text-[light-dark(#705000,#493515)]">
        <div className="absolute top-7 left-[13%] min-h-64 w-3/4 rotate-5 rounded-sm border border-[light-dark(#b88712,#84601d)]/40 bg-[light-dark(#fff,#f5e9ce)] p-4 shadow-[5px_5px_0_light-dark(#ffffff80,#f5e9ce80)]">
          <div className="flex items-center justify-between gap-2 border-b border-[light-dark(#b88712,#84601d)]/20 pb-3">
            <span className="font-serif text-lg">Uji pemahaman</span>
            {practice.durationMinutes ? (
              <span className="shrink-0 rounded bg-[light-dark(#fff4ce,#d9af58)] px-1.5 py-1 text-[9px]">
                {practice.durationMinutes} menit
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-[10px]">Bagian 01 / Pemahaman konsep</p>
          <p className="mt-3 line-clamp-3 text-xs leading-relaxed wrap-anywhere text-[light-dark(#707070,#655338)]">
            01. {text}
          </p>
          <div className="mt-4 space-y-3">
            <div className="h-px bg-[light-dark(#eee,#d7c69e)]" />
            <div className="h-px bg-[light-dark(#eee,#d7c69e)]" />
            <div className="h-px w-3/4 bg-[light-dark(#eee,#d7c69e)]" />
          </div>
        </div>
      </div>
    );
  }

  const options = practice.preview?.options ?? [];
  return (
    <div className="flex h-56 flex-col overflow-hidden rounded-xl bg-[light-dark(#ddf3fe,#51baf0)] px-5 py-5 text-[light-dark(#005d87,#09364e)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xl font-semibold tracking-tight text-[light-dark(#008acb,#094466)]">
          01
          <span className="ml-1 text-[11px] font-normal tracking-normal text-[light-dark(#0077ad,#094466)]">
            {" "}
            / {practice.itemCount}
          </span>
        </span>
        <span className="text-[10px] text-[light-dark(#0077ad,#094466)]">Coba jawab</span>
      </div>
      <p className="mt-3 line-clamp-3 text-sm font-semibold leading-relaxed wrap-anywhere">
        {text}
      </p>
      {options.length ? (
        <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
          {["a", "b"].slice(0, options.length).map((label, index) => (
            <div
              key={label}
              className="flex min-w-0 items-start gap-1.5 rounded-lg bg-[light-dark(#fff,#e6f3fb)] p-2.5"
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-primary/35 text-[9px] text-[light-dark(#0077ad,#094466)]">
                {label}
              </span>
              <span className="line-clamp-2 text-[10px] leading-snug wrap-anywhere">
                {options[index]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-auto rounded-lg bg-[light-dark(#fff,#e6f3fb)] p-3 text-xs text-[light-dark(#0077ad,#094466)]">
          {practice.preview
            ? "Tulis jawaban dengan bahasamu sendiri…"
            : "Buka latihan untuk melihat soal"}
        </div>
      )}
      <div className="mt-3 flex justify-center gap-1">
        <span className="h-1 w-4 rounded-full bg-primary" />
        {[1, 2, 3, 4].map((dot) => (
          <span key={dot} className="size-1 rounded-full bg-primary/30" />
        ))}
      </div>
    </div>
  );
}
