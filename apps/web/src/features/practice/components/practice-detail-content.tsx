import { ArrowRight02Icon, RotateLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { PracticeDetail } from "@ngertiin/contracts/api";
import { Button } from "../../../components/ui/button";

type Props = {
  practice: PracticeDetail;
  busy: boolean;
  active: boolean;
  startDisabled: boolean;
  onStart: () => void;
  onRetry: () => void;
};
export function PracticeDetailContent({
  practice: data,
  busy,
  active,
  startDisabled,
  onStart,
  onRetry,
}: Props) {
  const kind = data.kind;
  const composition = data.configuration.composition;
  const items =
    kind === "flashcard"
      ? [`${data.itemCount} kartu tanya–jawab`]
      : [
          { count: composition?.multipleChoice ?? 0, label: "pilihan ganda" },
          { count: composition?.trueFalse ?? 0, label: "benar / salah" },
          { count: composition?.shortAnswer ?? 0, label: "esai singkat" },
        ]
          .filter(({ count }) => count > 0)
          .map(({ count, label }) => `${count} ${label}`);
  const heading = active
    ? "Lanjutkan sesi belajarmu"
    : kind === "flashcard"
      ? "Satu kartu, satu pemahaman."
      : kind === "quiz"
        ? "Saatnya menguji pemahaman."
        : `Siapkan waktu ${data.configuration.durationMinutes} menit.`;
  const description =
    kind === "exam"
      ? "Timer berjalan sejak exam dimulai, termasuk saat halaman ditutup."
      : kind === "flashcard"
        ? "Balik kartu untuk melihat penjelasan, lalu tandai seberapa paham kamu."
        : "Kerjakan sesuai ritmemu. Jawaban tersimpan otomatis selama latihan.";
  const action = active
    ? "Lanjutkan"
    : kind === "flashcard"
      ? "Mulai belajar"
      : kind === "quiz"
        ? "Mulai kuis"
        : "Mulai exam";
  return (
    <>
      {data.archivedAt ? (
        <p role="status" className="mt-6 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          Latihan ini diarsipkan. Riwayat tetap tersedia. Pulihkan melalui menu untuk memulai sesi
          baru.
        </p>
      ) : null}
      {data.status === "generating" ? (
        <section role="status" className="mt-7 rounded-xl bg-muted p-5">
          <h2 className="font-semibold">Latihan sedang disusun</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Progres {data.progress}% · status diperbarui otomatis.
          </p>
          <progress
            className="mt-4 h-2 w-full accent-primary"
            value={data.progress}
            max={100}
            aria-label="Progres pembuatan latihan"
          />
        </section>
      ) : null}
      {data.status === "failed" ? (
        <section className="mt-7 rounded-xl border p-5">
          <h2 className="font-semibold">Pembuatan belum berhasil</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.failure ?? "Coba lagi dengan pengaturan yang sama."}
          </p>
          <Button className="mt-4" size="sm" disabled={busy} onClick={onRetry}>
            <HugeiconsIcon
              icon={RotateLeft01Icon}
              strokeWidth={1.5}
              aria-hidden="true"
              className="size-4"
            />
            Coba lagi
          </Button>
        </section>
      ) : null}
      {data.status === "ready" ? (
        <section
          className="mt-7 flex flex-col gap-5 border-y py-6 2xl:flex-row 2xl:items-center 2xl:justify-between"
          aria-label="Mulai latihan"
        >
          <div>
            <h2 className="font-display text-lg font-bold">{heading}</h2>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
          </div>
          <Button
            className="shrink-0 sm:self-start"
            disabled={busy || Boolean(data.archivedAt) || startDisabled}
            onClick={onStart}
          >
            {action}
            <HugeiconsIcon
              icon={ArrowRight02Icon}
              strokeWidth={1.5}
              aria-hidden="true"
              className="size-4"
            />
          </Button>
        </section>
      ) : null}
      <section className="mt-7">
        <h2 className="font-display text-lg font-bold">
          {kind === "flashcard" ? "Isi kartu belajar" : "Isi latihan"}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {items.map((item) => (
            <span key={item} className="rounded-md bg-muted px-2.5 py-1.5">
              {item}
            </span>
          ))}
          <span className="rounded-md bg-muted px-2.5 py-1.5">
            {data.configuration.language === "id" ? "Bahasa Indonesia" : "Bahasa Inggris"}
          </span>
        </div>
      </section>
    </>
  );
}
