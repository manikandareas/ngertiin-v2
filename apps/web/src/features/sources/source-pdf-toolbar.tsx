import { ChevronLeft, ChevronRight, Maximize, Minus, Plus } from "lucide-react";
import { Button } from "../../components/ui/button";

const toolbarButtonClassName =
  "size-8 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground motion-safe:active:scale-90";

type SourcePdfToolbarProps = {
  page: number;
  pages: number;
  zoom: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
};

export function SourcePdfToolbar({
  page,
  pages,
  zoom,
  onPageChange,
  onZoomChange,
}: SourcePdfToolbarProps) {
  return (
    <div
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-0.5 rounded-full border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur-xl"
      role="toolbar"
      aria-label="Navigasi PDF"
    >
      <Button
        variant="ghost"
        size="icon"
        className={toolbarButtonClassName}
        aria-label="Halaman sebelumnya"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={18} />
      </Button>
      <label className="flex h-8 items-center gap-1 rounded-full bg-primary/10 px-2 text-xs font-bold tabular-nums text-primary">
        <span className="sr-only">Nomor halaman</span>
        <input
          key={page}
          type="number"
          min={1}
          max={pages}
          defaultValue={page}
          className="h-7 w-8 appearance-none rounded-md bg-transparent text-center outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
          onBlur={(event) => {
            const next = Number(event.target.value);
            if (Number.isInteger(next) && next >= 1 && next <= pages) onPageChange(next);
            else event.target.value = String(page);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        <span>/ {pages}</span>
      </label>
      <Button
        variant="ghost"
        size="icon"
        className={toolbarButtonClassName}
        aria-label="Halaman berikutnya"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight size={18} />
      </Button>
      <span className="mx-1 h-4 w-px bg-border" />
      <Button
        variant="ghost"
        size="icon"
        className={toolbarButtonClassName}
        aria-label="Perkecil PDF"
        disabled={zoom <= 0.5}
        onClick={() => onZoomChange(Math.max(0.5, zoom - 0.25))}
      >
        <Minus size={18} />
      </Button>
      <output
        className="w-9 text-center text-[11px] font-semibold tabular-nums text-muted-foreground"
        aria-label="Skala PDF"
      >
        {Math.round(zoom * 100)}%
      </output>
      <Button
        variant="ghost"
        size="icon"
        className={toolbarButtonClassName}
        aria-label="Perbesar PDF"
        disabled={zoom >= 3}
        onClick={() => onZoomChange(Math.min(3, zoom + 0.25))}
      >
        <Plus size={18} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={toolbarButtonClassName}
        aria-label="Sesuaikan lebar"
        title="Sesuaikan lebar"
        onClick={() => {
          onZoomChange(1);
        }}
      >
        <Maximize size={18} />
      </Button>
    </div>
  );
}
