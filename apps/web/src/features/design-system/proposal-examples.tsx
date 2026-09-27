import { ArrowRight02Icon, Delete02Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Progress } from "../../components/ui/progress";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";
import { Assessment } from "../modules/components/assessment-activity";
import { PracticeQuizResultQuestion } from "../practice/components/practice-quiz-result-question";
import styles from "./proposal.module.css";

/** Measure the resolved pair inside its own column, including scoped tokens. */
export function ContrastPair({
  foreground,
  background,
  label,
  minimum = 4.5,
}: {
  foreground: string;
  background: string;
  label: string;
  minimum?: number;
}) {
  const swatch = useRef<HTMLSpanElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      if (!swatch.current) return;
      const style = getComputedStyle(swatch.current);
      const luminance = (color: string) => {
        const channels = color
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number);
        if (channels?.length !== 3 || !color.startsWith("rgb")) return null;
        return channels
          .map((channel) => {
            const v = channel / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, v, i) => sum + v * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);
      };
      const ink = luminance(style.color);
      const fill = luminance(style.backgroundColor);
      setRatio(
        ink === null || fill === null
          ? null
          : (Math.max(ink, fill) + 0.05) / (Math.min(ink, fill) + 0.05),
      );
    };
    const frame = requestAnimationFrame(update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        ref={swatch}
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-md font-bold"
        style={{ color: foreground, backgroundColor: background }}
      >
        Aa
      </span>
      <span className="text-muted-foreground">
        {label}{" "}
        <strong className="font-semibold text-foreground">
          {ratio === null ? "Mengukur…" : `${ratio.toFixed(2)}:1`}
        </strong>
        {ratio !== null && ` · ${ratio >= minimum ? "Lulus" : "Di bawah"} ${minimum}:1`}
      </span>
    </div>
  );
}

export function PrimaryExample() {
  const [count, setCount] = useState(0);
  const id = useId();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={() => setCount((n) => n + 1)}>
          Lanjutkan <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={1.5} aria-hidden />
        </Button>
        <Button disabled>Disabled</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Badge>Aktif</Badge>
        <Badge asChild>
          <a href="#primary">Badge berupa link</a>
        </Badge>
      </div>
      <Field>
        <FieldLabel htmlFor={id}>Selection teks input</FieldLabel>
        <Input id={id} defaultValue="Pilih teks ini untuk membandingkan warnanya" />
      </Field>
      <p role="status" className="text-xs text-muted-foreground">
        Tombol dicoba {count} kali. Hover tombol dan badge, atau pilih teks input.
      </p>
      <ContrastPair
        label="Teks default"
        foreground="var(--primary-foreground)"
        background="var(--primary)"
      />
      <ContrastPair
        label="Teks hover button"
        foreground="var(--primary-foreground)"
        background="var(--primary-hover)"
      />
    </div>
  );
}

export function DestructiveExample({ proposed }: { proposed: boolean }) {
  const [clicked, setClicked] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Button
          variant="destructive"
          data-proposal-solid="destructive"
          onClick={() => setClicked(true)}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.5} aria-hidden />
          Hapus contoh
        </Button>
        <Button variant="destructive" data-proposal-solid="destructive" disabled>
          Disabled
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Badge variant="destructive" data-proposal-solid="destructive">
          Gagal
        </Badge>
        <Badge variant="destructive" data-proposal-solid="destructive" asChild>
          <a href="#destructive">Detail kegagalan</a>
        </Badge>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {clicked
          ? "Contoh aksi berhasil dicoba; tidak ada data yang dihapus."
          : "Teks tetap putih. Hover untuk membandingkan fill."}
      </p>
      <ContrastPair
        label="Teks default"
        foreground="#ffffff"
        background={proposed ? "var(--proposal-destructive-solid)" : "var(--destructive)"}
      />
      {proposed && (
        <ContrastPair
          label="Teks hover"
          foreground="#ffffff"
          background="var(--proposal-destructive-hover)"
        />
      )}
    </div>
  );
}

export function FormExample({ proposed }: { proposed: boolean }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-5">
      <Field>
        <FieldLabel htmlFor={`${id}-name`}>Nama modul</FieldLabel>
        <Input id={`${id}-name`} ref={input} placeholder="Contoh: Tata surya" />
        <FieldDescription>
          Saat fokus: satu border biru dan tint tipis di dalam field.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-notes`}>Catatan</FieldLabel>
        <Textarea id={`${id}-notes`} placeholder="Tulis catatan…" className="min-h-24" />
      </Field>
      <Select defaultValue="id">
        <SelectTrigger aria-label="Bahasa contoh">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={proposed ? styles.proposal : undefined}>
          <SelectItem value="id">Bahasa Indonesia</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center gap-3">
        <Checkbox id={`${id}-agree`} />
        <Label htmlFor={`${id}-agree`}>Checkbox kosong</Label>
      </div>
      <RadioGroup aria-label="Radio kosong">
        <div className="flex items-center gap-3">
          <RadioGroupItem id={`${id}-radio`} value="one" />
          <Label htmlFor={`${id}-radio`}>Radio kosong</Label>
        </div>
      </RadioGroup>
      <Button variant="outline" size="sm" onClick={() => input.current?.focus()}>
        Fokus input
      </Button>
      <ContrastPair
        label="Border terhadap halaman"
        foreground="var(--input)"
        background="var(--background)"
        minimum={3}
      />
      <ContrastPair
        label="Border terhadap popover"
        foreground="var(--input)"
        background="var(--popover)"
        minimum={3}
      />
    </div>
  );
}

export function IndicatorExample({ proposed }: { proposed: boolean }) {
  const [progress, setProgress] = useState(60);
  const id = useId();
  return (
    <div className="space-y-5">
      <Tabs defaultValue="active">
        <TabsList aria-label="Status modul">
          <TabsTrigger value="active">Aktif</TabsTrigger>
          <TabsTrigger value="archive">Arsip</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="pt-3 text-sm">
          Materi yang sedang dipelajari.
        </TabsContent>
        <TabsContent value="archive" className="pt-3 text-sm">
          Materi yang sudah diarsipkan.
        </TabsContent>
      </Tabs>
      <RadioGroup defaultValue="daily" aria-label="Jadwal belajar">
        {["Harian", "Mingguan"].map((label, i) => (
          <div key={label} className="flex items-center gap-3">
            <RadioGroupItem id={`${id}-${i}`} value={i ? "weekly" : "daily"} />
            <Label htmlFor={`${id}-${i}`}>{label}</Label>
          </div>
        ))}
      </RadioGroup>
      <Progress value={progress} aria-label="Kemajuan contoh" />
      <div className="flex items-center gap-3">
        <span className="text-sm">{progress}%</span>
        <Button variant="ghost" size="sm" onClick={() => setProgress((n) => (n + 20) % 120)}>
          Ubah progres
        </Button>
      </div>
      <FieldDescription>
        Hover <a href="#indicators">tautan bantuan ini</a> untuk memeriksa warna teks.
      </FieldDescription>
      <ContrastPair
        label="Teks tab aktif"
        foreground={proposed ? "var(--link)" : "light-dark(var(--primary), var(--link))"}
        background="var(--background)"
      />
      <ContrastPair
        label="Fill progress / track"
        foreground={proposed ? "var(--ring)" : "var(--primary)"}
        background="var(--muted)"
        minimum={3}
      />
    </div>
  );
}

export function CheckboxExample() {
  const id = useId();
  return (
    <div className="space-y-5">
      <div className="grid gap-4">
        {["unchecked", "checked", "indeterminate", "disabled"].map((state) => (
          <div key={state} className="flex items-center gap-3">
            <Checkbox
              id={`${id}-${state}`}
              defaultChecked={state === "indeterminate" ? "indeterminate" : state === "checked"}
              disabled={state === "disabled"}
            />
            <Label htmlFor={`${id}-${state}`}>{state}</Label>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Klik label atau gunakan Space untuk mengganti state. Mixed awal memakai minus pada usulan.
      </p>
      <ContrastPair
        label="Centang terhadap fill"
        foreground="var(--primary-foreground)"
        background="var(--primary)"
        minimum={3}
      />
    </div>
  );
}

export function MenuExample({ proposed }: { proposed: boolean }) {
  const [action, setAction] = useState("Belum ada aksi dipilih.");
  const scope = proposed ? styles.proposal : undefined;
  return (
    <div className="space-y-5">
      <Select defaultValue="module">
        <SelectTrigger aria-label="Jenis bahan contoh">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={scope}>
          <SelectItem value="module">Modul belajar</SelectItem>
          <SelectItem value="notes">Catatan</SelectItem>
          <SelectItem value="disabled" disabled>
            Tidak tersedia
          </SelectItem>
        </SelectContent>
      </Select>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">Menu dengan ikon</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className={scope}>
          <DropdownMenuItem onSelect={() => setAction("Ubah nama dipilih.")}>
            <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={1.5} aria-hidden="true" />
            Ubah nama
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAction("Arsipkan dipilih.")}>
            <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={1.5} aria-hidden="true" />
            Arsipkan
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.5} aria-hidden="true" />
            Tidak tersedia
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="text-xs text-muted-foreground">
        Buka select, lalu sorot option yang memiliki centang. Coba navigasi Arrow ↑ / ↓.
      </p>
      <p role="status" className="text-xs text-muted-foreground">
        {action}
      </p>
      <ContrastPair
        label="Centang option yang fokus"
        foreground="var(--accent-foreground)"
        background="var(--accent)"
        minimum={3}
      />
    </div>
  );
}

export function FeedbackExample({ proposed }: { proposed: boolean }) {
  const id = useId();
  const answer = { optionIndex: 0 };
  const question = "Planet mana yang dikenal sebagai planet biru?";
  const options = ["Mars", "Bumi", "Venus"];
  const explanation = "Bumi tampak biru karena sebagian besar permukaannya tertutup air.";
  return (
    <div className="space-y-5" data-proposal-feedback>
      <Tabs defaultValue="node">
        <TabsList aria-label="Asal feedback">
          <TabsTrigger value="node">Node activity</TabsTrigger>
          <TabsTrigger value="practice">Practice</TabsTrigger>
        </TabsList>
        <TabsContent value="node" className="pt-5">
          <Assessment
            activity={{
              id: `${id}-node`,
              type: "multiple_choice",
              position: 1,
              content: { question, options },
            }}
            answer={answer}
            onAnswer={() => {}}
            readOnly
            result={{
              activityId: `${id}-node`,
              answer,
              correct: false,
              score: 0,
              maxScore: 1,
              explanation,
            }}
          />
        </TabsContent>
        <TabsContent value="practice" className="pt-5">
          <PracticeQuizResultQuestion
            item={{
              id: `${id}-practice`,
              position: 1,
              content: { type: "multiple_choice", question, options },
            }}
            answer={{ type: "multiple_choice", ...answer }}
            result={{ itemId: `${id}-practice`, score: 0, explanation }}
          />
        </TabsContent>
      </Tabs>
      <ContrastPair
        label="Teks terhadap surface error"
        foreground={proposed ? "var(--proposal-error-ink)" : "var(--destructive-subtle-foreground)"}
        background={proposed ? "var(--proposal-error-surface)" : "var(--destructive-subtle)"}
      />
    </div>
  );
}
