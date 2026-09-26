import type { PracticeDetail } from "@ngertiin/contracts/api";
import { useRef, useState } from "react";

export type PracticeExamView = "focus" | "list";

export function usePracticeExamNavigation(items: PracticeDetail["items"]) {
  const [view, setView] = useState<PracticeExamView>("focus");
  const [position, setPosition] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const questionRefs = useRef(new Map<string, HTMLDivElement>());
  const visibleItems = view === "list" ? items : items.slice(position, position + 1);

  const moveTo = (next: number, nextView = view): void => {
    setPosition(next);
    setView(nextView);
    requestAnimationFrame(() => {
      const element = questionRefs.current.get(items[next]?.id ?? "");
      if (nextView === "focus") scrollRef.current?.scrollTo({ top: 0 });
      else element?.scrollIntoView({ block: "start" });
      element?.querySelector("h2")?.focus({ preventScroll: true });
    });
  };

  const toggleFlag = (id: string): void => {
    setFlagged((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return {
    view,
    position,
    setPosition,
    flagged,
    toggleFlag,
    scrollRef,
    questionRefs,
    visibleItems,
    moveTo,
  };
}
