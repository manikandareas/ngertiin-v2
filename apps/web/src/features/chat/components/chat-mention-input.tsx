import { type ChatMention, chatMentionSchema } from "@ngertiin/contracts/api";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { UndoRedo } from "@tiptap/extensions";
import { type Editor, EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TokenResolver } from "../../../lib/api";
import { draftMentions, textDocument } from "../chat-draft";
import { CHAT_AGENT_NAME } from "../constants";
import { lockedContextExtension, lockedContextKey } from "../locked-context";
import { ChatMentionMenu, type MentionMenuHandle } from "./chat-mention-menu";
import { ContextMention } from "./chat-mention-node";

type Trigger = { from: number; to: number; query: string; module?: ChatMention };
function mentionTrigger(editor: Editor): Trigger | null {
  const { $from, empty } = editor.state.selection;
  if (!empty) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, "", "\ufffc");
  const nodeQuery = before.match(/\ufffc\s?:([^\n:@]*)$/);
  if (nodeQuery) {
    const from = $from.start() + (nodeQuery.index ?? 0);
    const node = editor.state.doc.nodeAt(from);
    const parsed = chatMentionSchema.safeParse({
      moduleId: node?.attrs.moduleId,
      label: node?.attrs.label,
      nodeId: node?.attrs.nodeId ?? undefined,
    });
    if (node?.type.name === "contextMention" && parsed.success && !parsed.data.nodeId)
      return { from, to: $from.pos, query: nodeQuery[1] ?? "", module: parsed.data };
  }
  const match = before.match(/(?:^|[\s(])@([^@\n]*)$/);
  return match
    ? { from: $from.pos - (match[1]?.length ?? 0) - 1, to: $from.pos, query: match[1] ?? "" }
    : null;
}

type ChatMentionInputProps = {
  draft: string;
  document?: JSONContent;
  onChange: (text: string, document: JSONContent, mentions: ChatMention[]) => void;
  onSend: () => void;
  disabled?: boolean;
  root: readonly unknown[];
  getToken: TokenResolver;
  fullPage?: boolean;
  lockedContext?: ChatMention;
};

export function ChatMentionInput({
  draft,
  document,
  onChange,
  onSend,
  disabled,
  root,
  getToken,
  fullPage,
  lockedContext,
}: ChatMentionInputProps) {
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0 });
  const host = useRef<HTMLDivElement>(null);
  const menu = useRef<MentionMenuHandle>(null);
  const [activeOption, setActiveOption] = useState<string | null>(null);
  const dismissed = useRef<string | null>(null);
  const latest = useRef({ onChange, onSend, disabled, trigger, lockedContext });
  latest.current = { onChange, onSend, disabled, trigger, lockedContext };
  const menuId = useId();
  function syncTrigger(editor: Editor) {
    const next = editor.isFocused && !editor.view.composing ? mentionTrigger(editor) : null;
    const key = JSON.stringify(next);
    if (key !== dismissed.current) {
      dismissed.current = null;
      setTrigger(next);
    }
  }
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Paragraph,
      Text,
      HardBreak,
      UndoRedo,
      ContextMention,
      lockedContextExtension(() => latest.current.lockedContext),
    ],
    content: document ?? textDocument(draft),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": `Pesan untuk ${CHAT_AGENT_NAME}`,
        "aria-multiline": "true",
        class:
          "min-h-16 max-h-48 overflow-y-auto whitespace-pre-wrap break-words px-0.5 py-2 outline-none [&_p]:m-0",
      },
      handleKeyDown: (view, event) => {
        if (view.composing || event.isComposing) return false;
        if (menu.current?.keyDown(event)) {
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
        if (latest.current.trigger && ["Escape", "Enter", "Tab"].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          if (event.key === "Escape") {
            dismissed.current = JSON.stringify(latest.current.trigger);
            setTrigger(null);
          }
          return true;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          if (!latest.current.disabled) latest.current.onSend();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const document = editor.getJSON();
      latest.current.onChange(
        editor.getText({ blockSeparator: "\n" }),
        document,
        draftMentions(document),
      );
      syncTrigger(editor);
    },
    onSelectionUpdate: ({ editor }) => syncTrigger(editor),
    onFocus: ({ editor }) => syncTrigger(editor),
    onBlur: () => setTrigger(null),
  });
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getText({ blockSeparator: "\n" });
    if (
      draft !== current ||
      (document && JSON.stringify(document) !== JSON.stringify(editor.getJSON()))
    ) {
      editor.commands.setContent(document ?? textDocument(draft), {
        emitUpdate: true,
      });
      setTrigger(null);
    }
  }, [editor, draft, document]);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(
      editor.state.tr
        .setMeta(lockedContextKey, { context: lockedContext })
        .setMeta("addToHistory", false),
    );
  }, [editor, lockedContext]);
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!disabled);
  }, [editor, disabled]);
  const menuOpen = Boolean(trigger);
  useLayoutEffect(() => {
    if (!menuOpen) return;
    const update = () => {
      const rect = host.current?.getBoundingClientRect();
      if (rect)
        setPosition({
          left: Math.max(8, rect.left),
          top: rect.top,
          width: Math.min(rect.width, window.innerWidth - 16),
        });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [menuOpen]);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const input = editor.view.dom;
    input.setAttribute("aria-autocomplete", "list");
    if (menuOpen) input.setAttribute("aria-controls", menuId);
    else input.removeAttribute("aria-controls");
    if (menuOpen && activeOption) input.setAttribute("aria-activedescendant", activeOption);
    else input.removeAttribute("aria-activedescendant");
  }, [editor, menuOpen, menuId, activeOption]);
  const limitReached = draftMentions(document).length >= 8;
  return (
    <div ref={host} className={`relative ${fullPage ? "text-base" : "text-sm"}`}>
      {!draft ? (
        <span className="pointer-events-none absolute left-0.5 top-2 text-muted-foreground">
          Tanyakan sesuatu, ketik @ untuk pilih modul…
        </span>
      ) : null}
      <EditorContent editor={editor} />
      {trigger && editor && position.width
        ? createPortal(
            <div
              style={{
                position: "fixed",
                left: position.left,
                width: position.width,
                ...(position.top > 260
                  ? { bottom: window.innerHeight - position.top + 8 }
                  : { top: (host.current?.getBoundingClientRect().bottom ?? position.top) + 8 }),
              }}
              className="z-[80]"
            >
              {limitReached && !trigger.module ? (
                <div role="status" className="rounded-xl border bg-popover p-3 text-sm shadow-lg">
                  Maksimal 8 konteks per pesan.
                </div>
              ) : (
                <ChatMentionMenu
                  key={`${trigger.from}:${trigger.module?.moduleId ?? "modules"}:${trigger.query}`}
                  ref={menu}
                  id={menuId}
                  onActiveOption={setActiveOption}
                  query={trigger.query}
                  module={trigger.module}
                  root={root}
                  getToken={getToken}
                  onClose={() => {
                    dismissed.current = JSON.stringify(trigger);
                    setTrigger(null);
                  }}
                  onSelect={(mention) => {
                    editor
                      .chain()
                      .focus()
                      .insertContentAt({ from: trigger.from, to: trigger.to }, [
                        { type: "contextMention", attrs: mention },
                        { type: "text", text: " " },
                      ])
                      .run();
                    setTrigger(null);
                  }}
                />
              )}
            </div>,
            window.document.body,
          )
        : null}
    </div>
  );
}
