"use client";

import { useEffect, useMemo, useRef } from "react";
import { ROLES_BACK_TO_FRONT, VIEW, puppetArt, type Expression, type PuppetArt } from "./art";
import type { CharacterChoice } from "./choice";
import { STATE_LENGTH, pose, type Pose, type State } from "./pose";

// Draws a character as live SVG (selection screen, previews). The parts
// are moved with SVG transforms at ~30 fps; no 3D canvas needed.

export default function SvgPuppet({
  choice,
  state = "idle",
  reaction,
  freezeAt,
  className,
  style,
  label,
}: {
  choice: CharacterChoice;
  state?: State;
  // A one-off state (e.g. "happy" when chosen); a new `key` plays it again.
  reaction?: { state: State; key: number };
  // A still frame: `state` this many seconds in.
  freezeAt?: number;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}) {
  const art = useMemo(() => puppetArt(choice), [choice.kind, choice.skin, choice.outfit]); // eslint-disable-line react-hooks/exhaustive-deps
  const svgRef = useRef<SVGSVGElement>(null);
  const reactRef = useRef<{ state: State; start: number } | null>(null);
  const baseRef = useRef(state);
  baseRef.current = state;

  useEffect(() => {
    if (reaction) reactRef.current = { state: reaction.state, start: performance.now() };
  }, [reaction?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const nodes = findNodes(svg);
    let lastExpr: Expression | null = null;
    const born = performance.now();
    const draw = (p: Pose, t: number) => {
      apply(nodes, art, p);
      if (p.expr !== lastExpr) {
        nodes.face.innerHTML = art.face(p.expr);
        lastExpr = p.expr;
      }
      nodes.fx.innerHTML = p.fx === "none" ? "" : art.fx(p.fx, t);
    };
    if (freezeAt !== undefined) {
      draw(pose(state, freezeAt, freezeAt), freezeAt);
      return;
    }
    let raf = 0;
    let frame = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (++frame % 2 || document.hidden) return; // ~30 fps
      const now = performance.now();
      const clock = (now - born) / 1000;
      let s = baseRef.current;
      let t = clock;
      const r = reactRef.current;
      if (r) {
        const rt = (now - r.start) / 1000;
        if (rt < STATE_LENGTH[r.state]) {
          s = r.state;
          t = rt;
        } else reactRef.current = null;
      }
      draw(pose(s, t, clock), t);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [art, freezeAt, state]);

  return (
    <svg
      ref={svgRef}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      className={className}
      style={{ display: "block", overflow: "visible", ...style }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g data-root="">
        {ROLES_BACK_TO_FRONT.map((role) =>
          art.parts[role] ? (
            role === "head" ? (
              <g key={role} data-role={role}>
                <g dangerouslySetInnerHTML={{ __html: art.parts[role]! }} />
                <g data-face="" />
                <g data-fx="" />
              </g>
            ) : (
              <g key={role} data-role={role} dangerouslySetInnerHTML={{ __html: art.parts[role]! }} />
            )
          ) : null
        )}
      </g>
    </svg>
  );
}

interface Nodes {
  root: SVGGElement;
  roles: Partial<Record<string, SVGGElement>>;
  face: SVGGElement;
  fx: SVGGElement;
}

function findNodes(svg: SVGSVGElement): Nodes {
  const roles: Nodes["roles"] = {};
  svg.querySelectorAll<SVGGElement>("[data-role]").forEach((g) => (roles[g.dataset.role!] = g));
  return {
    root: svg.querySelector("[data-root]") as SVGGElement,
    roles,
    face: svg.querySelector("[data-face]") as SVGGElement,
    fx: svg.querySelector("[data-fx]") as SVGGElement,
  };
}

function apply(n: Nodes, art: PuppetArt, p: Pose) {
  const [hx, hy] = art.pivots.hips;
  n.root.setAttribute(
    "transform",
    `translate(${p.x} ${p.y}) rotate(${p.lean} ${hx} ${hy}) translate(${hx} ${hy}) scale(${p.sx} ${p.sy}) translate(${-hx} ${-hy})`
  );
  const rot = (role: keyof PuppetArt["pivots"], a: number, dy = 0, stretch = 1) => {
    const g = n.roles[role];
    if (!g) return;
    const [px, py] = art.pivots[role];
    const st = stretch === 1 ? "" : ` translate(${px} ${py}) scale(1 ${stretch}) translate(${-px} ${-py})`;
    g.setAttribute("transform", `translate(0 ${dy}) rotate(${a} ${px} ${py})${st}`);
  };
  rot("legF", p.legF);
  rot("legB", p.legB);
  rot("armF", p.armF, 0, p.armStretch);
  rot("armB", p.armB, 0, p.armStretch);
  rot("tail", p.tail);
  rot("head", p.head, p.headY);
}
