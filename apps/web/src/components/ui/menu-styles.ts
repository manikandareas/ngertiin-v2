// Shared Tailwind classes for Radix dropdown, context, and submenu surfaces.
export const menuContentClassName =
  "z-50 min-w-55 max-w-[min(300px,calc(100vw-24px))] max-h-[var(--radix-context-menu-content-available-height,var(--radix-dropdown-menu-content-available-height,360px))] overflow-y-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-md";
export const menuItemClassName =
  "flex min-h-10 cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-caption leading-normal outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";
