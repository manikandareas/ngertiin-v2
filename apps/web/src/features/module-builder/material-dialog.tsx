import { Button } from "../../components/ui/button";
import { DialogFrame } from "../../components/ui/dialog-frame";
import { type AddSourceAction, SourceDialog } from "../sources/source-dialog";
import { MaterialSettings } from "./material-settings";
import type { ModuleBuilderState } from "./use-module-builder";
export type MaterialAction = AddSourceAction | { kind: "settings"; sourceId: string };
type MaterialDialogProps = {
  action: MaterialAction | null;
  state: ModuleBuilderState;
  onClose: () => void;
  returnFocus: () => void;
};
export function MaterialDialog({ action, state, onClose, returnFocus }: MaterialDialogProps) {
  if (action?.kind !== "settings")
    return (
      <SourceDialog
        action={action}
        state={state}
        onClose={onClose}
        returnFocus={returnFocus}
        limitReached={state.count >= 10}
        submitLabel="Tambahkan ke board"
      />
    );
  return (
    <DialogFrame
      open
      title="Atur materi"
      description="Tentukan peran materi dan bagian yang ingin dipelajari."
      busy={state.busy}
      onClose={onClose}
      returnFocus={returnFocus}
      className="builder-controls"
    >
      <fieldset disabled={state.busy} className="space-y-5">
        <MaterialSettings state={state} sourceId={action.sourceId} />
        {state.error ? (
          <p role="alert" className="text-destructive">
            {state.error}
          </p>
        ) : null}
        <div className="flex justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              const item = state.selected.find((item) => item.source.id === action.sourceId);
              if (item) state.toggle(item.source);
              onClose();
            }}
          >
            Lepaskan materi
          </Button>
          <Button onClick={onClose}>Selesai</Button>
        </div>
      </fieldset>
    </DialogFrame>
  );
}
