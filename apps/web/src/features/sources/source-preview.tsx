import type { Source } from "@ngertiin/contracts/api";
import { Tabs } from "radix-ui";
import { DialogFrame } from "../../components/ui/dialog-frame";
import { useSource } from "./api/use-sources";
import { SourceFilePreview } from "./source-file-preview";
import { sourceMetadata, sourceTitle } from "./source-presentation";
import { SourceTextPreview } from "./source-text-preview";

type SourcePreviewProps = { source: Source; onClose: () => void; returnFocus: () => void };
export function SourcePreview({ source: initial, onClose, returnFocus }: SourcePreviewProps) {
  const detail = useSource(initial.id);
  const source = detail.data ?? initial;
  const text = <SourceTextPreview id={source.id} status={source.status} />;
  return (
    <DialogFrame
      open
      title={sourceTitle(source)}
      description={sourceMetadata(source)}
      onClose={onClose}
      returnFocus={returnFocus}
      className="max-w-5xl"
    >
      {source.originalUrl ? (
        <a
          href={source.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 block break-all text-sm text-link underline"
        >
          Buka halaman asli
        </a>
      ) : null}
      {source.status === "failed" ? (
        <p className="mb-3 text-sm text-destructive">{source.failure?.message}</p>
      ) : null}
      {source.type === "pdf" ? (
        <Tabs.Root defaultValue="file">
          <Tabs.List aria-label="Tampilan materi" className="mb-4 flex flex-wrap gap-2">
            <Tabs.Trigger
              value="file"
              className="rounded-lg px-4 py-2 data-[state=active]:bg-secondary"
            >
              Dokumen asli
            </Tabs.Trigger>
            <Tabs.Trigger
              value="text"
              className="rounded-lg px-4 py-2 data-[state=active]:bg-secondary"
            >
              Teks hasil ekstraksi
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="file">
            <SourceFilePreview id={source.id} />
          </Tabs.Content>
          <Tabs.Content value="text">{text}</Tabs.Content>
        </Tabs.Root>
      ) : (
        text
      )}
    </DialogFrame>
  );
}
