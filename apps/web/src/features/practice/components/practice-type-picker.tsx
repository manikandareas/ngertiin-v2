import type { PracticeConfiguration } from "@ngertiin/contracts/api";
import { Label } from "../../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group";
import { PracticeCardPreview } from "./practice-card-preview";

export const practiceTypes = {
  flashcard: {
    label: "Flashcard",
    description: "Ingat konsep penting dengan kartu tanya-jawab.",
    min: 5,
    max: 30,
    count: 10,
  },
  quiz: {
    label: "Kuis",
    description: "Cek pemahamanmu tanpa batas waktu.",
    min: 5,
    max: 20,
    count: 10,
  },
  exam: {
    label: "Exam",
    description: "Uji kesiapanmu dengan soal dan batas waktu.",
    min: 20,
    max: 60,
    count: 20,
  },
} as const;

export function PracticeTypePicker({
  value,
  onChange,
  disabled = false,
}: {
  disabled?: boolean;
  value: PracticeConfiguration["kind"] | null;
  onChange: (kind: PracticeConfiguration["kind"]) => void;
}) {
  return (
    <RadioGroup
      aria-label="Jenis latihan"
      value={value ?? ""}
      disabled={disabled}
      onValueChange={(kind) => onChange(kind as PracticeConfiguration["kind"])}
      className="grid gap-4 md:grid-cols-3"
    >
      {(Object.keys(practiceTypes) as Array<keyof typeof practiceTypes>).map((kind) => {
        const type = practiceTypes[kind];
        return (
          <Label
            key={kind}
            htmlFor={`practice-kind-${kind}`}
            className="relative block min-w-0 cursor-pointer rounded-[18px] border-2 border-border p-2.5 leading-normal transition-colors hover:border-input has-[[data-state=checked]]:border-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring"
          >
            <div aria-hidden="true">
              <PracticeCardPreview
                practice={{
                  id: kind,
                  kind,
                  status: "ready",
                  title:
                    kind === "flashcard"
                      ? "Satu konsep, satu pemahaman."
                      : "Seberapa jauh kamu memahami materi ini?",
                  itemCount: type.count,
                  durationMinutes: kind === "exam" ? 30 : null,
                  preview:
                    kind === "quiz"
                      ? {
                          text: "Apa yang sudah kamu pahami?",
                          options: ["Pahami konsep", "Coba terapkan"],
                        }
                      : null,
                }}
              />
            </div>
            <div className="px-1.5 pt-4 pb-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{type.label}</span>
                <RadioGroupItem
                  id={`practice-kind-${kind}`}
                  value={kind}
                  aria-label={type.label}
                  aria-describedby={`practice-kind-${kind}-description`}
                  className="size-5"
                />
              </div>
              <p
                id={`practice-kind-${kind}-description`}
                className="mt-2 text-xs font-normal leading-5 text-muted-foreground"
              >
                {type.description}
              </p>
            </div>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
