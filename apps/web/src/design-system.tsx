import { ArrowRight, Check } from "lucide-react";
import { createRoot } from "react-dom/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import "./index.css";

function DesignSystem() {
  return (
    <main className="mx-auto max-w-[1200px] space-y-16 px-6 py-12 sm:px-12">
      <header className="max-w-3xl space-y-6">
        <p className="text-nav-label font-bold uppercase text-link">Ngerti.in · Design system</p>
        <h1 className="font-display text-heading font-black text-primary sm:text-display">
          Belajar sedikit.
          <br />
          Ngerti lebih banyak.
        </h1>
        <p className="text-body text-muted-foreground">
          Kanvas putih, bentuk membulat, dan Spark Blue. Fondasi visual untuk pengalaman belajar
          yang ramah dan fokus.
        </p>
      </header>
      <section aria-labelledby="colors" className="space-y-6">
        <h2 id="colors" className="text-heading-sm font-bold">
          Warna
        </h2>
        <div className="flex flex-wrap gap-4">
          {[
            ["Primary", "#1cb0f6", "bg-primary text-primary-foreground"],
            ["Secondary", "#e5f5ff", "bg-secondary text-secondary-foreground"],
            ["Success", "#d7ffb8", "bg-success-subtle text-success-foreground"],
            ["Ink", "#000437", "bg-night-ink text-paper-white"],
          ].map(([label, hex, style]) => (
            <div key={label} className={`min-w-40 rounded-lg p-6 ${style}`}>
              <p className="font-bold">{label}</p>
              <p className="text-caption">{hex}</p>
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="buttons" className="space-y-6">
        <h2 id="buttons" className="text-heading-sm font-bold">
          Tombol
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            Mulai belajar <ArrowRight />
          </Button>
          <Button variant="outline">Sudah punya akun</Button>
          <Button variant="secondary">Lihat materi</Button>
          <Button variant="ghost">Lewati</Button>
          <Button variant="link">Bantuan</Button>
          <Button variant="destructive">Hapus</Button>
          <Button disabled>Memproses</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Selesai">
            <Check />
          </Button>
        </div>
      </section>
      <section aria-labelledby="fields" className="max-w-xl space-y-6">
        <h2 id="fields" className="text-heading-sm font-bold">
          Input
        </h2>
        <div className="space-y-2">
          <label htmlFor="topic" className="font-bold">
            Topik belajar
          </label>
          <Input id="topic" placeholder="Contoh: Sistem tata surya" />
        </div>
        <div className="space-y-2">
          <label htmlFor="notes" className="font-bold">
            Catatan
          </label>
          <Textarea id="notes" placeholder="Tulis hal yang ingin kamu pahami…" />
        </div>
        <div className="space-y-2">
          <label htmlFor="invalid" className="font-bold">
            Topik wajib diisi
          </label>
          <Input id="invalid" aria-invalid="true" aria-describedby="invalid-help" />
          <p id="invalid-help" className="text-sm text-destructive">
            Tuliskan satu topik untuk melanjutkan.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="disabled" className="font-bold">
            Belum tersedia
          </label>
          <Input id="disabled" disabled placeholder="Menunggu materi" />
        </div>
      </section>
      <section aria-labelledby="cards" className="max-w-xl space-y-6">
        <h2 id="cards" className="text-heading-sm font-bold">
          Kartu dan label
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Kenali tata surya</CardTitle>
            <CardDescription>Satu langkah kecil untuk memahami dunia di sekitarmu.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Badge>Materi baru</Badge>
            <Badge variant="secondary">5 menit</Badge>
            <Badge variant="outline">Pemula</Badge>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Mulai belajar</Button>
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-caption font-extrabold uppercase tracking-wide text-muted-foreground">
              Perjalanan belajar
            </p>
            <CardTitle>Sedikit latihan, semakin paham!</CardTitle>
            <CardDescription>
              Lanjutkan materi dan bangun pemahamanmu selangkah demi selangkah.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" className="w-full">
              Lihat materi
            </Button>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<DesignSystem />);
