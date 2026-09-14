import { useState } from "react";
import { type Components, defaultRemarkPlugins, Streamdown } from "streamdown";

function imageUrl(value: string | undefined): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    // OCR filenames and lesson image IDs need an asset mapping; they are not URLs.
  }
}

type MarkdownNode = {
  type: string;
  url?: string;
  identifier?: string;
  children?: MarkdownNode[];
};

// Remove unresolved images before Streamdown's hardening plugin turns them into
// visible "Image blocked" text. Keep the normal link and HTML protections.
function removeUnresolvedImages() {
  return (tree: MarkdownNode) => {
    const definitions = new Map<string, string>();
    for (const child of tree.children ?? []) {
      if (child.type === "definition" && child.identifier && child.url)
        definitions.set(child.identifier, child.url);
    }
    function visit(node: MarkdownNode): void {
      if (!node.children) return;
      node.children = node.children.filter((child) => {
        if (child.type === "image") return Boolean(imageUrl(child.url));
        if (child.type === "imageReference")
          return Boolean(imageUrl(definitions.get(child.identifier ?? "")));
        return true;
      });
      node.children.forEach(visit);
    }
    visit(tree);
  };
}

function PreviewImage({ src, alt }: { src?: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const url = imageUrl(src);
  if (!url || failed) return null;
  return (
    <img
      src={url}
      alt={alt ?? "Gambar rujukan"}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="my-1 block h-24 w-full rounded-lg bg-white/40 object-contain"
    />
  );
}

const PreviewHeading: Components["h1"] = ({ children }) => (
  <p className="font-semibold">{children}</p>
);

const components: Components = {
  a: ({ children }) => <span>{children}</span>,
  img: ({ src, alt }) => <PreviewImage key={src} src={src} alt={alt} />,
  h1: PreviewHeading,
  h2: PreviewHeading,
  h3: PreviewHeading,
  h4: PreviewHeading,
  h5: PreviewHeading,
  h6: PreviewHeading,
  p: ({ children }) => <p className="m-0 line-clamp-3 leading-4">{children}</p>,
  pre: ({ children }) => <pre className="m-0 whitespace-pre-wrap font-mono">{children}</pre>,
};
const remarkPlugins = [...Object.values(defaultRemarkPlugins), removeUnresolvedImages];

export function CitationPreview({ text }: { text: string }) {
  return (
    <div className="mt-1.5 max-h-12 has-[img]:max-h-40 overflow-hidden text-[11px] leading-4 opacity-90 [overflow-wrap:anywhere] [&_*]:text-inherit [&_*]:leading-4 [&_p:has(img)]:block [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_table]:text-[10px]">
      <Streamdown
        mode="static"
        skipHtml
        controls={false}
        components={components}
        remarkPlugins={remarkPlugins}
        className="space-y-1"
      >
        {text}
      </Streamdown>
    </div>
  );
}
