import { type ChatMention, chatMentionSchema } from "@ngertiin/contracts/api";
import type { JSONContent } from "@tiptap/react";

export function textDocument(text: string): JSONContent {
  return {
    type: "doc",
    content: text
      .split("\n")
      .map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })),
  };
}

export function mentionDocument(mention: ChatMention): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "contextMention", attrs: mention },
          { type: "text", text: " " },
        ],
      },
    ],
  };
}

export function draftMentions(document?: JSONContent): ChatMention[] {
  if (!document) return [];
  if (document.type === "contextMention") {
    const result = chatMentionSchema.safeParse({
      moduleId: document.attrs?.moduleId,
      label: document.attrs?.label,
      nodeId: document.attrs?.nodeId ?? undefined,
    });
    return result.success ? [result.data] : [];
  }
  return document.content?.flatMap(draftMentions) ?? [];
}

export function withLockedMention(mentions: ChatMention[], locked?: ChatMention): ChatMention[] {
  if (!locked) return mentions;
  return [
    locked,
    ...mentions.filter(
      (mention) => mention.moduleId !== locked.moduleId || mention.nodeId !== locked.nodeId,
    ),
  ];
}

export function hasEditableDraft(document: JSONContent | undefined, draft: string): boolean {
  if (!document) return Boolean(draft.trim());
  if (document.type === "contextMention") return !document.attrs?.locked;
  if (document.type === "text") return Boolean(document.text?.trim());
  return document.content?.some((node) => hasEditableDraft(node, "")) ?? false;
}
