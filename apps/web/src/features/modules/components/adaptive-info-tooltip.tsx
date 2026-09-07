import { Info } from "lucide-react";
import { Tooltip } from "radix-ui";
import { useState } from "react";

export function AdaptiveInfoTooltip() {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root open={tooltipOpen} onOpenChange={setTooltipOpen}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            aria-label="Tentang penguatan adaptif"
            className="relative z-10 -my-2 inline-grid size-8 shrink-0 place-items-center rounded-full text-adaptive-foreground hover:bg-adaptive-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onClick={(event) => {
              event.preventDefault();
              setTooltipOpen(!tooltipOpen);
            }}
          >
            <Info className="size-4" aria-hidden="true" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={8}
            collisionPadding={16}
            className="z-50 max-w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover px-4 py-3 text-sm leading-6 text-popover-foreground shadow-md"
          >
            Penguatan adaptif adalah materi tambahan opsional yang disesuaikan dengan hasil
            assessment untuk melatih konsep yang belum mantap. Node ini tidak menambah persentase
            progres perjalanan utama.
            <Tooltip.Arrow className="fill-popover" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
