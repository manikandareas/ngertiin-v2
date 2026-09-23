import { cn } from "../../../lib/utils";

const fileColors: Record<string, string> = {
  pdf: "bg-red-600",
  docx: "bg-blue-600",
  pptx: "bg-orange-700",
  xlsx: "bg-emerald-700",
  csv: "bg-emerald-700",
  jpg: "bg-violet-600",
  jpeg: "bg-violet-600",
  png: "bg-violet-600",
  webp: "bg-violet-600",
};

export function ChatFileBadge({ filename }: { filename: string }) {
  const extension = filename.includes(".") ? (filename.split(".").at(-1)?.toLowerCase() ?? "") : "";
  const label = extension === "markdown" ? "MD" : extension.slice(0, 4).toUpperCase() || "FILE";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1 text-[8px] font-bold leading-none text-white",
        fileColors[extension] ?? "bg-slate-600",
      )}
    >
      {label}
    </span>
  );
}
