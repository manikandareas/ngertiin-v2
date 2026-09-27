import type { ReactNode } from "react";
import { CreationLayout } from "../../components/creation-layout";

const steps = ["Materi", "Fokus belajar", "Tinjau modul", "Pembuatan", "Siap belajar"];
const headings = [
  "Tambahkan materi",
  "Atur fokus belajar",
  "Tinjau modul",
  "Menyusun modulmu",
  "Modulmu siap dipelajari",
];
const descriptions = [
  "Kumpulkan bahan belajarmu. Kami bantu menyusunnya menjadi langkah-langkah kecil yang mudah dipahami.",
  "Beri sedikit arahan agar belajarmu lebih terarah. Langkah ini boleh dilewati.",
  "Pastikan materi dan fokusnya sudah sesuai. Setelah ini, biarkan kami menyusun alur belajarmu.",
  "Dari materi menjadi perjalanan belajar. Ikuti setiap langkahnya di sini.",
  "Satu langkah kecil hari ini, satu hal baru yang kamu pahami.",
];

export function BuilderLayout({
  step,
  onStep,
  children,
  footer,
}: {
  step: number;
  onStep?: (step: number) => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <CreationLayout
      steps={steps}
      step={step}
      onStep={onStep}
      title={headings[step]}
      description={descriptions[step]}
      backTo="/dashboard"
      backLabel="Kembali ke Beranda"
      footer={footer}
    >
      <div key={step} className="motion-safe:animate-builder-enter">
        {children}
      </div>
    </CreationLayout>
  );
}
