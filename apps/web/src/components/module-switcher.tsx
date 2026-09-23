import { BookOpen01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeftRight, ArrowUpRight, Plus, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelectCurrentModule } from "../features/current-user/api/use-select-current-module";
import { useModules } from "../features/modules/api/use-modules";
import { Button } from "./ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./ui/drawer";
import { Input } from "./ui/input";

const updatedDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function ModuleSwitcher({
  collapsed,
  selectedId,
  title,
  imageUrl,
  onNavigate,
}: {
  collapsed: boolean;
  selectedId?: string;
  title: string;
  imageUrl?: string | null;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => {
      setDesktop(media.matches);
      setOpen(false);
      setQuery("");
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const changeOpen = (value: boolean) => {
    setOpen(value);
    if (!value) setQuery("");
  };
  const close = () => {
    changeOpen(false);
    onNavigate?.();
  };

  const trigger = (
    <button
      type="button"
      aria-label={`Ganti modul: ${title}`}
      title={collapsed ? title : undefined}
      className={`flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-xl bg-muted text-sidebar-foreground transition-colors hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${collapsed ? "justify-center" : "px-2.5 py-1.5"}`}
    >
      <ModuleGlyph imageUrl={imageUrl} />
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">
            {title}
          </span>
          <ArrowLeftRight className="size-4 shrink-0" aria-hidden="true" />
        </>
      ) : null}
    </button>
  );
  const contents = (
    <>
      <div className="relative shrink-0">
        <HugeiconsIcon
          icon={Search01Icon}
          size={16}
          strokeWidth={1.5}
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Cari modul"
          maxLength={500}
          placeholder="Cari modul…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 border bg-muted pl-8 text-base xl:h-9 xl:text-[13px]"
        />
      </div>
      <ModuleOptions query={query} selectedId={selectedId} onNavigate={close} />
      <div className="my-1 shrink-0 border-t" />
      <Link
        to="/modules"
        onClick={close}
        className="flex min-h-11 xl:min-h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
        Lihat semua
      </Link>
      <Link
        to="/modules/new"
        onClick={close}
        className="flex min-h-11 xl:min-h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-[13px] hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Plus className="size-4 text-muted-foreground" aria-hidden="true" />
        Buat baru
      </Link>
    </>
  );
  return (
    <>
      {desktop ? (
        <Popover.Root open={open} onOpenChange={changeOpen}>
          <Popover.Trigger asChild>{trigger}</Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              aria-label="Pilih modul"
              side="right"
              align="start"
              sideOffset={6}
              collisionPadding={12}
              className="z-50 flex max-h-[var(--radix-popover-content-available-height)] w-72 max-w-[min(calc(100vw-24px),var(--radix-popover-content-available-width))] flex-col overflow-hidden rounded-xl border bg-popover p-2 text-popover-foreground shadow-md"
            >
              {contents}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : (
        <Drawer open={open} onOpenChange={changeOpen} shouldScaleBackground={false}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent
            aria-describedby={undefined}
            className="overflow-hidden bg-popover text-popover-foreground data-[vaul-drawer-direction=bottom]:max-h-[85dvh]"
          >
            <DrawerHeader className="relative mx-auto w-full max-w-lg shrink-0 py-3 pr-14 text-left">
              <DrawerTitle>Pilih modul</DrawerTitle>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Tutup pilihan modul"
                  className="absolute right-2 top-1 size-11"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </DrawerClose>
            </DrawerHeader>
            <div className="mx-auto flex min-h-0 w-full max-w-lg flex-col overflow-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {contents}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}

function ModuleGlyph({ imageUrl }: { imageUrl?: string | null }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary text-secondary-foreground">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <HugeiconsIcon icon={BookOpen01Icon} size={18} strokeWidth={1.5} aria-hidden="true" />
      )}
    </span>
  );
}

function ModuleOptions({
  query,
  selectedId,
  onNavigate,
}: {
  query: string;
  selectedId?: string;
  onNavigate: () => void;
}) {
  const modules = useModules(query.trim() ? { q: query.trim() } : {});
  const select = useSelectCurrentModule();
  const items = modules.data?.pages[0]?.data.slice(0, 6) ?? [];
  return (
    <div className="min-h-0 overflow-y-auto overscroll-contain py-1">
      {modules.isPending ? (
        <p role="status" className="px-2.5 py-3 text-[13px] text-muted-foreground">
          Memuat modul…
        </p>
      ) : null}
      {modules.isError ? (
        <div role="alert" className="px-2.5 py-2 text-[13px]">
          Modul belum dapat dimuat.
          <Button variant="link" size="sm" onClick={() => void modules.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : null}
      {!modules.isPending && !modules.isError && !items.length ? (
        <p className="px-2.5 py-3 text-[13px] text-muted-foreground">
          {query ? "Tidak ada modul yang cocok." : "Belum ada modul."}
        </p>
      ) : null}
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.status === "ready" ? `/modules/${item.id}/journey` : `/modules/${item.id}`}
          onClick={() => {
            select.mutate(item.id);
            onNavigate();
          }}
          aria-current={item.id === selectedId ? "page" : undefined}
          className="flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted aria-[current=page]:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ModuleGlyph imageUrl={item.imageUrl} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium leading-4">
              {item.title ?? "Modul belajar"}
            </span>
            <time
              dateTime={item.updatedAt}
              className="block text-[11px] leading-4 text-muted-foreground"
            >
              Diperbarui {updatedDate.format(new Date(item.updatedAt))}
            </time>
          </span>
        </Link>
      ))}
    </div>
  );
}
