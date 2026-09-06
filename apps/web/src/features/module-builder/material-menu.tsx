import {
  ArrowRight01Icon,
  File01Icon,
  LibraryIcon,
  Link01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ContextMenu, DropdownMenu } from "radix-ui";
import type { MaterialLibrary } from "./material-board";
import type { MaterialAction } from "./material-dialog";

export function MaterialMenu({
  menu,
  library,
  open,
  disabled,
}: {
  menu: "context" | "dropdown";
  library: MaterialLibrary;
  open: (action: MaterialAction) => void;
  disabled: boolean;
}) {
  const Menu = menu === "context" ? ContextMenu : DropdownMenu;
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
          className="material-menu-item"
          disabled={disabled}
          onSelect={() => open({ kind })}
        >
          <HugeiconsIcon icon={icon} size={17} strokeWidth={1.5} aria-hidden="true" />
          {label}
        </Menu.Item>
      ))}
      <Menu.Separator className="my-1 h-px bg-muted" />
      <Menu.Sub>
        <Menu.SubTrigger className="material-menu-item" disabled={disabled}>
          <HugeiconsIcon icon={LibraryIcon} size={17} strokeWidth={1.5} aria-hidden="true" />
          Materi saya
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="ml-auto" aria-hidden="true" />
        </Menu.SubTrigger>
        <Menu.Portal>
          <Menu.SubContent className="material-menu" sideOffset={6}>
            {library(menu)}
          </Menu.SubContent>
        </Menu.Portal>
      </Menu.Sub>
    </>
  );
}
