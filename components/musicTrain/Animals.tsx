"use client";

import type { Driver } from "./Train";

// The three drivers drawn whole, in our cartoon style (soft fills, dark
// outlines, pink cheeks), for the answer buttons and messages: drawn as
// SVG so they look the same on every device (no emoji).

const INK = "#2B2745";

function Eyes({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <g>
      <circle cx={x1} cy={y} r={3.4} fill={INK} />
      <circle cx={x2} cy={y} r={3.4} fill={INK} />
      <circle cx={x1 + 1.1} cy={y - 1.2} r={1.1} fill="white" />
      <circle cx={x2 + 1.1} cy={y - 1.2} r={1.1} fill="white" />
    </g>
  );
}

function Turtle() {
  return (
    <g strokeLinejoin="round">
      {/* legs and tail */}
      <path d="M26,70 l-4,12 h10 l2,-12 Z M62,70 l-2,12 h10 l-2,-12 Z" fill="#6DBE5E" stroke="#3F8A3B" strokeWidth={2.5} />
      <path d="M14,64 L4,70 L16,70 Z" fill="#6DBE5E" stroke="#3F8A3B" strokeWidth={2.5} />
      {/* head */}
      <circle cx={84} cy={52} r={14} fill="#86D474" stroke="#3F8A3B" strokeWidth={2.5} />
      <Eyes x1={80} x2={89} y={49} />
      <ellipse cx={93} cy={56} rx={2.6} ry={1.6} fill="#FF9EC4" opacity={0.8} />
      <path d="M81,58 Q85,61 89,58" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* shell */}
      <path d="M12,70 Q12,26 44,24 Q76,26 76,70 Z" fill="#F2B84B" stroke="#B07A20" strokeWidth={2.5} />
      <path d="M44,34 L56,42 L52,56 L36,56 L32,42 Z" fill="#E59B2E" stroke="#B07A20" strokeWidth={2} />
      <path d="M44,34 L44,26 M56,42 L70,40 M52,56 L60,68 M36,56 L28,68 M32,42 L18,40" stroke="#B07A20" strokeWidth={2} />
      <rect x={8} y={66} width={72} height={8} rx={4} fill="#86D474" stroke="#3F8A3B" strokeWidth={2.5} />
    </g>
  );
}

function Dog() {
  return (
    <g strokeLinejoin="round">
      {/* body and paws */}
      <ellipse cx={50} cy={68} rx={22} ry={17} fill="#D9A066" stroke="#8A5A34" strokeWidth={2.5} />
      <ellipse cx={50} cy={72} rx={11} ry={10} fill="#F3D3AE" />
      <ellipse cx={39} cy={84} rx={7} ry={4.5} fill="#F3D3AE" stroke="#8A5A34" strokeWidth={2.5} />
      <ellipse cx={61} cy={84} rx={7} ry={4.5} fill="#F3D3AE" stroke="#8A5A34" strokeWidth={2.5} />
      <path d="M71,66 Q84,58 80,48" stroke="#8A5A34" strokeWidth={6} fill="none" strokeLinecap="round" />
      {/* head */}
      <path d="M30,24 Q20,30 24,50 Q30,54 34,44 Z" fill="#8A5A34" stroke="#6B4426" strokeWidth={2} />
      <path d="M70,24 Q80,30 76,50 Q70,54 66,44 Z" fill="#8A5A34" stroke="#6B4426" strokeWidth={2} />
      <circle cx={50} cy={36} r={19} fill="#D9A066" stroke="#8A5A34" strokeWidth={2.5} />
      <ellipse cx={50} cy={44} rx={10} ry={8} fill="#F3D3AE" />
      <Eyes x1={43} x2={57} y={33} />
      <ellipse cx={50} cy={40} rx={3.6} ry={2.6} fill={INK} />
      <path d="M50,42.5 Q46,47 43,45 M50,42.5 Q54,47 57,45" stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <path d="M48,46 Q50,52 52,46 Z" fill="#FF7AB6" />
      <ellipse cx={37} cy={41} rx={3} ry={1.8} fill="#FF9EC4" opacity={0.8} />
      <ellipse cx={63} cy={41} rx={3} ry={1.8} fill="#FF9EC4" opacity={0.8} />
    </g>
  );
}

function Rabbit() {
  return (
    <g strokeLinejoin="round">
      {/* ears */}
      <ellipse cx={40} cy={14} rx={7} ry={17} fill="#F4F1F8" stroke="#9C93B0" strokeWidth={2.5} transform="rotate(-10 40 14)" />
      <ellipse cx={40} cy={15} rx={3} ry={12} fill="#FFB8D2" transform="rotate(-10 40 15)" />
      <ellipse cx={60} cy={14} rx={7} ry={17} fill="#F4F1F8" stroke="#9C93B0" strokeWidth={2.5} transform="rotate(10 60 14)" />
      <ellipse cx={60} cy={15} rx={3} ry={12} fill="#FFB8D2" transform="rotate(10 60 15)" />
      {/* body and feet */}
      <ellipse cx={50} cy={68} rx={20} ry={17} fill="#F4F1F8" stroke="#9C93B0" strokeWidth={2.5} />
      <ellipse cx={38} cy={84} rx={9} ry={4.5} fill="#F4F1F8" stroke="#9C93B0" strokeWidth={2.5} />
      <ellipse cx={62} cy={84} rx={9} ry={4.5} fill="#F4F1F8" stroke="#9C93B0" strokeWidth={2.5} />
      <circle cx={71} cy={72} r={5} fill="white" stroke="#9C93B0" strokeWidth={2} />
      {/* head */}
      <circle cx={50} cy={40} r={17} fill="#F4F1F8" stroke="#9C93B0" strokeWidth={2.5} />
      <Eyes x1={43} x2={57} y={38} />
      <path d="M47.5,44 L52.5,44 L50,47 Z" fill="#FF7AB6" />
      <path d="M50,47 Q46.5,51 43.5,48.5 M50,47 Q53.5,51 56.5,48.5" stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <ellipse cx={39} cy={45} rx={3} ry={1.8} fill="#FF9EC4" opacity={0.8} />
      <ellipse cx={61} cy={45} rx={3} ry={1.8} fill="#FF9EC4" opacity={0.8} />
    </g>
  );
}

export function AnimalIcon({ kind, size = 48, label }: { kind: Driver; size?: number; label?: string }) {
  return (
    <svg
      viewBox="0 -4 100 94"
      width={size}
      height={size * 0.94}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ display: "block", overflow: "visible" }}
    >
      {kind === "turtle" ? <Turtle /> : kind === "dog" ? <Dog /> : <Rabbit />}
    </svg>
  );
}

// "🐢 → 🐇" without emoji: two animals and an arrow.
export function AnimalChange({ from, to, size = 40 }: { from: Driver; to: Driver; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.12 }} aria-hidden="true">
      <AnimalIcon kind={from} size={size} />
      <svg viewBox="0 0 24 16" width={size * 0.5} height={size * 0.34}>
        <path d="M2,8 H18 M12,2 L20,8 L12,14" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <AnimalIcon kind={to} size={size} />
    </span>
  );
}
