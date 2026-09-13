import type { ChatMention } from "@ngertiin/contracts/api";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Extension } from "@tiptap/react";

export const lockedContextKey = new PluginKey("chatLockedContext");

/** Restore the page-owned token after edits without discarding the user's text/selection. */
export function lockedContextExtension(getContext: () => ChatMention | undefined) {
  return Extension.create({
    name: "lockedContext",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: lockedContextKey,
          appendTransaction(transactions, _oldState, state) {
            if (
              !transactions.some(
                (transaction) => transaction.docChanged || transaction.getMeta(lockedContextKey),
              )
            )
              return null;
            const context = getContext();
            const mentionType = state.schema.nodes.contextMention;
            if (!mentionType) return null;
            const transaction = state.tr;
            const removals: { from: number; to: number }[] = [];
            let present = false;
            state.doc.descendants((node, position) => {
              if (node.type.name !== "contextMention") return;
              if (!context) {
                if (node.attrs.locked)
                  transaction.setNodeMarkup(position, undefined, { ...node.attrs, locked: false });
                return;
              }
              const matches =
                node.attrs.moduleId === context.moduleId &&
                (node.attrs.nodeId ?? undefined) === context.nodeId;
              if (position === 1 && matches) {
                present = true;
                if (!node.attrs.locked || node.attrs.label !== context.label)
                  transaction.setNodeMarkup(position, undefined, { ...context, locked: true });
              } else if (node.attrs.locked || matches)
                removals.push({ from: position, to: position + node.nodeSize });
            });
            for (const range of removals.reverse()) transaction.delete(range.from, range.to);
            if (context && !present)
              transaction.insert(1, mentionType.create({ ...context, locked: true }));
            if (context && transaction.doc.textBetween(2, 3) !== " ")
              transaction.insertText(" ", 2);
            return transaction.docChanged ? transaction : null;
          },
        }),
      ];
    },
  });
}
