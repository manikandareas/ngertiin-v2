import { chatMentionSchema } from "@ngertiin/contracts/api";
import { Node, type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { LockKeyhole } from "lucide-react";

function MentionChip({ node, deleteNode, editor }: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className="group/mention mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md bg-foreground/5 px-1.5 py-0.5 align-baseline text-[.9em] font-medium text-foreground"
      title={node.attrs.locked ? "Konteks halaman ini · selalu disertakan" : `@${node.attrs.label}`}
    >
      <span className="max-w-56 truncate">@{node.attrs.label}</span>
      {node.attrs.locked ? (
        <span
          role="img"
          className="px-0.5 text-muted-foreground"
          aria-label="Konteks halaman terkunci"
        >
          <LockKeyhole className="size-3" aria-hidden="true" />
        </span>
      ) : (
        <button
          type="button"
          aria-label={`Hapus konteks ${node.attrs.label}`}
          disabled={!editor.isEditable}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover/mention:opacity-100 group-focus-within/mention:opacity-100 [@media(hover:none)]:opacity-100"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (!editor.isEditable || node.attrs.locked) return;
            deleteNode();
            editor.commands.focus();
          }}
        >
          ×
        </button>
      )}
    </NodeViewWrapper>
  );
}

export const ContextMention = Node.create({
  name: "contextMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({
    moduleId: { default: null },
    nodeId: { default: null },
    label: { default: "Modul" },
    locked: { default: false, rendered: false },
  }),
  parseHTML: () => [
    {
      tag: "span[data-context-mention]",
      getAttrs: (element) => {
        const result = chatMentionSchema.safeParse({
          moduleId: element.getAttribute("moduleid"),
          nodeId: element.getAttribute("nodeid") || undefined,
          label: element.getAttribute("label"),
        });
        return result.success ? result.data : false;
      },
    },
  ],
  renderHTML: ({ node, HTMLAttributes }) => [
    "span",
    { ...HTMLAttributes, "data-context-mention": "" },
    `@${node.attrs.label}`,
  ],
  renderText: ({ node }) => `@${node.attrs.label}`,
  addNodeView: () => ReactNodeViewRenderer(MentionChip),
});
