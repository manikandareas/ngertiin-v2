import { Add01Icon, Attachment01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "../components/theme-provider";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../components/ui/collapsible";
import { DialogFrame } from "../components/ui/dialog-frame";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "../components/ui/field";
import { fileChipClassName } from "../components/ui/file-chip";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { ColorTokens } from "../features/design-system/color-tokens";
import { QuizExamples } from "../features/design-system/quiz-examples";

const sections = [
  ["colors", "Warna"],
  ["type", "Tipografi"],
  ["buttons", "Button & badge"],
  ["forms", "Form"],
  ["quiz", "Quiz"],
  ["surfaces", "Surface & navigasi"],
  ["overlays", "Overlay & feedback"],
] as const;
const variants = ["default", "outline", "secondary", "ghost", "link", "destructive"] as const;
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-40 border-t py-10">
      <h2 className="mb-7 font-display text-heading-sm font-extrabold">{title}</h2>
      {children}
    </section>
  );
}
function Example({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-4">
      <h3 className="text-sm font-bold text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
export default function DesignSystemPage() {
  const { theme, setTheme } = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialogTrigger = useRef<HTMLButtonElement>(null);
  const [progress, setProgress] = useState(60);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <a href="#top" className="font-display text-lg font-extrabold">
            Ngerti.in{" "}
            <span className="font-sans text-sm font-medium text-muted-foreground">
              / Design system
            </span>
          </a>
          <div className="flex gap-2">
            {(["light", "dark"] as const).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={theme === mode ? "secondary" : "ghost"}
                aria-pressed={theme === mode}
                onClick={() => setTheme(mode)}
              >
                {mode}
              </Button>
            ))}
          </div>
        </div>
        <nav
          aria-label="Bagian design system"
          className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-5 pb-3 text-sm sm:px-8"
        >
          {sections.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="shrink-0 text-muted-foreground hover:text-link focus-visible:outline-ring"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>
      <main id="top" className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="py-10">
          <p className="mb-2 text-sm text-muted-foreground">Referensi tampilan aplikasi saat ini</p>
          <h1 className="font-display text-heading font-extrabold">Design system</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Token asli dan seluruh 18 primitive UI aplikasi. Ganti light / dark, lalu coba hover,
            fokus keyboard, pilihan, dan overlay untuk memeriksa warnanya.
          </p>
        </div>
        <Section id="colors" title="Warna">
          <ColorTokens />
        </Section>
        <Section id="type" title="Tipografi & bentuk">
          <div className="grid gap-8 md:grid-cols-2">
            <Example title="Nunito · display">
              {[
                ["text-display", "Display · 48"],
                ["text-heading", "Heading · 36"],
                ["text-heading-sm", "Heading small · 24"],
              ].map(([style, label]) => (
                <p key={style} className={`font-display font-extrabold ${style}`}>
                  {label}
                </p>
              ))}
            </Example>
            <Example title="Nunito Sans · teks antarmuka">
              <p className="text-subheading">Subheading · 18 px</p>
              <p className="text-body">Body · 16 px. Belajar sedikit, pahami lebih banyak.</p>
              <p className="text-nav-label">Nav label · 14 px</p>
              <p className="text-caption text-muted-foreground">Caption · 13 px</p>
              <div className="flex flex-wrap gap-3">
                {["button", "card", "radius"].map((name) => (
                  <div
                    key={name}
                    className="border-2 bg-muted p-4 text-xs"
                    style={{
                      borderRadius: `var(--${name === "radius" ? "radius" : `${name}-radius`})`,
                    }}
                  >
                    {name} · {name === "button" ? "16" : name === "card" ? "20" : "12"} px
                  </div>
                ))}
              </div>
            </Example>
          </div>
        </Section>
        <Section id="buttons" title="Button & badge">
          <div className="space-y-8">
            <Example title="Button · semua variant, normal & disabled">
              <div className="flex flex-wrap gap-4">
                {variants.map((variant) => (
                  <div key={variant} className="flex flex-col gap-4">
                    <Button variant={variant}>{variant}</Button>
                    <Button variant={variant} disabled>
                      {variant}
                    </Button>
                  </div>
                ))}
              </div>
            </Example>
            <Example title="Button · ukuran & loading">
              <div className="flex flex-wrap items-center gap-4">
                <Button size="sm">Small</Button>
                <Button>Default</Button>
                <Button size="lg">Large</Button>
                <Button size="icon" aria-label="Tambah">
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={1.5} aria-hidden="true" />
                </Button>
                <Button disabled>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    strokeWidth={1.5}
                    aria-hidden="true"
                    className="motion-safe:animate-spin"
                  />
                  Memuat
                </Button>
              </div>
            </Example>
            <Example title="Badge · semua variant">
              <div className="flex flex-wrap gap-3">
                {variants.map((variant) => (
                  <Badge variant={variant} key={variant}>
                    {variant}
                  </Badge>
                ))}
              </div>
            </Example>
          </div>
        </Section>
        <Section id="forms" title="Form">
          <div className="grid gap-10 md:grid-cols-2">
            <FieldSet>
              <FieldLegend>Input, label & field</FieldLegend>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="ds-name">Nama modul</FieldLabel>
                  <Input id="ds-name" placeholder="Contoh: Sistem tata surya" />
                  <FieldDescription>Input default dengan placeholder.</FieldDescription>
                </Field>
                <Field data-invalid>
                  <FieldLabel htmlFor="ds-invalid">Input invalid</FieldLabel>
                  <Input
                    id="ds-invalid"
                    aria-invalid
                    aria-describedby="ds-error"
                    defaultValue="Contoh nilai salah"
                  />
                  <FieldError id="ds-error">
                    Pesan validasi menggunakan warna destructive.
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="ds-disabled">Input disabled</FieldLabel>
                  <Input id="ds-disabled" disabled defaultValue="Tidak tersedia" />
                </Field>
                <FieldSeparator>Textarea</FieldSeparator>
                <Field>
                  <FieldLabel htmlFor="ds-notes">Catatan</FieldLabel>
                  <Textarea id="ds-notes" placeholder="Tulis catatan belajar…" />
                </Field>
                <Textarea disabled aria-label="Textarea disabled" placeholder="Tidak tersedia" />
              </FieldGroup>
            </FieldSet>
            <div className="space-y-8">
              <Example title="Select">
                <Select defaultValue="id">
                  <SelectTrigger aria-label="Bahasa">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="id">Bahasa Indonesia</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="disabled" disabled>
                      Segera hadir
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select disabled>
                  <SelectTrigger aria-label="Select disabled">
                    <SelectValue placeholder="Tidak tersedia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak tersedia</SelectItem>
                  </SelectContent>
                </Select>
              </Example>
              <Example title="Checkbox & label">
                {["unchecked", "checked", "indeterminate", "disabled"].map((state) => (
                  <div key={state} className="flex items-center gap-3">
                    <Checkbox
                      id={`check-${state}`}
                      defaultChecked={
                        state === "indeterminate" ? "indeterminate" : state === "checked"
                      }
                      disabled={state === "disabled"}
                    />
                    <Label htmlFor={`check-${state}`}>{state}</Label>
                  </div>
                ))}
              </Example>
              <Example title="Radio group">
                <RadioGroup defaultValue="daily" aria-label="Frekuensi belajar">
                  {[
                    ["daily", "Setiap hari"],
                    ["weekly", "Setiap minggu"],
                    ["disabled", "Tidak tersedia"],
                  ].map(([value, label]) => (
                    <div key={value} className="flex items-center gap-3">
                      <RadioGroupItem
                        value={value}
                        id={`radio-${value}`}
                        disabled={value === "disabled"}
                      />
                      <Label htmlFor={`radio-${value}`}>{label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </Example>
              <Field orientation="horizontal">
                <Checkbox id="ds-reminder" />
                <FieldContent>
                  <FieldLabel htmlFor="ds-reminder">
                    <FieldTitle>Pengingat belajar</FieldTitle>
                  </FieldLabel>
                  <FieldDescription>Field horizontal dengan deskripsi.</FieldDescription>
                </FieldContent>
              </Field>
            </div>
          </div>
        </Section>
        <Section id="quiz" title="Quiz">
          <QuizExamples />
        </Section>
        <Section id="surfaces" title="Surface & navigasi">
          <div className="grid gap-10 md:grid-cols-2">
            <Example title="Card">
              <Card>
                <CardHeader>
                  <CardTitle>Sistem tata surya</CardTitle>
                  <CardDescription>Contoh surface kartu aplikasi.</CardDescription>
                  <CardAction>
                    <Badge variant="secondary">Aktif</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p>Konten menggunakan card-foreground.</p>
                </CardContent>
                <CardFooter>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info("Contoh aksi kartu")}
                  >
                    Pelajari
                  </Button>
                </CardFooter>
              </Card>
            </Example>
            <div className="space-y-8">
              <Example title="Tabs">
                <Tabs defaultValue="active">
                  <TabsList aria-label="Status modul">
                    <TabsTrigger value="active">Aktif</TabsTrigger>
                    <TabsTrigger value="archive">Arsip</TabsTrigger>
                    <TabsTrigger value="disabled" disabled>
                      Disabled
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="active" className="pt-4">
                    Modul yang sedang dipelajari.
                  </TabsContent>
                  <TabsContent value="archive" className="pt-4">
                    Modul yang telah diarsipkan.
                  </TabsContent>
                </Tabs>
              </Example>
              <Example title="Collapsible">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm">
                      Buka / tutup detail
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 text-muted-foreground">
                    Konten tambahan yang dapat dilipat.
                  </CollapsibleContent>
                </Collapsible>
              </Example>
              <Example title="Separator">
                <p className="text-sm">Horizontal</p>
                <Separator />
                <div className="flex h-6 items-center gap-4 text-sm">
                  Kiri
                  <Separator orientation="vertical" />
                  Kanan
                </div>
              </Example>
              <Example title="File chip · shared style">
                <span className={fileChipClassName}>
                  <HugeiconsIcon icon={Attachment01Icon} strokeWidth={1.5} size={14} aria-hidden />
                  Catatan belajar.pdf
                </span>
              </Example>
            </div>
          </div>
          <div className="app-sidebar-surface mt-8 rounded-card border border-border bg-background p-6 text-foreground">
            <p className="font-bold">Sidebar surface</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Surface charcoal yang digunakan sidebar pada kedua mode.
            </p>
            <div className="mt-4 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
              Item navigasi aktif
            </div>
          </div>
        </Section>
        <Section id="overlays" title="Overlay & feedback">
          <div className="grid gap-10 md:grid-cols-2">
            <Example title="Dropdown menu · shared menu styles">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Buka menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Aksi modul</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => toast.info("Contoh aksi ubah")}>
                    Ubah nama
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>Tidak tersedia</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => toast.success("Contoh aksi arsip")}>
                    Arsipkan
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Example>
            <Example title="Dialog frame & drawer">
              <div className="flex flex-wrap gap-4">
                <Button
                  variant="outline"
                  onClick={(event) => {
                    dialogTrigger.current = event.currentTarget;
                    setDialogOpen(true);
                  }}
                >
                  Buka dialog
                </Button>
                <Drawer>
                  <DrawerTrigger asChild>
                    <Button variant="outline">Buka drawer</Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Contoh drawer</DrawerTitle>
                      <DrawerDescription>
                        Surface, overlay, dan teks dari primitive asli.
                      </DrawerDescription>
                    </DrawerHeader>
                    <DrawerFooter>
                      <DrawerClose asChild>
                        <Button>Tutup drawer</Button>
                      </DrawerClose>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              </div>
              <DialogFrame
                open={dialogOpen}
                title="Contoh dialog"
                description="Periksa surface, teks, overlay, dan fokus keyboard."
                onClose={() => setDialogOpen(false)}
                returnFocus={() => dialogTrigger.current?.focus()}
              >
                <Button onClick={() => setDialogOpen(false)}>Selesai</Button>
              </DialogFrame>
            </Example>
            <Example title="Progress">
              <Progress value={progress} aria-label="Kemajuan belajar" />
              <div className="flex items-center gap-4">
                <span className="text-sm">{progress}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setProgress((value) => (value + 20) % 120)}
                >
                  Ubah progres
                </Button>
              </div>
            </Example>
            <Example title="Sonner · semua status">
              <div className="flex flex-wrap gap-3">
                {(["success", "error", "info", "warning", "loading"] as const).map((status) => (
                  <Button
                    key={status}
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const id = toast[status](`Notifikasi ${status}`, {
                        description: "Contoh pesan dari aplikasi.",
                        action: { label: "Tutup", onClick: () => toast.dismiss(id) },
                        duration: 6000,
                      });
                    }}
                  >
                    {status}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    toast("Notifikasi default", { description: "Pesan tanpa status khusus." })
                  }
                >
                  Default
                </Button>
              </div>
            </Example>
          </div>
        </Section>
      </main>
    </div>
  );
}
