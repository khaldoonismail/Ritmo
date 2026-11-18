import type { Expression, Fx } from "./art";

// Expressive cut-out animation, shared by every character and both
// renderers. Angles in degrees, SVG convention (positive = clockwise), in
// the 200 × 240 character canvas; the runner faces right.
//   run    bouncy: up-and-down with squash on each step, legs and arms swing
//   hop    a quick stretchy jump with squash on landing
//   happy  a big cheer: jump, arms up, wiggle, eyes squint, mouth wide
//   sad    head and arms droop, droopy eyes, frown, a tear
//   bump   "Too late!": knocked back, leaning back, dizzy with stars (held)
//   idle   breathing, a little sway, blinking

export type State = "idle" | "run" | "hop" | "happy" | "sad" | "bump";

export interface Pose {
  x: number;
  y: number; // up is negative
  lean: number; // around the hips
  sx: number; // squash / stretch around the hips
  sy: number;
  head: number; // around the neck
  headY: number;
  armF: number;
  armB: number;
  legF: number;
  legB: number;
  tail: number;
  armStretch: number; // rubbery arms: longer when cheering
  expr: Expression;
  fx: Fx;
}

// How long a one-off state lasts before going back to run / idle (bump is
// held until reset).
export const STATE_LENGTH: Record<State, number> = {
  idle: Infinity,
  run: Infinity,
  hop: 0.42,
  happy: 0.9,
  sad: 1.0,
  bump: Infinity,
};

const blinkAt = (t: number) => t % 3.1 < 0.13 || (t + 1.3) % 5.7 < 0.13;

// `t` = seconds since the state started; `clock` = seconds since the
// character was created (for breathing / blinking); `speed` scales the run.
export function pose(state: State, t: number, clock: number, speed = 1): Pose {
  const p: Pose = {
    x: 0,
    y: 0,
    lean: 0,
    sx: 1,
    sy: 1,
    head: 0,
    headY: 0,
    armF: 0,
    armB: 0,
    legF: 0,
    legB: 0,
    tail: Math.sin(clock * 2.2) * 6,
    armStretch: 1,
    expr: blinkAt(clock) ? "blink" : "idle",
    fx: "none",
  };

  if (state === "idle") {
    const b = Math.sin(clock * 2.4);
    p.sy = 1 + b * 0.018;
    p.sx = 1 - b * 0.012;
    p.armF = -4 + Math.sin(clock * 2.4 + 0.5) * 3;
    p.armB = 4 - Math.sin(clock * 2.4 + 0.5) * 3;
    p.head = Math.sin(clock * 1.3) * 2.5;
    return p;
  }

  if (state === "run") {
    const f = clock * (8.5 + speed * 0.5);
    const s = Math.sin(f);
    const up = Math.abs(Math.sin(f));
    p.y = -up * 14;
    p.sy = 1 - (1 - up) * 0.07;
    p.sx = 1 + (1 - up) * 0.05;
    p.lean = 8;
    p.legF = s * 38;
    p.legB = -s * 38;
    p.armF = -s * 48;
    p.armB = s * 48;
    p.head = -3 + Math.sin(f * 2) * 2;
    p.tail = Math.sin(f * 2) * 14;
    return p;
  }

  if (state === "hop") {
    const k = Math.min(1, t / STATE_LENGTH.hop);
    const arc = Math.sin(k * Math.PI);
    p.y = -arc * 42;
    p.sy = k < 0.1 || k > 0.9 ? 0.9 : 1 + arc * 0.08;
    p.sx = k < 0.1 || k > 0.9 ? 1.08 : 1 - arc * 0.05;
    p.legF = -24 * arc;
    p.legB = 18 * arc;
    p.armF = -70 * arc;
    p.armB = -40 * arc;
    p.lean = 4;
    return p;
  }

  if (state === "happy") {
    const k = Math.min(1, t / 0.7);
    const arc = Math.sin(k * Math.PI);
    p.y = -arc * 56;
    p.sy = 1 + arc * 0.06;
    p.lean = Math.sin(t * 14) * 7;
    // "Hooray!": both arms up and out wide, stretched (cartoon-rubbery)
    // so the hands clear the big head and the face stays in view.
    p.armF = -104 + Math.sin(t * 16) * 8;
    p.armB = 112 - Math.sin(t * 16) * 8;
    p.armStretch = 1.45;
    p.legF = -18 * arc;
    p.legB = 14 * arc;
    p.head = Math.sin(t * 14) * 5;
    p.tail = Math.sin(t * 18) * 20;
    p.expr = "happy";
    p.fx = "sparkle";
    return p;
  }

  if (state === "sad") {
    const k = Math.min(1, t / 0.25);
    p.head = 12 * k + Math.sin(t * 2) * 2;
    p.headY = 5 * k;
    p.lean = -3 * k;
    p.sy = 1 - 0.04 * k;
    p.sx = 1 + 0.02 * k;
    p.armF = 4;
    p.armB = -2;
    p.tail = -10 * k;
    p.expr = "sad";
    p.fx = "tear";
    return p;
  }

  // bump
  const k = Math.min(1, t / 0.15);
  p.x = -22 * k;
  p.y = t < 0.32 ? -Math.sin((t / 0.32) * Math.PI) * 20 : 0;
  p.lean = -14 * k;
  p.head = -6 * k + Math.sin(t * 5) * 5;
  p.armF = 35 * k;
  p.armB = 50 * k;
  p.legF = -14 * k;
  p.legB = 6 * k;
  p.sy = t > 0.3 && t < 0.42 ? 0.92 : 1;
  p.expr = "bump";
  p.fx = "stars";
  return p;
}
