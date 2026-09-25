import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "../../../components/ui/button";
import type { InteractionInput } from "./chat-interaction-types";

type ChatInteractionComposerProps = {
  input: InteractionInput;
};

export function ChatInteractionComposer({ input }: ChatInteractionComposerProps) {
  const canSend = Boolean(input.value.trim()) && !input.disabled;

  return (
    <form
      className="pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) input.onSend();
      }}
    >
      <div className="rounded-[14px] border border-input/60 bg-background p-1.5 motion-safe:transition-[border-color,box-shadow] focus-within:border-ring/60 focus-within:shadow-md">
        <div className="grid grid-cols-[minmax(0,1fr)_2rem] items-end gap-x-1 gap-y-1.5">
          <textarea
            aria-label={input.placeholder}
            placeholder={input.placeholder}
            value={input.value}
            onChange={(event) => input.onChange(event.target.value)}
            disabled={input.disabled}
            maxLength={input.maxLength}
            rows={1}
            className="min-h-8 max-h-40 w-full resize-none overflow-y-auto [field-sizing:content] bg-transparent px-2 py-1.5 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:opacity-60"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (canSend) input.onSend();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="size-8 rounded-lg bg-foreground text-background shadow-none hover:bg-foreground/85 active:translate-y-0 active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            aria-label={input.label}
            disabled={!canSend}
          >
            <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </form>
  );
}
