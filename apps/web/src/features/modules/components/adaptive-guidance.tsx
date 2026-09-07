import type { AdaptiveIntervention } from "@ngertiin/contracts/api";

export function AdaptiveGuidance({
  intervention,
}: {
  intervention: Pick<AdaptiveIntervention, "required" | "status">;
}) {
  if (intervention.status === "completed" || intervention.status === "skipped") return null;

  let description =
    "Kamu sudah memilih penguatan tambahan ini. Progres perjalanan utamamu tetap tersimpan.";
  if (intervention.required) {
    description =
      "Beberapa konsep perlu diperkuat. Selesaikan penguatan ini sebelum melanjutkan perjalanan utama.";
  } else if (intervention.status === "offered") {
    description =
      "Mau memantapkan konsep yang belum kuat? Kamu boleh mengambil penguatan ini atau langsung lanjut belajar.";
  }

  return (
    <div className="space-y-2">
      <p className="font-bold">
        {intervention.required ? "Penguatan wajib" : "Penguatan opsional"}
      </p>
      <p className="text-sm leading-6">{description}</p>
    </div>
  );
}
