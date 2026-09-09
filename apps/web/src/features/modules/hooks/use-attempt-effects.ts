import type { AttemptResult } from "@ngertiin/contracts/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSoundPreference } from "../../../lib/sound-preference";
import { type AttemptTone, getAttemptPresentation } from "../attempt-presentation";

function playResultSound(context: AudioContext, tone: AttemptTone): void {
  // Do not queue a sound for later if the browser has blocked autoplay.
  if (context.state !== "running") return;
  const notes = tone === "success" ? [523.25, 659.25, 783.99] : [392, 440];
  for (const [index, frequency] of notes.entries()) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.12;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.045, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + 0.3);
  }
}

export function useAttemptEffects(result: AttemptResult | undefined, visible: boolean) {
  const { soundEnabled } = useSoundPreference();
  const contextRef = useRef<AudioContext | null>(null);
  const [submittedAttemptId, setSubmittedAttemptId] = useState<string | null>(null);
  const pendingAttemptId = useRef<string | null>(null);
  const playedAttemptIds = useRef(new Set<string>());
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);

  const prepareSound = useCallback(() => {
    try {
      contextRef.current ??= new AudioContext();
      void contextRef.current.resume().catch(() => {});
    } catch {
      // Audio is optional; an unavailable device must not interrupt learning.
    }
  }, []);

  useEffect(() => {
    if (!soundEnabled) {
      void contextRef.current?.close().catch(() => {});
      contextRef.current = null;
    }
  }, [soundEnabled]);

  function prepareSubmission(): void {
    if (soundEnabled) prepareSound();
  }

  function markSubmitted(attemptId: string): void {
    setSubmittedAttemptId(attemptId);
  }

  const attempt = result?.attempt;
  useEffect(() => {
    if (!attempt) return;
    if (attempt.evaluationStatus === "evaluating") {
      pendingAttemptId.current = attempt.id;
      return;
    }
    if (attempt.evaluationStatus !== "completed" || !visible) return;
    if (
      (pendingAttemptId.current !== attempt.id && submittedAttemptId !== attempt.id) ||
      playedAttemptIds.current.has(attempt.id)
    )
      return;
    playedAttemptIds.current.add(attempt.id);
    pendingAttemptId.current = null;
    setActiveAttemptId(attempt.id);
    if (soundEnabled && contextRef.current) {
      playResultSound(contextRef.current, getAttemptPresentation(attempt.normalizedScore).tone);
    }
  }, [attempt, soundEnabled, submittedAttemptId, visible]);

  useEffect(() => {
    if (!activeAttemptId) return;
    if (!visible) {
      setActiveAttemptId(null);
      return;
    }
    const timer = window.setTimeout(() => setActiveAttemptId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [activeAttemptId, visible]);

  useEffect(
    () => () => {
      void contextRef.current?.close().catch(() => {});
      contextRef.current = null;
    },
    [],
  );

  return {
    animateResult: visible && activeAttemptId !== null && activeAttemptId === attempt?.id,
    prepareSubmission,
    markSubmitted,
  };
}
