import type { ModuleSummary } from "@ngertiin/contracts/api";

const statusTones = {
  neutral: "border-border bg-muted text-muted-foreground",
  active:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-[#494136] dark:bg-[#302c26] dark:text-[#d7c4a4]",
  failed:
    "border-destructive/20 bg-destructive/5 text-destructive dark:border-[#4b3838] dark:bg-[#302626] dark:text-[#d7b7b5]",
  completed:
    "border-success/30 bg-success-subtle text-success-foreground dark:border-[#3b4740] dark:bg-[#27302b] dark:text-[#b9cdbf]",
};
export const moduleDifficulties = {
  beginner: { label: "Pemula", color: "bg-primary" },
  intermediate: { label: "Menengah", color: "bg-orange-500" },
  advanced: { label: "Lanjutan", color: "bg-red-500" },
};

export function getModuleStatus(module: ModuleSummary): {
  label: string;
  tone: string;
} {
  switch (module.status) {
    case "generating":
      return { label: "Sedang disiapkan", tone: statusTones.active };
    case "failed":
      return { label: "Perlu dicoba lagi", tone: statusTones.failed };
    case "archived":
      return { label: "Diarsipkan", tone: statusTones.neutral };
    case "ready":
      switch (module.progress?.status) {
        case "completed":
          return { label: "Selesai", tone: statusTones.completed };
        case "in_progress":
          return { label: "Sedang dipelajari", tone: statusTones.active };
        default:
          return { label: "Belum dimulai", tone: statusTones.neutral };
      }
  }
}

export const moduleDurationTone =
  "border-lime-200 bg-lime-50 text-lime-800 dark:border-[#3e4539] dark:bg-[#292e27] dark:text-[#c4cdb3]";
