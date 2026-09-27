import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../components/theme-provider";
import styles from "../features/design-system/proposal.module.css";
import {
  CheckboxExample,
  DestructiveExample,
  FeedbackExample,
  FormExample,
  IndicatorExample,
  MenuExample,
  PrimaryExample,
} from "../features/design-system/proposal-examples";

const proposals = [
  {
    id: "primary",
    title: "Primary button & badge",
    description:
      "Spark Blue tetap dipakai. Teks putih diganti Night Ink agar label kecil, badge, dan selection teks lebih terbaca.",
    change: "primary-foreground → #000437",
    render: () => <PrimaryExample />,
  },
  {
    id: "destructive",
    title: "Destructive button & badge",
    description:
      "Teks tetap putih. Fill aksi memakai raspberry lebih dalam dan hover solid; warna teks error dipisahkan dari fill tombol.",
    change: "Solid: #DF2450 light / #DF2850 dark · hover #C61C43",
    render: (proposed: boolean) => <DestructiveExample proposed={proposed} />,
  },
  {
    id: "forms",
    title: "Input, textarea & batas kontrol",
    description:
      "Focus input dan textarea disederhanakan menjadi satu border biru dengan tint tipis di dalam field. Coba tombol Fokus input atau navigasi Tab untuk membandingkan.",
    change: "Focus → satu border 2 px + tint accent 6% · tanpa outline luar",
    render: (proposed: boolean) => <FormExample proposed={proposed} />,
  },
  {
    id: "indicators",
    title: "Tabs, radio, progress & link",
    description:
      "Warna brand untuk fill dipisahkan dari warna teks dan indikator. Tab dan link memakai link; radio dan progress memakai ring.",
    change: "Teks → link · indikator → ring",
    render: (proposed: boolean) => <IndicatorExample proposed={proposed} />,
  },
  {
    id: "checkbox",
    title: "Checkbox checked & mixed",
    description:
      "Centang gelap pada fill biru. State indeterminate memakai minus, dengan border kontrol dan focus ring yang tetap terlihat.",
    change: "Checked / mixed → primary + Night Ink · mixed → minus",
    render: () => <CheckboxExample />,
  },
  {
    id: "menus",
    title: "Select & dropdown berikon",
    description:
      "Saat option disorot, ikon mengikuti warna teks option. Preview portal masing-masing kolom mengikuti style kolomnya sendiri.",
    change: "Ikon option fokus → accent-foreground",
    render: (proposed: boolean) => <MenuExample proposed={proposed} />,
  },
  {
    id: "feedback",
    title: "Feedback salah pada quiz",
    description:
      "Komponen node activity dan practice asli, dengan surface error dan teks khusus. Komposisi pilihan quiz tetap sama.",
    change: "Light #FFE5EC / #AD1238 · dark #44252F / #FFB2C1",
    render: (proposed: boolean) => <FeedbackExample proposed={proposed} />,
  },
];

function ComparisonColumn({
  proposed,
  children,
  label,
}: {
  proposed: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <section
      className={`min-w-0 border-t pt-5 ${proposed ? styles.proposal : ""}`}
      aria-label={`${label}: ${proposed ? "usulan" : "saat ini"}`}
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold">{proposed ? "Usulan" : "Saat ini"}</h3>
        <span className="text-xs text-muted-foreground">
          {proposed ? "Preview lokal" : "Primitive aplikasi"}
        </span>
      </div>
      {children}
    </section>
  );
}

export default function DesignSystemProposalPage() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Link
            to="/design-system"
            className="text-sm font-bold text-link focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            ← Design system
          </Link>
          <fieldset className="flex items-center gap-1" aria-label="Mode warna">
            {(["light", "dark"] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                aria-pressed={theme === mode}
                onClick={() => setTheme(mode)}
                className="min-h-10 rounded-lg px-4 text-sm font-bold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:bg-muted"
              >
                {mode === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </fieldset>
        </div>
        <nav
          aria-label="Proposal per komponen"
          className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-5 pb-3 text-sm sm:px-8"
        >
          {proposals.map((entry) => (
            <a
              key={entry.id}
              href={`#${entry.id}`}
              className="shrink-0 text-muted-foreground hover:text-link focus-visible:outline-2 focus-visible:outline-ring"
            >
              {
                {
                  primary: "Primary",
                  destructive: "Destructive",
                  forms: "Form",
                  indicators: "Indikator",
                  checkbox: "Checkbox",
                  menus: "Menu",
                  feedback: "Feedback quiz",
                }[entry.id]
              }
            </a>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="py-10">
          <p className="mb-2 text-sm text-muted-foreground">Eksplorasi sebelum finalisasi</p>
          <h1 className="font-display text-heading font-extrabold">Proposal kontras</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Bandingkan tampilan sekarang dengan usulan tiap komponen. Coba hover, klik, dan navigasi
            Tab pada kedua kolom, lalu ganti light / dark.
          </p>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Kolom saat ini sudah mencakup perbaikan yang disetujui. Usulan lainnya tetap terbatas di
            halaman ini. Target: teks 4,5:1 dan indikator kontrol 3:1. Rasio di bawah mengukur
            pasangan warna contoh, bukan sertifikasi aksesibilitas seluruh komponen.
          </p>
        </div>
        {proposals.map((entry, index) => (
          <section key={entry.id} id={entry.id} className="scroll-mt-36 border-t py-9">
            <div className="mb-7">
              <p className="mb-2 font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")} / 07
              </p>
              <h2 className="font-display text-heading-sm font-extrabold">{entry.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {entry.description}
              </p>
              <p className="mt-3 break-words font-mono text-xs text-muted-foreground">
                {entry.change}
              </p>
            </div>
            <div className="grid gap-9 lg:grid-cols-2">
              <ComparisonColumn proposed={false} label={entry.title}>
                {entry.render(false)}
              </ComparisonColumn>
              <ComparisonColumn proposed label={entry.title}>
                {entry.render(true)}
              </ComparisonColumn>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
