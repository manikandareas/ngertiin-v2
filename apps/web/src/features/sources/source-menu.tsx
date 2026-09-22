import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  File01Icon,
  LibraryIcon,
  Link01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ContextMenu, DropdownMenu } from "radix-ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { menuContentClassName, menuItemClassName } from "../../components/ui/menu-styles";
import type { AddSourceAction } from "./source-dialog";

export function SourceMenu({
  menu,
  library,
  open,
  disabled,
}: {
  menu: "context" | "dropdown";
  library?: (menu: "context" | "dropdown") => ReactNode;
  open: (action: AddSourceAction) => void;
  disabled: boolean;
}) {
  const Menu = menu === "context" ? ContextMenu : DropdownMenu;
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  const [showLibrary, setShowLibrary] = useState(false);
  const libraryTrigger = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLDivElement>(null);
  const returnToLibrary = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (compact && showLibrary) back.current?.focus();
    else if (returnToLibrary.current) {
      libraryTrigger.current?.focus();
      returnToLibrary.current = false;
    }
  }, [compact, showLibrary]);
  if (compact && showLibrary && library) {
    return (
      <>
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center">
          <Menu.Item
            ref={back}
            aria-label="Kembali"
            className={`${menuItemClassName} size-11 shrink-0 justify-center p-0`}
            onSelect={(event) => {
              event.preventDefault();
              returnToLibrary.current = true;
              setShowLibrary(false);
            }}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={20} strokeWidth={1.5} aria-hidden="true" />
          </Menu.Item>
          <Menu.Label className="py-2 text-center text-sm font-semibold">Materi saya</Menu.Label>
        </div>
        {library(menu)}
      </>
    );
  }
  return (
    <>
      <Menu.Label className="px-3 py-2 text-xs text-muted-foreground">Tambahkan materi</Menu.Label>
      {(
        [
          ["url", "Tautan halaman", Link01Icon],
          ["text", "Tulis teks", File01Icon],
          ["pdf", "Upload PDF", Upload01Icon],
        ] as const
      ).map(([kind, label, icon]) => (
        <Menu.Item
          key={kind}
          className={menuItemClassName}
          disabled={disabled}
          onSelect={() => open({ kind })}
        >
          <HugeiconsIcon icon={icon} size={17} strokeWidth={1.5} aria-hidden="true" />
          {label}
        </Menu.Item>
      ))}
      {library ? (
        <>
          <Menu.Separator className="my-1 h-px bg-muted" />
          {compact ? (
            <Menu.Item
              ref={libraryTrigger}
              className={menuItemClassName}
              disabled={disabled}
              onSelect={(event) => {
                event.preventDefault();
                setShowLibrary(true);
              }}
            >
              <HugeiconsIcon icon={LibraryIcon} size={17} strokeWidth={1.5} aria-hidden="true" />
              Materi saya
              <span className="ml-auto" aria-hidden="true">
                →
              </span>
            </Menu.Item>
          ) : (
            <Menu.Sub>
              <Menu.SubTrigger className={menuItemClassName} disabled={disabled}>
                <HugeiconsIcon icon={LibraryIcon} size={17} strokeWidth={1.5} aria-hidden="true" />
                Materi saya
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={14}
                  className="ml-auto"
                  aria-hidden="true"
                />
              </Menu.SubTrigger>
              <Menu.Portal>
                <Menu.SubContent
                  className={`${menuContentClassName} w-60`}
                  sideOffset={6}
                  collisionPadding={12}
                >
                  {library(menu)}
                </Menu.SubContent>
              </Menu.Portal>
            </Menu.Sub>
          )}
        </>
      ) : null}
    </>
  );
}
