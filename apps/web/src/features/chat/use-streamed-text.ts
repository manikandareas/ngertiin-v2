import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const WORD_INTERVAL_MS = 32;
const MIN_INTERVAL_MS = 16;
const CATCH_UP_MS = 600;

/** Presentation only: durable messages and transport always retain the full text. */
export function useStreamedText(text: string, streaming: boolean) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(streaming ? "" : text);
  const [following, setFollowing] = useState(streaming);
  const batch = useRef({ text, deadline: 0 });

  useEffect(() => {
    if (streaming) setFollowing(true);
  }, [streaming]);

  useEffect(() => {
    if (reducedMotion || (!streaming && !following) || !text.startsWith(visible)) {
      setVisible(text);
      return;
    }
    if (visible === text) return;
    // Keep whitespace and citation markers intact. Hold an unfinished last word
    // until its boundary arrives, but release it when generation ends.
    const pending = text.slice(visible.length);
    const words = [...pending.matchAll(/\s*(?:\[\[cite:[^\]]*\]\]|\S+)\s*/g)];
    const complete = words.filter(
      (word, index) => !streaming || index < words.length - 1 || /\s$/.test(word[0]),
    );
    if (!complete.length) return;
    if (batch.current.text !== text || !batch.current.deadline) {
      batch.current = { text, deadline: performance.now() + CATCH_UP_MS };
    }
    // Normal prose: 32 ms/word. Large bursts catch up within roughly 600 ms;
    // multiple words per frame are reserved for unusually large snapshots.
    const remainingMs = Math.max(MIN_INTERVAL_MS, batch.current.deadline - performance.now());
    const delay = Math.max(
      MIN_INTERVAL_MS,
      Math.min(WORD_INTERVAL_MS, remainingMs / complete.length),
    );
    const count = Math.max(1, Math.ceil((MIN_INTERVAL_MS * complete.length) / remainingMs));
    const next = complete[Math.min(count, complete.length) - 1];
    const timer = window.setTimeout(() => {
      setVisible(text.slice(0, visible.length + next.index + next[0].length));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [text, visible, streaming, following, reducedMotion]);

  const displayed = reducedMotion || !following || !text.startsWith(visible) ? text : visible;
  return { text: displayed, revealing: streaming || displayed.length < text.length, reducedMotion };
}
