// Shared Tailwind classes for Radix dropdown, context, and submenu surfaces.
export const menuContentClassName =
  "z-50 min-w-[min(220px,calc(100vw-24px),var(--radix-popper-available-width,300px))] max-w-[min(300px,calc(100vw-24px),var(--radix-popper-available-width,300px))] max-h-[min(calc(100dvh-24px),var(--radix-popper-available-height,360px))] overflow-y-auto overscroll-contain rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-md";
export const menuItemClassName =
  "flex min-h-11 cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-caption leading-normal outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";
