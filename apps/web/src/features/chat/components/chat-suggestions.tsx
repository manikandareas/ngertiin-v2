import { BulbIcon, Chat01Icon, TextAlignLeftIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { BookOpen, Layers, ListChecks } from "lucide-react";

type ChatSuggestionsProps = {
  onSuggest: (text: string) => void;
  disabled: boolean;
  standalone: boolean;
  fullPage: boolean;
};

const suggestionChipClassName =
  "flex min-h-9 items-center gap-2 rounded-full border border-foreground/25 bg-card py-1 pl-1 pr-3 text-left text-xs font-medium text-foreground hover:border-foreground/40 hover:bg-muted motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50";

const primarySuggestions = [
  {
    icon: BulbIcon,
    iconClassName: "bg-secondary text-secondary-foreground",
    compactLabel: "Jelaskan konsep",
    standaloneCompactLabel: "Jelaskan konsep",
    standaloneLabel: "Kenapa langit berwarna biru?",
    moduleLabel: "Jelaskan dengan lebih sederhana",
    standalonePrompt: "Kenapa langit berwarna biru?",
    modulePrompt: "Jelaskan materi ini dengan lebih sederhana",
  },
  {
    icon: Chat01Icon,
    iconClassName: "bg-[var(--flashcard-lavender-surface)] text-[var(--flashcard-lavender-ink)]",
    compactLabel: "Beri contoh",
    standaloneCompactLabel: "Beri contoh",
    standaloneLabel: "Apa itu berpikir kritis?",
    moduleLabel: "Beri contoh sehari-hari",
    standalonePrompt: "Jelaskan berpikir kritis dengan contoh sehari-hari",
    modulePrompt: "Beri aku contoh dari kehidupan sehari-hari",
  },
  {
    icon: TextAlignLeftIcon,
    iconClassName: "bg-[var(--flashcard-peach-surface)] text-[var(--flashcard-peach-ink)]",
    standaloneCompactLabel: "Mulai topik baru",
    compactLabel: "Ringkas materi",
    standaloneLabel: "Bantu aku mulai belajar topik baru",
    moduleLabel: "Temukan inti materi ini",
    standalonePrompt: "Bantu aku mulai belajar topik baru",
    modulePrompt: "Apa inti dari materi ini?",
  },
];

const extraSuggestions = [
  {
    icon: BookOpen,
    iconClassName: "bg-success-subtle text-success-foreground",
    label: "Susun rencana belajar",
    standalonePrompt:
      "Bantu aku menyusun rencana belajar. Tanyakan dulu topik dan target belajarku.",
    modulePrompt: "Buatkan rencana belajar untuk materi ini",
  },
  {
    icon: ListChecks,
    iconClassName: "bg-adaptive-subtle text-adaptive-foreground",
    label: "Uji pemahamanku",
    standalonePrompt:
      "Bantu aku menguji pemahaman. Tanyakan dulu topik yang ingin kupelajari, lalu beri satu pertanyaan setiap kali.",
    modulePrompt: "Uji pemahamanku tentang materi ini, satu pertanyaan setiap kali",
  },
  {
    icon: Layers,
    iconClassName: "bg-secondary text-secondary-foreground",
    label: "Buat kartu belajar",
    standalonePrompt:
      "Bantu aku membuat kartu tanya jawab. Tanyakan dulu topik yang ingin kupelajari.",
    modulePrompt: "Buat kartu tanya jawab untuk mengingat konsep penting materi ini",
  },
];

export function ChatSuggestions({
  onSuggest,
  disabled,
  standalone,
  fullPage,
}: ChatSuggestionsProps) {
  return (
    <div
      className={
        fullPage
          ? "mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2 sm:mt-10"
          : "mt-6 space-y-1"
      }
    >
      {primarySuggestions.map((suggestion) => {
        let label = standalone ? suggestion.standaloneLabel : suggestion.moduleLabel;
        if (fullPage) {
          label = standalone ? suggestion.standaloneCompactLabel : suggestion.compactLabel;
        }

        return (
          <button
            key={suggestion.compactLabel}
            type="button"
            disabled={disabled}
            onClick={() =>
              onSuggest(standalone ? suggestion.standalonePrompt : suggestion.modulePrompt)
            }
            className={
              fullPage
                ? suggestionChipClassName
                : "-ml-2 flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            }
          >
            <HugeiconsIcon
              icon={suggestion.icon}
              size={20}
              strokeWidth={1.5}
              className={
                fullPage
                  ? `size-7 shrink-0 rounded-full p-1.5 ${suggestion.iconClassName}`
                  : "shrink-0 text-muted-foreground"
              }
              aria-hidden="true"
            />
            {label}
          </button>
        );
      })}
      {fullPage &&
        extraSuggestions.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            disabled={disabled}
            onClick={() =>
              onSuggest(standalone ? suggestion.standalonePrompt : suggestion.modulePrompt)
            }
            className={suggestionChipClassName}
          >
            <suggestion.icon
              className={`size-7 shrink-0 rounded-full p-1.5 ${suggestion.iconClassName}`}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {suggestion.label}
          </button>
        ))}
    </div>
  );
}
