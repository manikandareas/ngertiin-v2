import { type ChatAttachment, chatAttachmentNote } from "@ngertiin/contracts/api";
import { ArrowUpRight } from "lucide-react";
import { type ReactElement, useState } from "react";
import { fileChipClassName } from "../../../components/ui/file-chip";
import type { TokenResolver } from "../../../lib/api";
import { cn } from "../../../lib/utils";
import { chatApi } from "../api/chat-api";
import { ChatFileBadge } from "./chat-file-badge";

type ChatAttachmentCardProps = {
  attachment: ChatAttachment;
  getToken: TokenResolver;
};

export function ChatAttachmentCard({
  attachment,
  getToken,
}: ChatAttachmentCardProps): ReactElement {
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string>();
  const note = chatAttachmentNote(attachment.filename);
  const fileSize =
    attachment.size < 1024 * 1024
      ? `${Math.ceil(attachment.size / 1024)} KB`
      : `${(attachment.size / 1024 / 1024).toFixed(1)} MB`;

  async function openAttachment(): Promise<void> {
    setError("");
    try {
      const { url } = await chatApi(getToken).downloadAttachment(attachment.id);
      if (attachment.mimeType.startsWith("image/")) setPreview(url);
      else {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      }
    } catch {
      setError("Lampiran belum dapat dibuka. Coba lagi.");
    }
  }

  return (
    <div className="my-2 min-w-0 max-w-full text-xs">
      <button
        type="button"
        className={cn(
          fileChipClassName,
          "w-fit max-w-[min(100%,16rem)] cursor-pointer text-left transition-colors hover:bg-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:hover:bg-zinc-700",
        )}
        title={`${attachment.filename} · ${fileSize}`}
        onClick={() => void openAttachment()}
      >
        <ChatFileBadge filename={attachment.filename} />
        <span className="min-w-0 truncate">{attachment.filename}</span>
        <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {preview ? (
        <img
          src={preview}
          alt={attachment.filename}
          className="mt-2 max-h-64 rounded object-contain"
        />
      ) : null}
      {note ? <p className="mt-1 text-muted-foreground">{note}</p> : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
