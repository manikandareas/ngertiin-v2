import type { SpeechAsset } from "@ngertiin/contracts/api";
import { type RefObject, useEffect, useState } from "react";

type Timeline = NonNullable<SpeechAsset["timeline"]>;

function normalize(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}

export function useLessonSpeechHighlight(
  anchorRef: RefObject<HTMLDivElement | null>,
  timeline: Timeline | null | undefined,
  currentTime: number,
  ended: boolean,
): void {
  const [elements, setElements] = useState<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!timeline || !anchor?.parentElement) return;

    const update = () => {
      const article = anchor.nextElementSibling;
      if (!(article instanceof HTMLElement) || article.tagName !== "ARTICLE") {
        setElements(new Map());
        return;
      }

      const candidates = Array.from(
        article.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,p,li,th,td"),
      ).filter((element) => element.tagName === "LI" || !element.closest("li"));
      const mapped = new Map<string, HTMLElement>();
      let cursor = 0;
      for (const block of timeline) {
        const index = candidates.findIndex(
          (element, position) =>
            position >= cursor && normalize(element.textContent ?? "") === block.text,
        );
        if (index < 0) continue;
        mapped.set(block.id, candidates[index]);
        cursor = index + 1;
      }
      setElements(mapped);
    };

    const observer = new MutationObserver(update);
    observer.observe(anchor.parentElement, { childList: true, characterData: true, subtree: true });
    update();
    return () => observer.disconnect();
  }, [anchorRef, timeline]);

  useEffect(() => {
    if (!timeline || ended) return;
    const block = timeline.find(({ start, end }) => currentTime >= start && currentTime < end);
    const active = block ? elements.get(block.id) : undefined;
    active?.setAttribute("data-lesson-speech-active", "");
    return () => active?.removeAttribute("data-lesson-speech-active");
  }, [timeline, currentTime, ended, elements]);
}
