import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { DialogFrame } from "../../../components/ui/dialog-frame";

type ChatCitationFrameProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  returnFocus: () => void;
};

export function ChatCitationFrame({
  title,
  children,
  onClose,
  returnFocus,
}: ChatCitationFrameProps) {
  const [desktop, setDesktop] = useState(() => matchMedia("(min-width: 1280px)").matches);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    const media = matchMedia("(min-width: 1280px)");
    const update = () => setDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (desktop) close.current?.focus();
  }, [desktop]);
  if (!desktop)
    return (
      <DialogFrame
        open
        title={title}
        description="Materi saat jawaban dibuat · bagian yang digunakan disorot."
        onClose={onClose}
        returnFocus={returnFocus}
        className="inset-y-0 left-auto right-0 h-dvh max-h-dvh w-full max-w-md translate-x-0 translate-y-0 rounded-none"
      >
        {children}
      </DialogFrame>
    );
  return (
    <aside
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          returnFocus();
        }
      }}
      className="flex h-full w-96 shrink-0 flex-col overflow-y-auto overscroll-contain border-l bg-background p-6"
    >
      <header className="mb-5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-lg font-bold break-words">
            {title}
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Materi saat jawaban dibuat · bagian yang digunakan disorot.
          </p>
        </div>
        <button
          ref={close}
          type="button"
          aria-label="Tutup materi rujukan"
          className="size-8 shrink-0 rounded-lg text-xl hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => {
            onClose();
            returnFocus();
          }}
        >
          ×
        </button>
      </header>
      {children}
    </aside>
  );
}
