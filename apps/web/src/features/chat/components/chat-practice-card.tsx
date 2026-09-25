import { practiceDetailResponseSchema } from "@ngertiin/contracts/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { requestApi, type TokenResolver } from "../../../lib/api";

const appearances = {
  flashcard: {
    label: "Flashcard",
    colors: "bg-[#ede6fc] text-[#7053b8] dark:bg-[#392b4c] dark:text-[#b79ae8]",
    icon: (
      <>
        <rect x="7" y="7" width="12" height="14" rx="2" />
        <path d="M15 3H5a2 2 0 0 0-2 2v12" />
      </>
    ),
  },
  multipleChoice: {
    label: "Pilihan ganda",
    colors: "bg-[#ffedce] text-[#a76225] dark:bg-[#413222] dark:text-[#e8b576]",
    icon: (
      <>
        <circle cx="5" cy="6" r="1.5" />
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="5" cy="18" r="1.5" />
        <path d="M11 6h9m-9 6h9m-9 6h6" />
      </>
    ),
  },
  trueFalse: {
    label: "Benar / salah",
    colors: "bg-[#ddf3e8] text-[#27786a] dark:bg-[#253d33] dark:text-[#8aceb6]",
    icon: <path d="m3 8 3 3 5-6m3 9 6 6m0-6-6 6" />,
  },
  shortAnswer: {
    label: "Jawaban singkat",
    colors: "bg-[#e2ecff] text-[#436db4] dark:bg-[#2b3750] dark:text-[#9ebff3]",
    icon: <path d="m5 16-1 4 4-1L20 7l-3-3L5 16Zm9-9 3 3M12 21h8" />,
  },
  exam: {
    label: "Simulasi ujian",
    colors: "bg-[#fbe2e9] text-[#ad526d] dark:bg-[#432d36] dark:text-[#e7a0b5]",
    icon: (
      <>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 8v5l3 2M9 2h6" />
      </>
    ),
  },
};

export function ChatPracticeCard({
  practiceId,
  moduleId,
  getToken,
}: {
  practiceId: string;
  moduleId: string;
  getToken: TokenResolver;
}) {
  const practice = useQuery({
    queryKey: ["practice", practiceId],
    queryFn: async () =>
      (await requestApi(`/practices/${practiceId}`, getToken, practiceDetailResponseSchema)).data,
    refetchInterval: (query) =>
      query.state.data?.status === "ready" || query.state.data?.status === "failed" ? false : 3000,
  });
  const data = practice.data;
  const composition = data?.configuration.composition;
  const questionTypes = composition
    ? (["multipleChoice", "trueFalse", "shortAnswer"] as const).filter(
        (type) => composition[type] > 0,
      )
    : [];
  const appearance =
    data?.kind === "flashcard"
      ? appearances.flashcard
      : data?.kind === "exam"
        ? appearances.exam
        : appearances[
            questionTypes.length === 1 ? (questionTypes[0] ?? "multipleChoice") : "multipleChoice"
          ];
  const label = !data
    ? "Latihan"
    : data.kind === "quiz" && questionTypes.length !== 1
      ? "Kuis campuran"
      : appearance.label;
  const status = practice.isError
    ? "Status latihan belum dapat dimuat"
    : !data
      ? "Memuat latihan…"
      : data.status === "failed"
        ? "Pembuatan belum berhasil"
        : data.status === "generating"
          ? "Menyusun latihan…"
          : `${data.itemCount} ${data.kind === "flashcard" ? "kartu" : "soal"}${
              data.configuration.durationMinutes
                ? ` · ${data.configuration.durationMinutes} menit`
                : ""
            }`;

  return (
    <Link
      className={`mt-3 flex min-h-[62px] w-fit max-w-full items-center gap-[11px] rounded-full border border-transparent py-2.5 pr-[15px] pl-[11px] transition-colors hover:border-current focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring ${appearance.colors}`}
      to={`/modules/${moduleId}/practice/${practiceId}`}
      aria-label={`Lihat latihan: ${data?.title ?? "Latihan"}. ${status}`}
    >
      <span className="relative flex size-[34px] shrink-0 items-center justify-center rounded-full bg-current">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-[17px] text-white dark:text-[#242722]"
          aria-hidden="true"
        >
          {appearance.icon}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs leading-[1.4] font-semibold break-words text-foreground [overflow-wrap:anywhere]">
          {data?.title ?? "Latihan sedang dibuat"}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-[7px] gap-y-0.5 text-[10px] leading-normal">
          <span>{label}</span>
          <span className="text-muted-foreground" aria-live="polite">
            {status}
          </span>
        </span>
      </span>
      <span className="shrink-0 pl-2.5 text-[15px]" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
