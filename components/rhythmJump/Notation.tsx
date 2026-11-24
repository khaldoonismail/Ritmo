"use client";

import { memo } from "react";
import { layoutPattern, type Layout, type Token } from "@/lib/rhythmJump";

// A rhythm on a one-line staff, drawn from lib/rhythmJump.ts's layout:
// time signature, note heads (filled; hollow for half, dotted half and
// whole notes; a dot for dotted notes), stems up (none on a whole note),
// beams (a second beam for sixteenths), flags for a short note alone in its
// beat, whole / half / quarter / eighth rests, bar lines and a final double
// bar, and (optional) rhythm syllables under the notes. `bare` draws just
// the notes on a short line (the value symbols in the settings).
// `current` = the element being played (orange); earlier ones turn grey.

export const INK = "#2B2745";
const ORANGE = "#F28C28";
const PAST = "#9C98B0";

const LINE = 58;
const STEM = 44;
const LEFT = 62;
const PER_BEAT = 60;

function QuarterRest({ x, color }: { x: number; color: string }) {
  return (
    <path
      transform={`translate(${x} ${LINE})`}
      fill={color}
      d="M-2,-22 L7,-11 C3,-7 2,-3 6,2 L9,6 C3,4 -3,6 1,13 C-7,8 -6,0 2,1 L-5,-7 C-1,-11 0,-15 -2,-22 Z"
    />
  );
}

// Whole rest: a block hanging under the line; half rest: sitting on it.
function BlockRest({ x, color, hanging }: { x: number; color: string; hanging: boolean }) {
  return <rect x={x - 9} y={hanging ? LINE : LINE - 8} width={18} height={8} fill={color} />;
}

function EighthRest({ x, color }: { x: number; color: string }) {
  return (
    <g fill={color} stroke={color}>
      <circle cx={x - 3} cy={LINE - 10} r={3.6} stroke="none" />
      <path d={`M${x - 3},${LINE - 7} Q${x + 2},${LINE - 5} ${x + 6},${LINE - 12} L${x - 1},${LINE + 12}`} fill="none" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  );
}

function Rest({ token, x, color }: { token: Token; x: number; color: string }) {
  if (token === "wr") return <BlockRest x={x} color={color} hanging />;
  if (token === "hr") return <BlockRest x={x} color={color} hanging={false} />;
  if (token === "er") return <EighthRest x={x} color={color} />;
  return <QuarterRest x={x} color={color} />;
}

function Flag({ x, color, n }: { x: number; color: string; n: number }) {
  return (
    <g fill={color}>
      {Array.from({ length: n }, (_, i) => (
        <path key={i} transform={`translate(${x} ${LINE - STEM + i * 9})`} d="M0,0 C2,8 13,11 11,24 C10,16 5,12 0,11 Z" />
      ))}
    </g>
  );
}

function width(beats: number): number {
  return Math.max(beats < 0.5 ? 30 : 38, beats * PER_BEAT);
}

function NotationImpl({
  layout,
  current,
  syllables,
  height,
  hidden = false,
  bare = false,
}: {
  layout: Layout;
  current: number;
  syllables: boolean;
  height: number;
  hidden?: boolean;
  bare?: boolean;
}) {
  const xs: number[] = [];
  const barEnds: number[] = [];
  let x = bare ? 12 : LEFT;
  layout.elements.forEach((e, i) => {
    xs.push(x + 14);
    // Bare symbols: long values take no more room than a quarter.
    x += width(bare ? Math.min(e.beats, 1) : e.beats);
    const next = layout.elements[i + 1];
    if (!next || next.bar !== e.bar) {
      barEnds.push(x);
      x += 14;
    }
  });
  const W = bare ? x - 14 + 4 : x;
  // Bare symbols are cropped to the notes (stem tops to just under the line).
  const top = bare ? 8 : 0;
  const H = syllables ? 106 : bare ? 64 : 86;
  const colorOf = (i: number) => (i === current ? ORANGE : current >= 0 && i < current ? PAST : INK);
  const stemX = (i: number) => xs[i] + 7.4;

  return (
    <svg
      viewBox={`0 ${top} ${W} ${H}`}
      style={{ height, width: (W / H) * height, maxWidth: "100%", display: "block", visibility: hidden ? "hidden" : "visible" }}
      role="img"
      aria-label={`Rhythm in ${layout.meter}/4: ${layout.elements.map((e) => e.syllable).join(", ")}`}
    >
      <line x1={bare ? 0 : 8} x2={bare ? W : W - 4} y1={LINE} y2={LINE} stroke={INK} strokeWidth={2} opacity={bare ? 0.35 : 1} />
      {!bare && <g fontSize={30} fontWeight={900} fontFamily="Georgia, 'Times New Roman', serif" fill={INK} textAnchor="middle">
        <text x={30} y={LINE - 4}>
          {layout.meter}
        </text>
        <text x={30} y={LINE + 26}>
          4
        </text>
      </g>}

      {layout.elements.map((e, i) => {
        const c = colorOf(i);
        const nx = xs[i];
        return (
          <g key={i}>
            {e.rest ? (
              <Rest token={e.token} x={nx} color={c} />
            ) : (
              <>
                <ellipse
                  cx={nx}
                  cy={LINE}
                  rx={e.token === "w" ? 11 : 9.5}
                  ry={e.token === "w" ? 7.4 : 6.8}
                  transform={`rotate(${e.token === "w" ? -12 : -22} ${nx} ${LINE})`}
                  fill={e.hollow ? "white" : c}
                  stroke={c}
                  strokeWidth={e.hollow ? (e.token === "w" ? 3.4 : 2.6) : 0}
                />
                {e.dotted && <circle cx={nx + 17} cy={LINE - 5} r={3.2} fill={c} />}
                {e.token !== "w" && <rect x={stemX(i)} y={LINE - STEM} width={2.4} height={STEM - 1} fill={c} />}
                {e.flags > 0 && <Flag x={stemX(i) + 2.4} color={c} n={e.flags} />}
              </>
            )}
            {syllables && (
              <text x={nx} y={LINE + 40} textAnchor="middle" fontSize={17} fontWeight={800} fill={i === current ? ORANGE : "#6B6780"}>
                {e.syllable}
              </text>
            )}
          </g>
        );
      })}

      {layout.beams.map((bm, k) => {
        const first = bm.notes[0];
        const last = bm.notes[bm.notes.length - 1];
        const c = bm.notes.includes(current) ? ORANGE : current >= 0 && last < current ? PAST : INK;
        return (
          <g key={k} fill={c}>
            <rect x={stemX(first)} y={LINE - STEM - 2} width={stemX(last) + 2.4 - stemX(first)} height={7} />
            {bm.secondary.map((run, j) => (
              <rect key={j} x={stemX(run[0])} y={LINE - STEM + 8} width={stemX(run[run.length - 1]) + 2.4 - stemX(run[0])} height={6} />
            ))}
          </g>
        );
      })}

      {!bare && barEnds.map((bx, b) => {
        const last = b === barEnds.length - 1;
        return (
          <g key={b} fill={INK}>
            <rect x={bx - 2} y={LINE - 20} width={2} height={40} />
            {last && <rect x={bx + 4} y={LINE - 20} width={6} height={40} />}
          </g>
        );
      })}
    </svg>
  );
}

export const Notation = memo(NotationImpl);

// One value's symbol (e.g. a beamed eighth pair), for the settings.
export function ValueSymbol({ tokens, height = 40 }: { tokens: Token[]; height?: number }) {
  const layout = layoutPattern({ meter: 4, bars: [tokens] });
  return <Notation layout={layout} current={-1} syllables={false} height={height} bare />;
}
