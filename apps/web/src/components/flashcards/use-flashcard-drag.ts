import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { type PointerEvent, useEffect, useRef, useState } from "react";

const CLICK_SLOP = 8;
const AXIS_LOCK_DISTANCE = 12;
const AXIS_DOMINANCE = 1.2;

type DragOptions = {
  position: number;
  total: number;
  disabled: boolean;
  onNavigate: (position: number) => void;
};

type Gesture = {
  id: number;
  x: number;
  y: number;
  axis: "horizontal" | "vertical" | null;
};

export function useFlashcardDrag({ position, total, disabled, onNavigate }: DragOptions) {
  const x = useMotionValue(0);
  const reducedMotion = useReducedMotion();
  const [transitioning, setTransitioning] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const moving = useRef(false);
  const animation = useRef<ReturnType<typeof animate> | null>(null);
  const generation = useRef(0);

  useEffect(
    () => () => {
      generation.current += 1;
      animation.current?.stop();
    },
    [],
  );

  const reset = () => {
    animation.current?.stop();
    if (reducedMotion) {
      x.set(0);
      return;
    }
    animation.current = animate(x, 0, {
      type: "spring",
      stiffness: 420,
      damping: 34,
    });
  };

  const release = async (event: PointerEvent<HTMLButtonElement>) => {
    const target = event.currentTarget;
    const start = gesture.current;
    gesture.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > CLICK_SLOP || Math.abs(dy) > CLICK_SLOP) suppressClick.current = true;
    const next = position + (dx < 0 ? 1 : -1);
    // A short swipe is enough, on both narrow and wide cards.
    const threshold = Math.min(40, Math.max(24, target.clientWidth * 0.08));
    if (
      disabled ||
      start.axis === "vertical" ||
      Math.abs(dx) < threshold ||
      (start.axis === null && Math.abs(dx) < Math.abs(dy) * AXIS_DOMINANCE) ||
      next < 0 ||
      next >= total
    ) {
      reset();
      return;
    }
    if (reducedMotion) {
      x.set(0);
      onNavigate(next);
      return;
    }
    moving.current = true;
    setTransitioning(true);
    const run = ++generation.current;
    const width = target.clientWidth + 24;
    const direction = dx < 0 ? -1 : 1;
    animation.current = animate(x, direction * width, { duration: 0.14, ease: "easeOut" });
    await animation.current;
    if (generation.current !== run) return;
    x.set(-direction * width);
    onNavigate(next);
    // Let React replace the card content before its entrance begins.
    requestAnimationFrame(async () => {
      if (generation.current !== run) return;
      animation.current = animate(x, 0, { duration: 0.2, ease: [0.22, 1, 0.36, 1] });
      await animation.current;
      if (generation.current !== run) return;
      moving.current = false;
      setTransitioning(false);
      requestAnimationFrame(() => {
        if (generation.current === run && target.isConnected) target.focus({ preventScroll: true });
      });
    });
  };

  return {
    x,
    transitioning,
    suppressClick,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (!event.isPrimary || event.button !== 0 || disabled || moving.current) return;
      animation.current?.stop();
      suppressClick.current = false;
      gesture.current = {
        id: event.pointerId,
        x: event.clientX - x.get(),
        y: event.clientY,
        axis: null,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const start = gesture.current;
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      // Lock the intended axis so small vertical drift does not cancel a horizontal swipe.
      if (start.axis === null && Math.max(Math.abs(dx), Math.abs(dy)) > AXIS_LOCK_DISTANCE) {
        if (Math.abs(dx) > Math.abs(dy) * AXIS_DOMINANCE) start.axis = "horizontal";
        else if (Math.abs(dy) > Math.abs(dx) * AXIS_DOMINANCE) start.axis = "vertical";
      }
      if (Math.abs(dx) > CLICK_SLOP || Math.abs(dy) > CLICK_SLOP) suppressClick.current = true;
      if (start.axis === "vertical" || disabled) {
        x.set(0);
        return;
      }
      const atBoundary = (position === 0 && dx > 0) || (position === total - 1 && dx < 0);
      x.set(atBoundary ? dx * 0.18 : dx);
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      void release(event);
    },
    onPointerCancel: () => {
      gesture.current = null;
      suppressClick.current = true;
      reset();
    },
    onLostPointerCapture: () => {
      if (!gesture.current) return;
      gesture.current = null;
      reset();
    },
  };
}
