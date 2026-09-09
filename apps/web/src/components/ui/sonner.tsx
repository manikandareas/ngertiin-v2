import { Check, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "../theme-provider";

const actionButtonClassName =
  "col-start-2 justify-self-start cursor-pointer rounded-lg border border-b-3 border-(--toast-edge) bg-(--toast-badge) px-2.5 py-1.5 text-xs font-black text-(--toast-accent)";

export function Toaster() {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      className="ngertiin-toaster"
      position="bottom-right"
      offset={24}
      mobileOffset={16}
      gap={12}
      visibleToasts={3}
      duration={6000}
      closeButton
      containerAriaLabel="Notifikasi"
      icons={{
        success: <Check size={18} aria-hidden="true" />,
        error: <X size={18} aria-hidden="true" />,
        info: <Info size={18} aria-hidden="true" />,
        warning: <TriangleAlert size={18} aria-hidden="true" />,
        loading: <LoaderCircle size={18} className="motion-safe:animate-spin" aria-hidden="true" />,
        close: <X size={14} aria-hidden="true" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group grid w-(--width) grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5 rounded-2xl border border-b-3 border-(--toast-edge) bg-(--toast-fill) py-4 pr-10 pl-3.5 font-display text-(--toast-ink) shadow-none",
          icon: "grid size-8 place-items-center rounded-xl bg-(--toast-badge) text-(--toast-accent)",
          content: "col-start-2 min-w-0 group-[:not(:has([data-icon]))]:col-span-full",
          title: "pt-0.5 text-sm leading-snug font-black",
          description: "mt-1 text-xs leading-normal font-medium",
          closeButton:
            "absolute top-1 right-1 grid size-7 cursor-pointer place-items-center rounded-lg border-0 p-0",
          actionButton: actionButtonClassName,
          cancelButton: actionButtonClassName,
        },
        closeButtonAriaLabel: "Tutup notifikasi",
      }}
    />
  );
}
