import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ChatAttachment, ChatMention } from "@ngertiin/contracts/api";
import type { JSONContent } from "@tiptap/react";
import { Square } from "lucide-react";
import { lazy, Suspense } from "react";
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
  const upload = useAttachmentUpload(
    attachments,
    onAttachmentsChange,
    getToken,
    Boolean(disabled || active),
  );
  const tooManyMentions = draftMentions(document).length > 8;
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
      <div
        className={
          fullPage
            ? "rounded-card border border-input/60 bg-background p-3 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring"
            : "rounded-card border bg-muted p-2.5 focus-within:border-input"
        }
      >
        {upload.content}
        <Suspense
          fallback={
            <div className="min-h-16 py-2 text-sm text-muted-foreground" role="status">
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
          />
        </Suspense>
        <div className="flex items-center justify-between gap-2">
          {upload.button}
          <span
            role={tooManyMentions ? "alert" : undefined}
            className="flex-1 text-[10px] text-muted-foreground"
          >
            {tooManyMentions ? "Maksimal 8 konteks per pesan" : "Ketik @ untuk konteks"}
          </span>
          {active ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive",
                fullPage ? "size-10" : "size-8",
              )}
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
              className={cn(
                "rounded-full shadow-none disabled:text-muted-foreground",
                fullPage ? "size-10 disabled:bg-muted" : "size-8 disabled:bg-border",
              )}
              aria-label="Kirim pesan"
              disabled={!canSend}
            >
              <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={1.8} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
