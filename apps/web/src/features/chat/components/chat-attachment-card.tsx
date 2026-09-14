import { type ChatAttachment, chatAttachmentNote } from "@ngertiin/contracts/api";
import { type ReactElement, useState } from "react";
import type { TokenResolver } from "../../../lib/api";
import { chatApi } from "../api/chat-api";

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
    <div className="my-2 rounded-lg border border-border/60 p-2 text-xs">
      <button
        type="button"
        className="max-w-full truncate underline underline-offset-4"
        onClick={() => void openAttachment()}
      >
        {attachment.filename} ·{" "}
        {attachment.size < 1024 * 1024
          ? `${Math.ceil(attachment.size / 1024)} KB`
          : `${(attachment.size / 1024 / 1024).toFixed(1)} MB`}
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
