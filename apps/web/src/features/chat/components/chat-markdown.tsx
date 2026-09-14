import type { ChatCitation, ChatImage } from "@ngertiin/contracts/api";
import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { useMemo } from "react";
import {
  type Components,
  defaultRemarkPlugins,
  Streamdown,
  type StreamdownProps,
} from "streamdown";
import "katex/dist/katex.min.css";
import { ChatImageView } from "./chat-image";

const math = createMathPlugin({ singleDollarTextMath: true });
const plugins = { code, math };
const citationPrefix = "#chat-citation-";
type MarkdownNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

// Transform text nodes, not Markdown fragments: a citation inside a list or
// emphasis must not split the surrounding Markdown into separate documents.
function remarkChatCitations({ ids }: { ids: string[] }) {
  const numbers = new Map(ids.map((id, index) => [id, index + 1]));
  function visit(node: MarkdownNode, insideLink = false): void {
    if (node.type === "code" || node.type === "inlineCode") {
      node.value = node.value?.replace(/\[\[cite:([^\]]*)\]\]/g, (_, id: string) => {
        const number = numbers.get(id);
        return number ? `[${number}]` : "";
      });
    }
    if (!node.children) return;
    node.children = node.children.flatMap((child): MarkdownNode[] => {
      if (child.type === "html") return [];
      if (child.type !== "text" || !child.value) {
        visit(child, insideLink || child.type === "link");
        return [child];
      }
      const parts: MarkdownNode[] = [];
      let start = 0;
      for (const match of child.value.matchAll(/\[\[cite:([^\]]*)\]\]/g)) {
        if (match.index > start)
          parts.push({ type: "text", value: child.value.slice(start, match.index) });
        const number = numbers.get(match[1]);
        if (number) {
          parts.push(
            insideLink
              ? { type: "text", value: `[${number}]` }
              : {
                  type: "link",
                  url: `${citationPrefix}${number}`,
                  children: [{ type: "text", value: String(number) }],
                },
          );
        }
        start = match.index + match[0].length;
      }
      if (start < child.value.length) parts.push({ type: "text", value: child.value.slice(start) });
      return parts;
    });
  }
  return (tree: MarkdownNode) => visit(tree);
}

function remarkRegisteredImages({ ids }: { ids: string[] }) {
  const registered = new Set(ids);
  const allowed = new Set(ids.map((id) => `chat-image-${id}`));
  return function visit(node: MarkdownNode): void {
    if (!node.children) return;
    for (const child of node.children) {
      // Models sometimes omit the prefix. Resolve only IDs registered on this
      // message; never turn an arbitrary URL or another message's ID into an image.
      if (child.type === "image" && child.url && registered.has(child.url))
        child.url = `chat-image-${child.url}`;
    }
    node.children = node.children.filter(
      (child) =>
        child.type !== "imageReference" && (child.type !== "image" || allowed.has(child.url ?? "")),
    );
    node.children.forEach(visit);
  };
}

type ChatMarkdownProps = {
  text: string;
  citations: ChatCitation[];
  images: ChatImage[];
  loadImage: (id: string) => Promise<string>;
  citationHref: (citation: ChatCitation) => string;
  isAnimating: boolean;
  animateWords?: boolean;
};

export function ChatMarkdown({
  text,
  citations,
  images,
  loadImage,
  citationHref,
  isAnimating,
  animateWords = false,
}: ChatMarkdownProps) {
  const remarkPlugins = useMemo<StreamdownProps["remarkPlugins"]>(
    () => [
      [remarkRegisteredImages, { ids: images.map((image) => image.id) }],
      ...Object.values(defaultRemarkPlugins),
      [remarkChatCitations, { ids: citations.map((citation) => citation.id) }],
    ],
    [citations, images],
  );
  const components = useMemo<Components>(
    () => ({
      a: ({ href, children }) => {
        if (href?.startsWith(citationPrefix)) {
          const number = Number(href.slice(citationPrefix.length));
          const citation = Number.isInteger(number) ? citations[number - 1] : undefined;
          return citation ? (
            <a
              href={citationHref(citation)}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-1 inline-flex h-5 items-center rounded-md bg-muted px-1.5 align-middle text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-link"
              aria-label={`Buka rujukan ${number} di tab baru`}
            >
              {number}
            </a>
          ) : null;
        }
        if (!href) return <span>{children}</span>;
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link underline underline-offset-2"
          >
            {children}
          </a>
        );
      },
      img: ({ src }) => {
        const image = images.find((item) => `chat-image-${item.id}` === src);
        return image ? (
          <ChatImageView key={image.id} image={image} load={() => loadImage(image.id)} />
        ) : null;
      },
    }),
    [citations, citationHref, images, loadImage],
  );
  return (
    <div className="lesson-markdown min-w-0 max-w-full text-sm leading-7 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base">
      {/* Streamdown 2.6 memoizes without components/remarkPlugins. Refresh when
          citation data arrives separately from the unchanged text chunk. */}
      <Streamdown
        key={[...citations.map((citation) => citation.id), ...images.map((image) => image.id)].join(
          ",",
        )}
        mode="streaming"
        isAnimating={isAnimating}
        animated={
          animateWords
            ? { animation: "blurIn", duration: 160, sep: "word", stagger: 0, maxBacklogMs: 0 }
            : false
        }
        plugins={plugins}
        components={components}
        remarkPlugins={remarkPlugins}
        rehypePlugins={[]}
        skipHtml
        urlTransform={(url) => {
          try {
            return ["https:", "http:", "mailto:"].includes(
              new URL(url, "https://ngerti.in").protocol,
            )
              ? url
              : undefined;
          } catch {
            return undefined;
          }
        }}
        controls={{ code: true, table: false }}
      >
        {text.replace(/\[\[cite:[^\]]*\]?$/, "")}
      </Streamdown>
    </div>
  );
}
