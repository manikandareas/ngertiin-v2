import type { Source } from "@ngertiin/contracts/api";
import { ContextMenu, DropdownMenu } from "radix-ui";
import { menuItemClassName } from "../../components/ui/menu-styles";
export type SourceAction = { source: Source; kind: "rename" | "archive" };
export function SourceActionItems({
  menu,
  source,
  onAction,
}: {
  menu: "context" | "dropdown";
  source: Source;
  onAction: (action: SourceAction) => void;
}) {
  const Menu = menu === "context" ? ContextMenu : DropdownMenu;
  return (
    <>
      <Menu.Item
        className={menuItemClassName}
        onSelect={() => onAction({ source, kind: "rename" })}
      >
        Ubah judul
      </Menu.Item>
      <Menu.Item
        className={menuItemClassName}
        onSelect={() => onAction({ source, kind: "archive" })}
      >
        {source.archivedAt ? "Pulihkan" : "Arsipkan"}
      </Menu.Item>
    </>
  );
}
