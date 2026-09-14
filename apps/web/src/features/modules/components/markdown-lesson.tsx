import { useAuth } from "@clerk/react";
import type { MarkdownLessonContent } from "@ngertiin/contracts/api";
import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { type JSX, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { defaultRemarkPlugins, Streamdown } from "streamdown";
import { WikimediaImage } from "../../../components/wikimedia-image";
import { getNode } from "../../../lib/api";
import "katex/dist/katex.min.css";

const math = createMathPlugin({ singleDollarTextMath: true });
type MarkdownNode = { type: string; children?: MarkdownNode[] };
function removeRawHtml(): (node: MarkdownNode) => void {
  return function remove(node: MarkdownNode): void {
    if (!node.children) return;
    node.children = node.children.filter((child) => child.type !== "html");
    node.children.forEach(remove);
  };
}
const remarkPlugins = [removeRawHtml, ...Object.values(defaultRemarkPlugins)];

interface MarkdownLessonProps {
  content: MarkdownLessonContent;
  activityId: string;
}

export function MarkdownLesson({ content, activityId }: MarkdownLessonProps): JSX.Element {
  const { moduleId = "", nodeId = "" } = useParams();
  const { getToken } = useAuth();
  const refreshOnce = useRef<ReturnType<typeof getNode> | null>(null);
  const components = useMemo(
    () => ({
      img: ({ src }: { src?: string }) => {
        const image = content.images.find((item) => item.id === src);
        if (!image) return null;
        return (
          <WikimediaImage
            key={`${image.id}:${image.url}`}
            image={image}
            refresh={() => {
              refreshOnce.current ??= getNode(getToken, moduleId, nodeId);
              return refreshOnce.current.then((data) => {
                const refreshed = data.activities.find((item) => item.id === activityId);
                if (refreshed?.type !== "lesson" || !("format" in refreshed.content))
                  throw new Error("Image unavailable");
                const next = refreshed.content.images.find((item) => item.id === image.id);
                if (!next) throw new Error("Image unavailable");
                return next.url;
              });
            }}
          />
        );
      },
    }),
    [content.images, activityId, getToken, moduleId, nodeId],
  );
  return (
    <article className="lesson-markdown min-w-0 max-w-full space-y-5 font-sans leading-8">
      <h2 className="text-2xl font-extrabold">{content.title}</h2>
      <Streamdown
        mode="static"
        plugins={{ code, math }}
        components={components}
        remarkPlugins={remarkPlugins}
        rehypePlugins={[]}
        skipHtml
        controls={{ code: true, table: false }}
      >
        {content.body}
      </Streamdown>
    </article>
  );
}
