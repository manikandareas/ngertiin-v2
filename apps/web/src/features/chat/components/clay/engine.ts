/**
 * Clay avatar engine — no React, no dependencies, no canvas.
 *
 * The whole thing rests on one idea: a silhouette is a polar function r(θ),
 * sampled at 64 angles. That single representation buys everything else.
 * Morphing between two shapes is an element-wise lerp of two arrays. Keeping a
 * feature inside the body is a lookup of r at that feature's angle. Exporting
 * is the same code path as drawing.
 *
 * Ported and rewritten from my own reading of grokbots.ai/studio, which credits
 * Jeremy Perret for the original look. The maths here is mine to the extent
 * that anyone owns a ray/segment intersection.
 */

export const SAMPLES = 64;
export const TAU = Math.PI * 2;

/** Unit circle sampled once, reused by every shape builder. */
const UX: number[] = [];
const UY: number[] = [];
for (let i = 0; i < SAMPLES; i++) {
  const a = (i / SAMPLES) * TAU;
  UX.push(Math.cos(a));
  UY.push(Math.sin(a));
}

export const clamp = (t: number, lo = 0, hi = 1) => (t < lo ? lo : t > hi ? hi : t);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Two decimals is under half a pixel at any size we render, and it halves the path string. */
const r2 = (n: number) => Math.round(n * 100) / 100;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export type Point = { x: number; y: number };
/** 64 radii, in units where 1 ≈ the body's nominal radius. */
export type Radii = number[];

/* ------------------------------------------------------------------ shapes */

/**
 * Ray-cast from an interior origin against a closed polygon, once per sample
 * angle. This is the trick that lets *any* outline become an r(θ) array — the
 * polygon only has to be star-shaped about the origin, which every body here is.
 */
function radiiFromPolygon(poly: Point[], ox = 0, oy = 0): Radii {
  const out = new Array(SAMPLES).fill(0);
  for (let s = 0; s < SAMPLES; s++) {
    const dx = UX[s];
    const dy = UY[s];
    let best = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const ex = q.x - p.x;
      const ey = q.y - p.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue; // ray parallel to the edge
      const px = p.x - ox;
      const py = p.y - oy;
      const t = (px * ey - py * ex) / den; // distance along the ray
      const u = (px * dy - py * dx) / den; // position along the edge
      if (t > best && u >= 0 && u <= 1) best = t;
    }
    out[s] = best;
  }
  return out;
}

/**
 * Convex hull of two circles, as a polygon.
 *
 * The sweep of the first arc is TAU − 2·off, not π − 2·off. That distinction is
 * the whole shape: with π the first arc collapses to a point and you get a
 * wedge instead of a capsule.
 */
function hullOfTwoCircles(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2_: number,
  steps = 96,
): Point[] {
  const d = Math.hypot(x2 - x1, y2 - y1) || 1e-6;
  const base = Math.atan2(y2 - y1, x2 - x1);
  const off = Math.acos(clamp((r1 - r2_) / d, -1, 1)); // tangent offset
  const half = steps / 2;
  const pts: Point[] = [];
  for (let i = 0; i <= half; i++) {
    const a = base + off + ((TAU - 2 * off) * i) / half;
    pts.push({ x: x1 + Math.cos(a) * r1, y: y1 + Math.sin(a) * r1 });
  }
  for (let i = 0; i <= half; i++) {
    const a = base - off + (2 * off * i) / half;
    pts.push({ x: x2 + Math.cos(a) * r2_, y: y2 + Math.sin(a) * r2_ });
  }
  return pts;
}

/** Union of circles, solved analytically per ray — cheap metaballs. */
function radiiFromBlobs(blobs: { x: number; y: number; r: number }[]): Radii {
  const out = new Array(SAMPLES).fill(0);
  for (let s = 0; s < SAMPLES; s++) {
    const dx = UX[s];
    const dy = UY[s];
    let best = 0;
    for (const b of blobs) {
      const t = dx * b.x + dy * b.y;
      const disc = t * t - (b.x * b.x + b.y * b.y - b.r * b.r);
      if (disc < 0) continue;
      const hit = t + Math.sqrt(disc);
      if (hit > best) best = hit;
    }
    out[s] = best;
  }
  return out;
}

/** Regular polygon with rounded corners, expressed as a polygon then sampled. */
function roundedNgon(sides: number, size: number, round: number, rotDeg = 0): Radii {
  const rot = (rotDeg * Math.PI) / 180;
  const corners = Array.from({ length: sides }, (_, i) => {
    const a = rot + (i / sides) * TAU;
    return { x: Math.cos(a) * (size - round), y: Math.sin(a) * (size - round) };
  });
  const normalAngle = (p: Point, q: Point) => {
    const ix = q.x - p.x;
    const iy = q.y - p.y;
    const l = Math.hypot(ix, iy) || 1;
    return Math.atan2(-ix / l, iy / l);
  };
  const seg = 10;
  const pts: Point[] = [];
  for (let i = 0; i < corners.length; i++) {
    const prev = corners[(i - 1 + corners.length) % corners.length];
    const cur = corners[i];
    const next = corners[(i + 1) % corners.length];
    const a0 = normalAngle(prev, cur);
    let sweep = normalAngle(cur, next) - a0;
    while (sweep > Math.PI) sweep -= TAU;
    while (sweep < -Math.PI) sweep += TAU;
    for (let k = 0; k <= seg; k++) {
      const a = a0 + (sweep * k) / seg;
      pts.push({ x: cur.x + Math.cos(a) * round, y: cur.y + Math.sin(a) * round });
    }
  }
  return radiiFromPolygon(pts);
}

/** Rescale so the widest radius lands exactly on `to` — keeps every shape optically the same size. */
const normalize = (radii: Radii, to = 1): Radii => {
  const max = Math.max(...radii);
  return max <= 0 ? radii : radii.map((v) => (v * to) / max);
};

export const SHAPE_IDS = [
  "circle",
  "pebble",
  "squircle",
  "capsule",
  "triangle",
  "hexagon",
  "cloud",
  "droplet",
] as const;
export type ShapeId = (typeof SHAPE_IDS)[number];

export const SHAPES: Record<ShapeId, Radii> = {
  circle: new Array(SAMPLES).fill(1),
  // two low harmonics out of phase: a stone, not an ellipse
  pebble: normalize(
    Array.from({ length: SAMPLES }, (_, i) => {
      const a = (i / SAMPLES) * TAU;
      return 1 + 0.075 * Math.cos(2 * a + 0.5) + 0.035 * Math.cos(3 * a + 2.1);
    }),
    1.02,
  ),
  // superellipse: |x|^n + |y|^n = 1, solved for r at each angle
  squircle: normalize(
    Array.from(
      { length: SAMPLES },
      (_, i) => (Math.abs(UX[i]) ** 4.2 + Math.abs(UY[i]) ** 4.2) ** (-1 / 4.2),
    ),
    1.15,
  ),
  capsule: radiiFromPolygon(hullOfTwoCircles(-0.42, 0, 0.62, 0.42, 0, 0.62)),
  triangle: roundedNgon(3, 1.12, 0.34, -90),
  hexagon: roundedNgon(6, 1.04, 0.26, 0),
  cloud: normalize(
    radiiFromBlobs([
      { x: -0.44, y: 0.2, r: 0.54 },
      { x: 0.46, y: 0.2, r: 0.5 },
      { x: 0.02, y: 0.3, r: 0.6 },
      { x: -0.24, y: -0.3, r: 0.48 },
      { x: 0.3, y: -0.24, r: 0.44 },
    ]),
    1.02,
  ),
  // a fat circle and a near-point, hulled: the teardrop falls out for free
  droplet: normalize(radiiFromPolygon(hullOfTwoCircles(0, 0.28, 0.66, 0, -0.96, 0.05)), 1.04),
};

/** Element-wise blend of two silhouettes. The reason r(θ) is the right model. */
export const blendRadii = (a: Radii, b: Radii, t: number): Radii =>
  a.map((v, i) => lerp(v, b[i], t));

/** r at an arbitrary angle, linearly interpolated between samples. */
export function radiusAt(radii: Radii, angle: number): number {
  const f = ((((angle / TAU) % 1) + 1) % 1) * SAMPLES;
  const i = Math.floor(f);
  return lerp(radii[i % SAMPLES], radii[(i + 1) % SAMPLES], f - i);
}

/* -------------------------------------------------------------------- path */

export type BodyTransform = {
  /** horizontal scale, for squash and stretch */ sx?: number;
  /** vertical scale */ sy?: number;
  cx?: number;
  cy?: number;
  /** radians */ rot?: number;
};

export function radiiToPoints(radii: Radii, t: BodyTransform = {}, scale = 100): Point[] {
  const { sx = 1, sy = 1, cx = 0, cy = 0, rot = 0 } = t;
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  const pts: Point[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const x = UX[i] * radii[i];
    const y = UY[i] * radii[i];
    pts.push({
      x: (x * ca - y * sa) * sx * scale + cx * scale,
      y: (x * sa + y * ca) * sy * scale + cy * scale,
    });
  }
  return pts;
}

/**
 * Closed Catmull-Rom through every sample, emitted as cubic béziers. Tension
 * 1/6 is the value that reads as clay: lower gets polygonal, higher wobbles.
 */
export function pointsToPath(pts: Point[], tension = 1 / 6): string {
  const n = pts.length;
  if (n < 3) return "";
  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    d +=
      `C${r2(p1.x + (p2.x - p0.x) * tension)} ${r2(p1.y + (p2.y - p0.y) * tension)}` +
      ` ${r2(p2.x - (p3.x - p1.x) * tension)} ${r2(p2.y - (p3.y - p1.y) * tension)}` +
      ` ${r2(p2.x)} ${r2(p2.y)}`;
  }
  return `${d}Z`;
}

export const silhouettePath = (radii: Radii, t: BodyTransform = {}, scale = 100) =>
  pointsToPath(radiiToPoints(radii, t, scale));

/* ------------------------------------------------------------------ colour */

export const COLOR_IDS = [
  "ink",
  "brown",
  "red",
  "orange",
  "amber",
  "green",
  "turquoise",
  "blue",
  "purple",
  "pink",
  "grey",
  "cream",
] as const;
export type ColorId = (typeof COLOR_IDS)[number];

export const COLORS: Record<ColorId, string> = {
  ink: "#25252b",
  brown: "#8b5e3c",
  red: "#e8483f",
  orange: "#f08a24",
  amber: "#f0b429",
  green: "#3ecf8e",
  turquoise: "#2fbfa0",
  blue: "#3b93f0",
  purple: "#8b5cf6",
  pink: "#e152b0",
  grey: "#a3a3a3",
  cream: "#e6e2d8",
};

/** Accept the engine palette or a six-digit RGB hex color. */
export function resolveClayColor(color: ColorId | (string & {})): string {
  return Object.hasOwn(COLORS, color) ? COLORS[color as ColorId] : color;
}

export function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [x, y] = [parse(a), parse(b)];
  return (
    "#" +
    x
      .map((v, i) =>
        Math.round(lerp(v, y[i], t))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/**
 * The entire "clay" illusion: one off-centre radial gradient, four stops.
 * Lit from the upper left, with a radius well past the body so the falloff
 * across the surface stays gentle instead of vignetting.
 */
export function clayStops(hex: string) {
  return [
    { offset: "0%", color: mixHex(hex, "#ffffff", 0.55) },
    { offset: "32%", color: mixHex(hex, "#ffffff", 0.2) },
    { offset: "72%", color: hex },
    { offset: "100%", color: mixHex(hex, "#000000", 0.38) },
  ];
}

export const LIGHT = { cx: -0.5, cy: -0.63, r: 2.45 } as const;

/**
 * Eye colour for a given body colour.
 *
 * The original punches the eyes out of the body as transparent holes, which
 * only works if you control the page behind it — on paper they come out white
 * and the thing looks blinded. So: a heavily darkened version of the body,
 * flipped to a light tint once the body itself is too dark to darken further.
 */
export function eyeInk(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma < 0.28 ? mixHex(hex, "#ffffff", 0.62) : mixHex(hex, "#0a0a0c", 0.82);
}

/* -------------------------------------------------------------------- eyes */

/**
 * Degrees. Positive yaw turns right, positive pitch looks *up*, positive roll
 * tilts clockwise. Pitch is the one to watch: SVG's y-axis points down, so
 * anything fed in from screen coordinates has to be negated first.
 */
export type Gaze = { yaw: number; pitch: number; roll: number };
export type Eye = { w: number; h: number; tilt?: number; open?: number };

const rad = (deg: number) => (deg * Math.PI) / 180;
type Vec3 = [number, number, number];

/** Rotate a pair of basis vectors within their own plane. */
function spin(a: Vec3, b: Vec3, t: number): [Vec3, Vec3] {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [
    [a[0] * c + b[0] * s, a[1] * c + b[1] * s, a[2] * c + b[2] * s],
    [b[0] * c - a[0] * s, b[1] * c - a[1] * s, b[2] * c - a[2] * s],
  ];
}

export type EyeProjection = {
  x: number;
  y: number;
  /** 2×2 of the projected local frame — feeds SVG matrix() */
  a: number;
  b: number;
  c: number;
  d: number;
  /** projected z; ≤ 0 means the eye has rotated round the back */
  depth: number;
};

/**
 * Eyes are not two dots that slide about. They are two points on a sphere:
 * a forward/right/up triad rotated by the gaze, then each eye rotated ±split
 * degrees around it. The projected frame gives the SVG matrix, so eyes
 * foreshorten and tilt on their own instead of being faked per expression.
 */
export function projectEyes(
  gaze: Gaze,
  scale: number,
  split: number,
): [EyeProjection, EyeProjection] {
  let fwd: Vec3 = [0, 0, 1];
  let right: Vec3 = [1, 0, 0];
  let up: Vec3 = [0, 1, 0];
  [fwd, right] = spin(fwd, right, rad(gaze.yaw));
  [up, fwd] = spin(up, fwd, rad(gaze.pitch));
  [right, up] = spin(right, up, rad(gaze.roll));

  const one = (sign: number): EyeProjection => {
    const [p, n] = spin(fwd, right, rad(split * sign));
    return {
      x: p[0] * scale,
      y: p[1] * scale,
      a: n[0],
      b: n[1],
      c: up[0],
      d: up[1],
      depth: p[2],
    };
  };
  return [one(-1), one(1)];
}

/** A stadium — a rectangle whose corner radius is half its short side. */
export function eyePath(w: number, h: number): string {
  const x = Math.max(w, 0.01) / 2;
  const y = Math.max(h, 0.01) / 2;
  const r = Math.min(x, y);
  return (
    `M${r2(-x)} ${r2(-y + r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(-x + r)} ${r2(-y)}` +
    `L${r2(x - r)} ${r2(-y)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(x)} ${r2(-y + r)}` +
    `L${r2(x)} ${r2(y - r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(x - r)} ${r2(y)}` +
    `L${r2(-x + r)} ${r2(y)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(-x)} ${r2(y - r)}Z`
  );
}

/* ------------------------------------------------------------------- faces */

export type Face = {
  gaze: Gaze;
  /** degrees between the eyes, measured on the sphere */
  split: number;
  eyes: [Eye, Eye];
};

export const FACE_IDS = [
  "neutral",
  "attentive",
  "happy",
  "surprised",
  "sleepy",
  "suspicious",
  "sad",
  "wink",
] as const;
export type FaceId = (typeof FACE_IDS)[number];

const pair = (w: number, h: number, tilt = 0): [Eye, Eye] => [
  { w, h, tilt },
  { w, h, tilt: -tilt },
];

/**
 * A face is data, not drawing: where the head is pointing, how far apart the
 * eyes sit, and each eye's box. Sixteen numbers per expression.
 */
export const FACES: Record<FaceId, Face> = {
  // near-frontal with a few degrees of life in it: a resting pose has to work
  // as a still, so it cannot be the three-quarter turn a cursor-tracked one is
  neutral: { gaze: { yaw: 5, pitch: 4, roll: -3 }, split: 15.5, eyes: pair(0.186, 0.412) },
  attentive: { gaze: { yaw: 4, pitch: 6, roll: -4 }, split: 16, eyes: pair(0.21, 0.44) },
  happy: { gaze: { yaw: 5, pitch: 8, roll: 0 }, split: 16.5, eyes: pair(0.3, 0.16, 8) },
  surprised: { gaze: { yaw: 3, pitch: 5, roll: 0 }, split: 19, eyes: pair(0.45, 0.47) },
  sleepy: { gaze: { yaw: 10, pitch: -18, roll: -6 }, split: 15, eyes: pair(0.28, 0.075) },
  suspicious: { gaze: { yaw: -18, pitch: -4, roll: 3 }, split: 15, eyes: pair(0.24, 0.14, -6) },
  sad: { gaze: { yaw: 6, pitch: -20, roll: 0 }, split: 16, eyes: pair(0.2, 0.34, -14) },
  wink: {
    gaze: { yaw: -5.4, pitch: 4.6, roll: 6.7 },
    split: 16.25,
    eyes: [
      { w: 0.236, h: 0.464 },
      { w: 0.447, h: 0.089 },
    ],
  },
};

/* ----------------------------------------------------------------- springs */

/**
 * A spring, in Apple's terms rather than a physicist's: `duration` is roughly
 * how long it takes to settle, `bounce` is how much it overshoots (0 is
 * critically damped). Easier to reason about than stiffness and damping, and
 * it converts to them in two lines.
 *
 * Springs, not tweens, because both things they drive here can be interrupted
 * mid-flight — a cursor that keeps moving, a face clicked twice in a second.
 * A tween restarts from zero and stutters; a spring keeps its velocity.
 */
export type Spring = { v: number; vel: number };

export const spring = (v: number): Spring => ({ v, vel: 0 });

export function springTo(s: Spring, target: number, duration: number, bounce: number, dt: number) {
  const w = TAU / duration; // natural frequency
  const k = w * w;
  const c = 2 * w * (1 - bounce);
  s.vel += (-k * (s.v - target) - c * s.vel) * dt;
  s.v += s.vel * dt;
  // settle rather than ring on forever at the sixth decimal place
  if (Math.abs(s.v - target) < 1e-3 && Math.abs(s.vel) < 1e-2) {
    s.v = target;
    s.vel = 0;
  }
  return s.v;
}

export const easings = {
  outQuad: (t: number) => 1 - (1 - t) ** 2,
  outCubic: easeOutCubic,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
};

/**
 * Blink, asymmetric on purpose: a lid slams shut in about 70ms and opens back
 * over nearly twice that. Symmetric blinks read as a machine winking.
 */
const BLINK_CLOSE = 0.075;
const BLINK_OPEN = 0.13;
export const BLINK_TOTAL = BLINK_CLOSE + BLINK_OPEN;

export function blinkLid(since: number): number {
  if (since < 0 || since > BLINK_TOTAL) return 1;
  if (since < BLINK_CLOSE) return 1 - easings.outQuad(since / BLINK_CLOSE);
  return easings.outCubic((since - BLINK_CLOSE) / BLINK_OPEN);
}

/* ------------------------------------------------------------------- poses */

/** Everything needed to draw one frame. No time, no easing, no state. */
export type Pose = {
  radii: Radii;
  gaze: Gaze;
  split: number;
  eyes: [Eye, Eye];
  /** 1 open, 0 shut */
  lid: number;
  breath: number;
  driftX: number;
  driftY: number;
};

export type Frame = {
  body: string;
  eyes: { d: string; transform: string; opacity: number }[];
};

/** The resting pose for a shape and face — what the server renders. */
export function restPose(shape: ShapeId, face: FaceId): Pose {
  const f = FACES[face];
  return {
    radii: SHAPES[shape],
    gaze: f.gaze,
    split: f.split,
    eyes: f.eyes,
    lid: 1,
    breath: 1,
    driftX: 0,
    driftY: 0,
  };
}

/** Pose → SVG strings. Pure, and the only place geometry is turned into markup. */
export function renderPose(pose: Pose, scale = 100): Frame {
  const body = silhouettePath(
    pose.radii,
    { sy: pose.breath, sx: 2 - pose.breath, cx: pose.driftX, cy: pose.driftY },
    scale,
  );

  const projected = projectEyes(pose.gaze, scale, pose.split);
  const eyes = projected.map((p, i) => {
    if (p.depth <= 0.02) return { d: "", transform: "", opacity: 0 };
    const spec = pose.eyes[i];
    // scale the eye by the local body radius so it stays inside a droplet's point
    const rr = radiusAt(pose.radii, Math.atan2(p.y, p.x));
    const open = 0.06 + 0.94 * clamp(Math.min(pose.lid, spec.open ?? 1));
    const t = rad(spec.tilt ?? 0);
    const ct = Math.cos(t);
    const st = Math.sin(t);
    return {
      d: eyePath(spec.w * scale * rr, spec.h * scale * rr * open),
      transform:
        `matrix(${r2(p.a * ct + p.c * st)},${r2(p.b * ct + p.d * st)},` +
        `${r2(-p.a * st + p.c * ct)},${r2(-p.b * st + p.d * ct)},` +
        `${r2(p.x * rr)},${r2(p.y * rr)})`,
      opacity: 1,
    };
  });

  return { body, eyes };
}

/* --------------------------------------------------------------------- rig */

export type RigInput = {
  shape: ShapeId;
  face: FaceId;
  /** where to look, in −1…1 of the viewport from the avatar's centre */
  look: { x: number; y: number } | null;
  /** breathing, drift, blinking, saccades */
  idle: boolean;
  /** seconds a shape change takes */
  morph: number;
};

/** How far the pupils travel for a cursor at the edge of the screen. */
const LOOK_YAW = 42;
const LOOK_PITCH = 32;

/**
 * The animation state machine: springs, blink schedule, saccades, shape morph.
 *
 * It exists so the component stays a component. Everything with a memory of the
 * last frame lives here, and `update` is the only thing the rAF loop calls.
 */
export class ClayRig {
  private last = -1;
  private drawn: ShapeId;
  private from: Radii;
  private morphAt = -999;

  private gaze: [Spring, Spring, Spring];
  private box: Spring[]; // split, then w/h/tilt/open per eye

  private blinkAt = 1.6 + Math.random() * 3;
  private blinkAgain = -1;
  private sacAt = 0;
  private sacX = 0;
  private sacY = 0;

  /** false once every spring has stopped and nothing is scheduled */
  settled = false;

  constructor(shape: ShapeId, face: FaceId) {
    this.drawn = shape;
    this.from = SHAPES[shape];
    const f = FACES[face];
    this.gaze = [spring(f.gaze.yaw), spring(f.gaze.pitch), spring(f.gaze.roll)];
    this.box = [spring(f.split), ...f.eyes.flatMap((e) => eyeSprings(e))];
  }

  update(input: RigInput, t: number): Pose {
    // a hidden tab hands back a dt of several seconds; springs explode on that
    const dt = this.last < 0 ? 1 / 60 : clamp(t - this.last, 0, 1 / 30);
    this.last = t;

    const f = FACES[input.face];
    const moving = input.idle;

    // ---- shape: eased, not sprung. A silhouette that overshoots inverts.
    if (input.shape !== this.drawn) {
      this.from = this.radiiAt(input.morph, t);
      this.morphAt = t;
      this.drawn = input.shape;
    }
    const radii = this.radiiAt(input.morph, t);

    // ---- saccades: the eyes never hold perfectly still, even at rest
    if (moving && t > this.sacAt) {
      this.sacAt = t + 0.9 + Math.random() * 2.2;
      this.sacX = (Math.random() - 0.5) * 5;
      this.sacY = (Math.random() - 0.5) * 4;
    }

    // ---- gaze: sprung towards the cursor rather than pinned to it. Pinning is
    // what makes cursor-tracking read as a mechanism instead of attention.
    // `look.y` counts downward, because that is how a viewport measures; pitch
    // counts upward, because that is how a head works. Hence the minus — with a
    // plus the avatar dutifully looks away from the cursor.
    const look = input.look;
    const target: Gaze = look
      ? {
          yaw: clamp(f.gaze.yaw * 0.25 + look.x * LOOK_YAW, -46, 46),
          pitch: clamp(f.gaze.pitch * 0.25 - look.y * LOOK_PITCH, -38, 38),
          roll: f.gaze.roll + look.x * 5,
        }
      : f.gaze;

    const gaze: Gaze = {
      yaw: springTo(this.gaze[0], target.yaw + (moving ? this.sacX : 0), 0.34, 0, dt),
      pitch: springTo(this.gaze[1], target.pitch + (moving ? this.sacY : 0), 0.34, 0, dt),
      roll: springTo(this.gaze[2], target.roll, 0.5, 0, dt),
    };

    // ---- expression: sprung with a trace of bounce, so a face lands rather
    // than arrives. 0.38s is slow for UI and right for a face.
    const want = [f.split, ...f.eyes.flatMap((e) => [e.w, e.h, e.tilt ?? 0, e.open ?? 1])];
    const got = this.box.map((s, i) => springTo(s, want[i], 0.38, 0.14, dt));

    // ---- blink
    if (moving && t > this.blinkAt + BLINK_TOTAL) {
      if (this.blinkAgain > 0) {
        this.blinkAt = this.blinkAgain;
        this.blinkAgain = -1;
      } else {
        this.blinkAt = t + 2.6 + Math.random() * 4.5;
        // one in five is a double: the detail nobody notices and everybody feels
        this.blinkAgain = Math.random() < 0.2 ? this.blinkAt + 0.28 : -1;
      }
    }
    const lid = moving ? blinkLid(t - this.blinkAt) : 1;

    this.settled =
      !moving &&
      !look &&
      t - this.morphAt > input.morph &&
      this.gaze.every((s) => s.vel === 0) &&
      this.box.every((s) => s.vel === 0);

    return {
      radii,
      gaze,
      split: got[0],
      eyes: [
        { w: got[1], h: got[2], tilt: got[3], open: got[4] },
        { w: got[5], h: got[6], tilt: got[7], open: got[8] },
      ],
      lid,
      breath: moving ? 1 + 0.006 * Math.sin((t / 3.4) * TAU) : 1,
      driftX: moving ? 0.006 * Math.sin(t * 1.1) : 0,
      driftY: moving ? 0.007 * Math.sin(t * 0.8 + 1.3) : 0,
    };
  }

  private radiiAt(morph: number, t: number): Radii {
    const k = morph <= 0 ? 1 : clamp((t - this.morphAt) / morph);
    // in-out, not out: a morph is movement across the screen, not an entrance
    return k >= 1
      ? SHAPES[this.drawn]
      : blendRadii(this.from, SHAPES[this.drawn], easings.inOutCubic(k));
  }
}

const eyeSprings = (e: Eye): Spring[] => [
  spring(e.w),
  spring(e.h),
  spring(e.tilt ?? 0),
  spring(e.open ?? 1),
];
