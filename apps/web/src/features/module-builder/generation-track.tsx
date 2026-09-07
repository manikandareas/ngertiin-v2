import {
  Alert02Icon,
  BookOpen01Icon,
  FileSearchIcon,
  GitBranchIcon,
  Layers01Icon,
  ShieldCheckIcon,
  SparklesIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { GenerationStatus } from "@ngertiin/contracts/api";
import { useState } from "react";

const nodeSpacing = 180;
const nodeStyles = {
  waiting:
    "border-border bg-muted text-muted-foreground shadow-[0_5px_0_var(--border)] motion-safe:animate-generation-idle",
  active:
    "border-primary bg-primary text-primary-foreground shadow-[0_5px_0_var(--primary-edge)] before:absolute before:-inset-2.25 before:rounded-full before:border-2 before:border-primary before:opacity-25 before:content-[''] motion-safe:animate-generation-float motion-safe:before:animate-generation-pulse",
  done: "border-success bg-success-subtle text-success-foreground shadow-[0_5px_0_var(--success)]",
  failed: "border-destructive bg-muted text-destructive shadow-[0_5px_0_var(--border)]",
};

const phases = {
  preparing_sources: {
    title: "Menyiapkan materi",
    detail: "Mengumpulkan isi dari sumber dan halaman yang kamu pilih.",
    icon: FileSearchIcon,
  },
  understanding_material: {
    title: "Memahami materi",
    detail: "Mengenali gagasan utama dan hubungan di dalam materimu.",
    icon: BookOpen01Icon,
  },
  creating_concepts: {
    title: "Merangkai konsep",
    detail: "Mengurai materi menjadi konsep-konsep yang lebih mudah dipahami.",
    icon: Layers01Icon,
  },
  creating_journey: {
    title: "Menyusun alur belajar",
    detail: "Mengurutkan langkah belajar dari dasar hingga penerapan.",
    icon: GitBranchIcon,
  },
  generating_activities: {
    title: "Membuat aktivitas",
    detail: "Menyiapkan penjelasan, kartu belajar, dan latihan pemahaman.",
    icon: SparklesIcon,
  },
  validating_content: {
    title: "Memeriksa hasil",
    detail: "Memeriksa kelengkapan dan konsistensi modul sebelum kamu mulai.",
    icon: ShieldCheckIcon,
  },
};

export function GenerationTrack({ generation }: { generation: GenerationStatus }) {
  const [selected, setSelected] = useState<string | null>(null);
  const active = generation.currentPhase;
  const progressPhase =
    generation.state === "completed"
      ? generation.phases.at(-1)?.phase
      : (active ??
        generation.phases.filter((phase) => phase.status === "completed").at(-1)?.phase ??
        generation.phases[0]?.phase);
  const detailPhase = generation.phases.find((phase) => phase.phase === selected)?.phase ?? active;
  return (
    <div>
      <div className="relative mx-auto max-w-[440px]">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 440 ${generation.phases.length * nodeSpacing}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {generation.phases.slice(0, -1).map((phase, index) => {
            const left = index % 2 === 0;
            const x1 = left ? 64 : 376;
            const x2 = left ? 376 : 64;
            const y = index * nodeSpacing + 40;
            const path = `M ${x1} ${y} C ${x1} ${y + nodeSpacing * 0.65}, ${x2} ${y + nodeSpacing * 0.35}, ${x2} ${y + nodeSpacing}`;
            return (
              <g key={phase.phase}>
                <path
                  d={path}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="3"
                  strokeDasharray="6 7"
                />
                <path
                  className="[stroke-dasharray:1] [stroke-dashoffset:1] data-[complete=true]:[stroke-dashoffset:0] motion-safe:transition-[stroke-dashoffset] motion-safe:duration-650 motion-safe:ease-out"
                  data-complete={phase.status === "completed"}
                  d={path}
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth="3"
                  pathLength="1"
                />
              </g>
            );
          })}
        </svg>
        <ol className="relative">
          {generation.phases.map((phase, index) => {
            const info = phases[phase.phase];
            const failed =
              generation.state === "failed" &&
              (phase.phase === active || phase.status === "failed");
            const current = !failed && phase.phase === active && generation.state === "processing";
            const done = phase.status === "completed";
            const icon = failed ? Alert02Icon : done ? Tick02Icon : info.icon;
            const state = failed ? "failed" : done ? "done" : current ? "active" : "waiting";
            return (
              <li
                key={phase.phase}
                style={{ height: nodeSpacing }}
                className={`group/row px-[calc(14.545%-32px)] flex items-start gap-8 ${index % 2 ? "flex-row-reverse text-right" : ""}`}
              >
                <button
                  type="button"
                  aria-label={`${info.title}: ${failed ? "gagal" : done ? "selesai" : current ? "sedang dikerjakan" : "menunggu"}`}
                  aria-current={current ? "step" : undefined}
                  aria-pressed={selected === phase.phase}
                  onClick={() => setSelected(phase.phase)}
                  data-state={state}
                  className={`relative z-1 mt-2 grid size-16 shrink-0 place-items-center rounded-full border-2 aria-pressed:outline-2 aria-pressed:outline-offset-5 aria-pressed:outline-ring focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring motion-safe:transition-colors motion-safe:duration-250 ${nodeStyles[state]} ${state === "waiting" ? "motion-safe:group-even/row:[animation-delay:-1.8s]" : ""}`}
                >
                  <HugeiconsIcon
                    icon={icon}
                    size={28}
                    strokeWidth={1.5}
                    key={done ? "done" : "pending"}
                    className={`relative size-7 ${done ? "motion-safe:animate-generation-arrive" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                <div className="relative z-1 mt-2 min-w-0 flex-1 rounded-xl bg-background/95 px-2 py-2">
                  <p
                    className={`text-sm font-bold ${current ? "text-link" : failed ? "text-destructive" : ""}`}
                  >
                    {info.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {failed
                      ? "Perlu dicoba kembali"
                      : done
                        ? "Selesai"
                        : current
                          ? "Sedang dikerjakan…"
                          : generation.state === "queued" && phase.phase === progressPhase
                            ? "Dalam antrean"
                            : "Menunggu giliran"}
                  </p>
                  {phase.phase === progressPhase ? (
                    <p
                      className="mt-2 text-xs font-medium tabular-nums text-muted-foreground"
                      role="status"
                      aria-label={`Progres pembuatan modul ${generation.progressPercentage}%`}
                    >
                      {generation.progressPercentage}%
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="min-h-20 rounded-xl bg-muted px-4 py-3" aria-live="polite">
        <p className="text-sm font-semibold">
          {detailPhase ? phases[detailPhase].title : "Setiap langkah punya peran"}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {detailPhase
            ? phases[detailPhase].detail
            : "Pilih node untuk mengenal prosesnya. Status akan diperbarui secara otomatis."}
        </p>
      </div>
    </div>
  );
}
