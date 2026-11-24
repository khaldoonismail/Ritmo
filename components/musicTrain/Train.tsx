"use client";

import { useId } from "react";
import SvgPuppet from "@/components/characters/SvgPuppet";
import type { CharacterChoice } from "@/components/characters/choice";

// The Music Train, facing right: carriages (each with a passenger, one of
// our 5 characters, at the window) and the locomotive at the front with the
// driver in the cab: 🐢 Turtle, 🐕 Dog or 🐇 Rabbit (or an empty cab with
// a "?" while the child decides). Everything is sized from the train's
// height (`h`, px). The wheels and the connecting rod are turned by the
// game straight on the DOM, every frame, from the beat (turnWheels below),
// so React never re-renders the train while it runs.

import type { Driver } from "@/lib/fastOrSlow/music";
export type { Driver };

const LOCO_W = 1.9; // × h
// A carriage's window (viewBox 125 × 100): tall enough for a whole head.
const WIN = { x: 14, y: 27, w: 97, h: 42 };
// Where the passenger sits in it (the puppet's art: viewBox y −80…250,
// the character from y≈0): people and animals show their whole head (ears
// included); Ritmo, a note, fits whole (its face is on the note head).
const HEAD_FIT = (h: number) => ({ top: -h * 0.225, width: h * 0.85 });
const NOTE_FIT = (h: number) => ({ top: -h * 0.12, width: h * 0.47 });
const CAR_W = 1.25;

const CAR_COLORS = [
  { body: "#2EA8FF", trim: "#1F7FC4" },
  { body: "#FFC93C", trim: "#D9A21F" },
  { body: "#2BC48A", trim: "#1E9A6B" },
  { body: "#8B5CF6", trim: "#6A3FD0" },
  { body: "#FF7AB6", trim: "#D9558F" },
];

function Wheel({ cx, cy, r, turn }: { cx: number; cy: number; r: number; turn: number }) {
  return (
    <g data-wheel="" data-cx={cx} data-cy={cy} transform={`translate(${cx} ${cy}) rotate(${turn})`}>
      <circle r={r} fill="#3D3A4F" />
      <circle r={r * 0.78} fill="#5C5872" />
      {[0, 45, 90, 135].map((a) => (
        <rect key={a} x={-r * 0.74} y={-1.4} width={r * 1.48} height={2.8} fill="#3D3A4F" transform={`rotate(${a})`} />
      ))}
      <circle r={r * 0.22} fill="#FFD23F" />
    </g>
  );
}

// The driver's head (with an engineer's cap), drawn at (0,0), ~36 units wide.
export function DriverHead({ driver }: { driver: Driver | null }) {
  if (!driver) {
    return (
      <text x={0} y={10} textAnchor="middle" fontSize={30} fontWeight={900} fill="#F28C28" fontFamily="inherit">
        ?
      </text>
    );
  }
  const cap = (
    <g>
      <path d="M-15,-12 Q0,-26 15,-12 L15,-8 L-15,-8 Z" fill="#3B5BDB" />
      <path d="M-15,-8 L20,-8 L22,-5 L-15,-5 Z" fill="#2C44A8" />
      <path d="M-11,-16 L11,-16 M-13,-12 L13,-12" stroke="white" strokeWidth={1.6} opacity={0.8} />
    </g>
  );
  const eyes = (
    <g fill="#2B2745">
      <circle cx={-5} cy={0} r={2.2} />
      <circle cx={5} cy={0} r={2.2} />
      <circle cx={-4.3} cy={-0.7} r={0.7} fill="white" />
      <circle cx={5.7} cy={-0.7} r={0.7} fill="white" />
    </g>
  );
  if (driver === "turtle") {
    return (
      <g>
        <ellipse cx={0} cy={2} rx={14} ry={13} fill="#7CCB6B" stroke="#4E9A4A" strokeWidth={1.6} />
        <ellipse cx={-7} cy={7} rx={3} ry={1.8} fill="#FF9EC4" opacity={0.7} />
        <ellipse cx={7} cy={7} rx={3} ry={1.8} fill="#FF9EC4" opacity={0.7} />
        {eyes}
        <path d="M-4,7 Q0,10 4,7" stroke="#2B2745" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        {cap}
      </g>
    );
  }
  if (driver === "rabbit") {
    return (
      <g>
        <ellipse cx={-6} cy={-24} rx={4.5} ry={14} fill="#F4F1F8" stroke="#C9C2D6" strokeWidth={1.4} transform="rotate(-12 -6 -24)" />
        <ellipse cx={-6} cy={-24} rx={2} ry={10} fill="#FFB8D2" transform="rotate(-12 -6 -24)" />
        <ellipse cx={7} cy={-24} rx={4.5} ry={14} fill="#F4F1F8" stroke="#C9C2D6" strokeWidth={1.4} transform="rotate(14 7 -24)" />
        <ellipse cx={7} cy={-24} rx={2} ry={10} fill="#FFB8D2" transform="rotate(14 7 -24)" />
        <ellipse cx={0} cy={2} rx={13} ry={12.5} fill="#F4F1F8" stroke="#C9C2D6" strokeWidth={1.4} />
        <ellipse cx={-7} cy={7} rx={3} ry={1.8} fill="#FF9EC4" opacity={0.7} />
        <ellipse cx={7} cy={7} rx={3} ry={1.8} fill="#FF9EC4" opacity={0.7} />
        {eyes}
        <path d="M-1.5,4.5 L1.5,4.5 L0,6.5 Z" fill="#FF7AB6" />
        <path d="M0,6.5 Q-3,9 -5,7.5 M0,6.5 Q3,9 5,7.5" stroke="#2B2745" strokeWidth={1.2} fill="none" strokeLinecap="round" />
        {cap}
      </g>
    );
  }
  return (
    <g>
      <ellipse cx={-13} cy={2} rx={5} ry={10} fill="#8A5A34" transform="rotate(18 -13 2)" />
      <ellipse cx={13} cy={2} rx={5} ry={10} fill="#8A5A34" transform="rotate(-18 13 2)" />
      <ellipse cx={0} cy={2} rx={12.5} ry={12.5} fill="#D9A066" stroke="#B07445" strokeWidth={1.4} />
      <ellipse cx={0} cy={7} rx={6.5} ry={5} fill="#F3D3AE" />
      {eyes}
      <ellipse cx={0} cy={5} rx={2.6} ry={1.9} fill="#2B2745" />
      <path d="M0,7 Q-2.5,9.5 -4.5,8 M0,7 Q2.5,9.5 4.5,8" stroke="#2B2745" strokeWidth={1.2} fill="none" strokeLinecap="round" />
      {cap}
    </g>
  );
}

export function Locomotive({ h, driver, wheel = 0 }: { h: number; driver: Driver | null; wheel?: number }) {
  const clipId = `cab${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 190 100" style={{ width: h * LOCO_W, height: h, display: "block", overflow: "visible" }} aria-hidden="true">
      {/* cab */}
      <rect x={4} y={14} width={58} height={66} rx={6} fill="#E8524A" />
      <rect x={0} y={8} width={66} height={10} rx={4} fill="#3D3A4F" />
      {/* the cab window, tall enough for the whole driver (rabbit ears too) */}
      <clipPath id={clipId}>
        <rect x={12} y={21} width={42} height={39} rx={6} />
      </clipPath>
      <rect x={12} y={21} width={42} height={39} rx={6} fill="#FFF3D6" />
      <g clipPath={`url(#${clipId})`}>
        <g transform={driver === "rabbit" ? "translate(33 48) scale(0.66)" : "translate(33 43) scale(0.8)"}>
          <DriverHead driver={driver} />
        </g>
      </g>
      <rect x={12} y={21} width={42} height={39} rx={6} fill="none" stroke="#C63D36" strokeWidth={3} />
      {/* boiler */}
      <rect x={58} y={36} width={98} height={44} rx={18} fill="#E8524A" />
      <rect x={58} y={48} width={98} height={5} fill="#FFD23F" />
      <rect x={58} y={64} width={98} height={5} fill="#FFD23F" />
      <rect x={150} y={34} width={18} height={48} rx={8} fill="#3D3A4F" />
      <circle cx={170} cy={56} r={6} fill="#FFE27A" stroke="#3D3A4F" strokeWidth={3} />
      {/* dome and chimney */}
      <rect x={96} y={24} width={22} height={16} rx={10} fill="#FFD23F" />
      <path d="M128,36 L126,14 L120,8 L148,8 L142,14 L140,36 Z" fill="#3D3A4F" />
      {/* chassis, cowcatcher */}
      <rect x={4} y={78} width={166} height={8} rx={3} fill="#3D3A4F" />
      <path d="M168,74 L186,92 L160,92 Z" fill="#C63D36" />
      <Wheel cx={40} cy={84} r={15} turn={wheel} />
      <Wheel cx={92} cy={84} r={15} turn={wheel} />
      <Wheel cx={146} cy={88} r={10} turn={wheel * 1.5} />
      {/* connecting rod, moving with the wheels */}
      <rect
        data-rod=""
        x={40 + 9 * Math.cos((wheel * Math.PI) / 180) - 2}
        y={84 + 9 * Math.sin((wheel * Math.PI) / 180) - 2}
        width={56}
        height={4}
        rx={2}
        fill="#B8C2CF"
      />
    </svg>
  );
}

export function Carriage({ h, passenger, color, wheel = 0 }: { h: number; passenger: CharacterChoice | null; color: number; wheel?: number }) {
  const c = CAR_COLORS[color % CAR_COLORS.length];
  const w = h * CAR_W;
  return (
    <div style={{ position: "relative", width: w, height: h, flex: "0 0 auto" }}>
      <svg viewBox="0 0 125 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} aria-hidden="true">
        <rect x={2} y={16} width={121} height={10} rx={5} fill={c.trim} />
        <rect x={5} y={22} width={115} height={58} rx={8} fill={c.body} />
        <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx={8} fill="#FFF3D6" />
        <rect x={5} y={71.5} width={115} height={4} fill={c.trim} />
        <rect x={0} y={78} width={125} height={7} rx={3} fill="#3D3A4F" />
        <rect x={-8} y={74} width={12} height={4} fill="#3D3A4F" />
      </svg>
      {passenger && (
        // Clipped to the window: the whole head (ears too) fits inside, the
        // shoulders are cut by the window's bottom edge.
        <div style={{ position: "absolute", left: `${(WIN.x / 125) * 100}%`, top: `${WIN.y}%`, width: `${(WIN.w / 125) * 100}%`, height: `${WIN.h}%`, overflow: "hidden", borderRadius: h * 0.06 }}>
          <SvgPuppet
            choice={passenger}
            state="idle"
            freezeAt={0.3}
            style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", ...(passenger.kind === "note" ? NOTE_FIT(h) : HEAD_FIT(h)) }}
          />
        </div>
      )}
      <svg viewBox="0 0 125 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }} aria-hidden="true">
        {/* window frame over the passenger, then wheels */}
        <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} rx={8} fill="none" stroke={c.trim} strokeWidth={3} />
        <Wheel cx={30} cy={86} r={11} turn={wheel} />
        <Wheel cx={95} cy={86} r={11} turn={wheel} />
      </svg>
    </div>
  );
}

// Puffs of steam: `puffs` = each puff's age 0..1 (0 = just out of the
// chimney); drawn above the chimney, drifting back and up as they age.
export function Steam({ h, puffs }: { h: number; puffs: number[] }) {
  return (
    <svg viewBox="-160 -120 200 140" style={{ position: "absolute", width: h * 2, height: h * 1.4, overflow: "visible", pointerEvents: "none" }} aria-hidden="true">
      {puffs.map((age, i) => (
        <g key={i} transform={`translate(${-age * 130} ${-age * 70}) scale(${0.5 + age * 0.9})`} opacity={1 - age * 0.85}>
          <g fill="white" stroke="#C9D6E2" strokeWidth={2.5}>
            <circle cx={-12} cy={4} r={10} />
            <circle cx={11} cy={5} r={9} />
            <circle cx={0} cy={0} r={14} />
          </g>
          <circle cx={-3} cy={-4} r={6} fill="#F4F8FB" />
        </g>
      ))}
    </svg>
  );
}

// Turns every wheel (and the rod) inside `root` to `degrees`.
export function turnWheels(root: HTMLElement | null, degrees: number) {
  if (!root) return;
  root.querySelectorAll<SVGGElement>("[data-wheel]").forEach((g) => {
    g.setAttribute("transform", `translate(${g.dataset.cx} ${g.dataset.cy}) rotate(${degrees.toFixed(1)})`);
  });
  const a = (degrees * Math.PI) / 180;
  root.querySelectorAll<SVGRectElement>("[data-rod]").forEach((r) => {
    r.setAttribute("x", (38 + 9 * Math.cos(a)).toFixed(2));
    r.setAttribute("y", (82 + 9 * Math.sin(a)).toFixed(2));
  });
}

export const trainWidth = (h: number, carriages: number) => h * LOCO_W + carriages * h * CAR_W;
export { LOCO_W, CAR_W };
