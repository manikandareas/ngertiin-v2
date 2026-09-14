import type { ChatCitationSnapshot } from "@ngertiin/contracts/api";
import { type ReactNode, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
import { citationRange, renderedText } from "../citation-highlight";

export function CitationContent({
  snapshot,
  children,
  selector,
  markdown = false,
}: {
  snapshot: ChatCitationSnapshot;
  children: ReactNode;
  /** Restrict matching to the cited section/page, never unrelated content on the page. */
  selector?: string;
  markdown?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const excerpt = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    if (!("highlights" in CSS) || typeof Highlight === "undefined") return;
    let timer = 0;
    let scrolled = false;
    const update = () => {
      CSS.highlights.delete("ngertiin-citation");
      const target = selector ? element.querySelector<HTMLElement>(selector) : element;
      const renderedExcerpt = markdown && excerpt.current ? renderedText(excerpt.current).text : "";
      const range = target
        ? citationRange(target, [snapshot.citation.excerpt, renderedExcerpt])
        : null;
      if (!range || range.getClientRects().length === 0) return;
      CSS.highlights.set("ngertiin-citation", new Highlight(range));
      if (!scrolled) {
        range.startContainer.parentElement?.scrollIntoView({
          block: "center",
          behavior: "instant",
        });
        scrolled = true;
      }
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 200);
    };
    // React, lazy Markdown and the PDF text layer may finish after the page itself.
    const observer = new MutationObserver(schedule);
    observer.observe(element, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-hidden"],
    });
    if (excerpt.current)
      observer.observe(excerpt.current, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    schedule();
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      CSS.highlights.delete("ngertiin-citation");
    };
  }, [snapshot, selector, markdown]);
  return (
    <div className="min-w-0">
      {markdown ? (
        <div className="hidden" ref={excerpt}>
          <Streamdown mode="static" skipHtml controls={false} components={{ img: () => null }}>
            {snapshot.citation.excerpt}
          </Streamdown>
        </div>
      ) : null}
      <div ref={root} className="min-w-0">
        {children}
      </div>
    </div>
  );
}
