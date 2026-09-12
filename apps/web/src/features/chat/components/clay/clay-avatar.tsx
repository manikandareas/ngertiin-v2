import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../../../../lib/utils";
import {
  ClayRig,
  type ColorId,
  clamp,
  clayStops,
  eyeInk,
  type FaceId,
  LIGHT,
  renderPose,
  resolveClayColor,
  restPose,
  type ShapeId,
} from "./engine";

/** Body units → user units. The viewBox is padded so a droplet's point never clips. */
const R = 100;
const PAD = 1.58;

export type ClayAvatarProps = {
  shape?: ShapeId;
  face?: FaceId;
  /** a named color or a six-digit RGB hex color */
  color?: ColorId | (string & {});
  /** rendered size in px */
  size?: number;
  /** follow the pointer, or hold the face's own gaze */
  track?: "cursor" | "none";
  /** breathing, drift, blinking, saccades */
  idle?: boolean;
  /** seconds a shape change takes to morph */
  morph?: number;
  /** override the derived eye colour */
  eyeColor?: string;
  className?: string;
  /** sets role="img" with this label; without one the SVG is aria-hidden */
  title?: string;
};

/**
 * One SVG, one `<mask>`, one `<radialGradient>`, and a requestAnimationFrame
 * loop that rewrites two `d` attributes and two `matrix()` transforms.
 *
 * React renders this once and then stops touching the geometry: the loop writes
 * to the DOM nodes directly, which is what keeps sixty frames a second free.
 * What React *does* render — the resting pose — is produced by the same
 * `renderPose` the loop uses, so the server's HTML is already the finished
 * avatar. No hydration flash, and it still draws with JavaScript off.
 *
 * All the state with a memory of the last frame lives in `ClayRig`. When every
 * spring in it has settled and nothing is scheduled, the loop stops — so a grid
 * of still avatars costs one frame each and then nothing.
 */
export function ClayAvatar({
  shape = "circle",
  face = "neutral",
  color = "blue",
  size = 220,
  track = "cursor",
  idle = true,
  morph = 0.45,
  eyeColor,
  className,
  title,
}: ClayAvatarProps) {
  const uid = useId();
  const maskId = `${uid}-mask`;
  const gradId = `${uid}-grad`;

  const rootRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGPathElement>(null);
  const maskBodyRef = useRef<SVGPathElement>(null);
  const eyeRefs = useRef<(SVGPathElement | null)[]>([null, null]);

  // Live props for the loop. Reading them through one ref rather than through
  // the effect's closure means a prop change never tears the loop down.
  const live = useRef({ shape, face, track, idle, morph });
  const wake = useRef<(() => void) | null>(null);
  useEffect(() => {
    live.current = { shape, face, track, idle, morph };
    wake.current?.();
  }, [shape, face, track, idle, morph]);

  // The markup React emits, computed once. After mount the loop owns these
  // attributes; if React re-rendered them it would snap the avatar back to its
  // resting pose on every unrelated re-render.
  const [rest] = useState(() => renderPose(restPose(shape, face), R));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const rig = new ClayRig(live.current.shape, live.current.face);
    let raf = 0;
    let visible = false;
    let look: { x: number; y: number } | null = null;

    const start = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };
    wake.current = start;

    const onPointer = (e: PointerEvent) => {
      // guard before measuring: a still avatar must not pay for a layout read
      if (!visible || live.current.track !== "cursor" || reduced.matches) return;
      const box = root.getBoundingClientRect();
      look = {
        x: clamp((e.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2), -1, 1),
        y: clamp((e.clientY - (box.top + box.height / 2)) / (window.innerHeight / 2), -1, 1),
      };
      start();
    };

    // don't burn frames on an avatar that has scrolled away
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(root);

    function tick(ms: number) {
      raf = 0;
      const t = ms / 1000;
      const p = live.current;
      const motion = !reduced.matches;

      const frame = renderPose(
        rig.update(
          {
            shape: p.shape,
            face: p.face,
            look: p.track === "cursor" && motion ? look : null,
            idle: p.idle && motion,
            // reduced motion means gentler, not none: a shape swap with no
            // transition at all is the jarring change the setting exists to avoid
            morph: motion ? p.morph : Math.min(p.morph, 0.2),
          },
          t,
        ),
        R,
      );

      bodyRef.current?.setAttribute("d", frame.body);
      maskBodyRef.current?.setAttribute("d", frame.body);
      frame.eyes.forEach((eye, i) => {
        const node = eyeRefs.current[i];
        if (!node) return;
        node.setAttribute("opacity", String(eye.opacity));
        if (!eye.opacity) return;
        node.setAttribute("d", eye.d);
        node.setAttribute("transform", eye.transform);
      });

      if (!rig.settled) start();
    }

    window.addEventListener("pointermove", onPointer, { passive: true });
    reduced.addEventListener("change", start);
    document.addEventListener("visibilitychange", onVisibilityChange);
    start();

    return () => {
      wake.current = null;
      window.removeEventListener("pointermove", onPointer);
      reduced.removeEventListener("change", start);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      io.disconnect();
      stop();
    };
  }, []);

  const hex = resolveClayColor(color);

  return (
    <svg
      ref={rootRef}
      className={cn("block overflow-visible", className)}
      width={size}
      height={size}
      viewBox={`${-R * PAD} ${-R * PAD} ${R * PAD * 2} ${R * PAD * 2}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        {/* the body, as a mask: the eyes are drawn through it, so an eye that
            wanders towards the rim is cut off by the silhouette rather than
            spilling over it */}
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={-R * PAD}
          y={-R * PAD}
          width={R * PAD * 2}
          height={R * PAD * 2}
        >
          <path ref={maskBodyRef} d={rest.body} fill="#fff" />
        </mask>
        <radialGradient
          id={gradId}
          gradientUnits="userSpaceOnUse"
          cx={LIGHT.cx * R}
          cy={LIGHT.cy * R}
          r={LIGHT.r * R}
        >
          {clayStops(hex).map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </radialGradient>
      </defs>
      <path ref={bodyRef} d={rest.body} fill={`url(#${gradId})`} />
      <g mask={`url(#${maskId})`} fill={eyeColor ?? eyeInk(hex)}>
        {rest.eyes.map((eye, i) => (
          <path
            key={i === 0 ? "left" : "right"}
            ref={(el) => {
              eyeRefs.current[i] = el;
            }}
            d={eye.d}
            transform={eye.transform}
            opacity={eye.opacity}
          />
        ))}
      </g>
    </svg>
  );
}
