import { Add01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { DropdownMenu } from "radix-ui";
import { useRef, useState } from "react";
import { menuContentClassName } from "../../../components/ui/menu-styles";
import { type AddSourceAction, SourceDialog } from "../../sources/source-dialog";
import { SourceMenu } from "../../sources/source-menu";
import { useSaveSource } from "../../sources/use-save-source";
import { useSourceForm } from "../../sources/use-source-form";

export function DashboardAddSource() {
  const [add, setAdd] = useState<AddSourceAction | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const save = useSaveSource();
  const form = useSourceForm(save);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            ref={trigger}
            type="button"
            className="group flex min-h-36 min-w-0 flex-col items-start justify-between gap-5 rounded-[18px] border border-dashed bg-card/40 p-5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:col-span-2 min-[86rem]:col-span-1"
            aria-label="Tambahkan materi"
          >
            <span className="grid size-9 place-items-center rounded-xl border bg-card text-muted-foreground">
              <HugeiconsIcon icon={Add01Icon} size={22} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span>
              <span className="block font-display text-base font-extrabold">
                Rasa penasaran baru?
              </span>
              <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                Tambahkan PDF, tautan, atau catatan untuk perjalanan belajar berikutnya.
              </span>
            </span>
            <span className="inline-flex items-center gap-2 text-xs font-bold text-link">
              Tambah materi <HugeiconsIcon icon={ArrowRight01Icon} size={16} aria-hidden="true" />
            </span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={menuContentClassName}
            align="start"
            collisionPadding={16}
            onCloseAutoFocus={(event) => {
              if (add) event.preventDefault();
            }}
          >
            <SourceMenu menu="dropdown" open={setAdd} disabled={form.busy} />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <SourceDialog
        action={add}
        state={form}
        onClose={() => setAdd(null)}
        returnFocus={() => trigger.current?.focus()}
      />
    </>
  );
}
