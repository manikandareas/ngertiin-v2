import type { JourneyNode } from "@ngertiin/contracts/api";
import { ArrowRight } from "lucide-react";
import type { JSX } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { JourneyNodeItem } from "../modules/components/journey-node-item";

type BuilderJourneyPreviewProps = {
  moduleId: string;
  archived: boolean;
};

// Decorative example only; this never changes the module's actual progress.
const previewNodes: JourneyNode[] = [
  {
    id: "preview-lesson",
    origin: "core",
    type: "lesson",
    title: "Mengenal konsep dasar",
    description: null,
    position: 1,
    progress: { status: "completed", bestScore: null, attemptCount: 0 },
  },
  {
    id: "preview-flashcard",
    origin: "core",
    type: "flashcard",
    title: "Mengingat hal penting",
    description: null,
    position: 2,
    progress: { status: "in_progress", bestScore: null, attemptCount: 0 },
  },
  {
    id: "preview-quiz",
    origin: "core",
    type: "quiz",
    title: "Uji pemahamanmu",
    description: null,
    position: 3,
    progress: { status: "locked", bestScore: null, attemptCount: 0 },
  },
];

export function BuilderJourneyPreview({
  moduleId,
  archived,
}: BuilderJourneyPreviewProps): JSX.Element {
  return (
    <section
      aria-label="Buka alur belajar"
      className="relative isolate grid min-h-155 place-items-center overflow-hidden rounded-3xl border-2 border-border bg-muted/20"
    >
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none absolute inset-0 isolate px-4 sm:px-8"
      >
        <ol className="pt-16 pb-60 md:pt-18">
          {previewNodes.map((node, index) => (
            <JourneyNodeItem
              key={node.id}
              node={node}
              index={index}
              moduleId={moduleId}
              current={node.progress.status === "in_progress"}
            />
          ))}
        </ol>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-background/30 backdrop-blur-[3px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--background)_0%,transparent_75%)] shadow-[inset_0_0_70px_24px_var(--background)]"
      />
      <div className="relative flex max-w-sm flex-col items-center px-6 py-10 text-center">
        <h3 className="max-w-64 text-xl font-extrabold">
          {archived ? "Lihat kembali perjalananmu" : "Perjalanan belajarmu dimulai di sini"}
        </h3>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {archived
            ? "Modul diarsipkan. Kamu tetap bisa melihat alur dan riwayat belajarmu."
            : "Kenali alur belajarmu, lalu mulai dari langkah pertama."}
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to={`/modules/${moduleId}/journey`}>
            Lihat journey
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
