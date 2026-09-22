import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ChatAttachment, ChatMention } from "@ngertiin/contracts/api";
import type { JSONContent } from "@tiptap/react";
import { Square } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Button } from "../../../components/ui/button";
import type { TokenResolver } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { draftMentions, hasEditableDraft } from "../chat-draft";
import { useAttachmentUpload } from "./chat-attachment-upload";

const ChatMentionInput = lazy(() =>
  import("./chat-mention-input").then((module) => ({ default: module.ChatMentionInput })),
);

type ChatComposerProps = {
  attachments: ChatAttachment[];
  onAttachmentsChange: (items: ChatAttachment[]) => void;
  draft: string;
  onDraftChange: (value: string, document: JSONContent, mentions: ChatMention[]) => void;
  document?: JSONContent;
  lockedContext?: ChatMention;
  root: readonly unknown[];
  getToken: TokenResolver;
  onSend: () => void;
  className?: string;
  disabled?: boolean;
  fullPage?: boolean;
  active?: boolean;
  cancelling?: boolean;
  onCancel?: () => void;
};

export function ChatComposer({
  attachments,
  onAttachmentsChange,
  draft,
  onDraftChange,
  document,
  lockedContext,
  root,
  getToken,
  onSend,
  className,
  disabled,
  fullPage = false,
  active = false,
  cancelling = false,
  onCancel,
}: ChatComposerProps) {
  const [expanded, setExpanded] = useState(false);
  const upload = useAttachmentUpload(
    attachments,
    onAttachmentsChange,
    getToken,
    Boolean(disabled || active),
  );
  const tooManyMentions = draftMentions(document).length > 8;
  const wide = expanded || tooManyMentions;
  const canSend =
    (hasEditableDraft(document, draft) || attachments.length > 0) &&
    !upload.pending &&
    !disabled &&
    !active &&
    !tooManyMentions;

  return (
    <form
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) event.preventDefault();
      }}
      onDropCapture={(event) => {
        if (event.dataTransfer.files.length) {
          event.preventDefault();
          event.stopPropagation();
          upload.add(Array.from(event.dataTransfer.files));
        }
      }}
      onPasteCapture={(event) => {
        const files = Array.from(event.clipboardData.files).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length) {
          event.preventDefault();
          event.stopPropagation();
          upload.add(files);
        }
      }}
      className={cn("shrink-0 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <div className="rounded-[14px] border border-input/60 bg-background p-1.5 motion-safe:transition-[border-color,box-shadow] focus-within:border-ring/60 focus-within:shadow-md">
        {upload.content}
        <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-end gap-x-1 gap-y-1.5">
          <div className={cn("col-start-1", wide ? "row-start-2" : "row-start-1")}>
            {upload.button}
          </div>
          <Suspense
            fallback={
              <div
                className="col-start-2 row-start-1 truncate py-1.5 text-sm text-muted-foreground"
                role="status"
              >
                Menyiapkan kolom pesan…
              </div>
            }
          >
            <ChatMentionInput
              draft={draft}
              document={document}
              lockedContext={lockedContext}
              onChange={onDraftChange}
              onSend={() => {
                if (canSend) onSend();
              }}
              disabled={disabled || active}
              root={root}
              getToken={getToken}
              fullPage={fullPage}
              onExpandedChange={setExpanded}
              className={wide ? "col-span-full col-start-1 row-start-1" : "col-start-2 row-start-1"}
            />
          </Suspense>
          {wide ? (
            <span
              role={tooManyMentions ? "alert" : undefined}
              className={cn(
                "col-start-2 row-start-2 self-center text-[11px]",
                tooManyMentions ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {tooManyMentions ? "Maksimal 8 konteks per pesan" : "Ketik @ untuk konteks"}
            </span>
          ) : null}
          <div className={cn("col-start-3", wide ? "row-start-2" : "row-start-1")}>
            {active ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                aria-label="Hentikan jawaban"
                title="Hentikan jawaban"
                onClick={onCancel}
                disabled={cancelling}
              >
                <Square className="fill-current" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                className="size-8 rounded-lg bg-foreground text-background shadow-none hover:bg-foreground/85 active:translate-y-0 active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                aria-label="Kirim pesan"
                disabled={!canSend}
              >
                <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={1.8} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
