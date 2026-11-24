"use client";

import { forwardRef, memo, useImperativeHandle, useRef } from "react";
import SvgPuppet from "@/components/characters/SvgPuppet";
import type { CharacterChoice } from "@/components/characters/choice";
import { PARALLAX } from "@/lib/fastOrSlow/music";
import type { State as PuppetState } from "@/components/characters/pose";

// Music Train's countryside, in layers that scroll past while the train
// runs (the train itself stays put; the world moves):
//   sky and clouds (still) · far hills (slowest) · far trees · the field ·
//   near trees, bushes and poles, one every beat (`spacing` px apart) ·
//   the railway sleepers · the station and the conductor · the path,
//   flowers and fence in front (fastest).
// The game moves them with set(offset, stationStop) every frame: only
// transforms change, nothing re-renders, so it's light for old tablets.
// The station sits in place when offset = stationStop and scrolls away
// (and a new one arrives) as the train runs.

export interface SceneryHandle {
  set: (offset: number, stationStop: number) => void;
}

interface Props {
  w: number;
  h: number;
  railY: number; // % of the height
  spacing: number; // px between near trees (one beat)
  engineX: number; // px: where a near tree is on every beat
  trainH: number;
  conductor: CharacterChoice;
  conductorState?: PuppetState;
  conductorReaction?: { state: PuppetState; key: number };
  flag: "green" | "red";
  compact: boolean;
  // The end screen: the conductor stands in front, beside the stars card.
  endScreen?: boolean;
}

const mod = (a: number, m: number) => ((a % m) + m) % m;

function SceneryImpl(p: Props, ref: React.Ref<SceneryHandle>) {
  const hills = useRef<HTMLDivElement>(null);
  const farTrees = useRef<HTMLDivElement>(null);
  const near = useRef<HTMLDivElement>(null);
  const sleepers = useRef<HTMLDivElement>(null);
  const station = useRef<HTMLDivElement>(null);
  const conductor = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLDivElement>(null);

  const { w, h, railY, spacing, engineX, trainH } = p;
  const railPx = (h * railY) / 100;
  const hillsW = Math.max(w, 900) * 1.4;
  const farSpacing = spacing * 0.55;
  const sleeperGap = Math.max(26, trainH * 0.2);
  const frontW = Math.max(w, 900) * 1.2;
  const stationW = Math.min(w * 0.55, trainH * 2.4);

  useImperativeHandle(
    ref,
    () => ({
      set(offset, stationStop) {
        const tx = (el: HTMLDivElement | null, x: number) => {
          if (el) el.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
        };
        tx(hills.current, -mod(offset * PARALLAX.hills, hillsW));
        tx(farTrees.current, -mod(offset * PARALLAX.farTrees, farSpacing * 4));
        tx(near.current, -mod(offset * PARALLAX.near, spacing * 4));
        tx(sleepers.current, -mod(offset, sleeperGap));
        tx(front.current, -mod(offset * PARALLAX.foreground, frontW));
        const moved = offset - stationStop;
        tx(station.current, -moved);
        tx(conductor.current, -moved * PARALLAX.foreground);
      },
    }),
    [hillsW, farSpacing, spacing, sleeperGap, frontW]
  );

  // Near items: one every `spacing` px, so that one is at engineX at every
  // whole beat (see nearItemXs in lib/fastOrSlow/music.ts).
  const nearFirst = mod(engineX, spacing) - spacing;
  const nearCount = Math.ceil((w + spacing * 5) / spacing) + 1;
  const farCount = Math.ceil((w + farSpacing * 5) / farSpacing) + 1;

  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", background: "linear-gradient(#BFE6FF 0%, #E3F4FF 42%, #FFF1DC 64%)" }}>
      <Clouds />
      {/* far hills */}
      <div ref={hills} style={{ position: "absolute", left: 0, top: railPx - h * 0.4, width: hillsW * 2, height: h * 0.3, willChange: "transform" }}>
        {[0, 1].map((i) => (
          <svg key={i} viewBox="0 0 1600 300" preserveAspectRatio="none" style={{ position: "absolute", left: i * hillsW, top: 0, width: hillsW, height: "100%" }}>
            <path d="M0,150 C160,60 300,80 430,140 C560,40 760,50 880,130 C1000,70 1180,40 1320,120 C1440,80 1530,110 1600,150 L1600,300 L0,300 Z" fill="#A9C7F2" />
            <path d="M0,215 C220,150 420,170 640,200 C860,150 1080,160 1300,195 C1440,170 1540,190 1600,215 L1600,300 L0,300 Z" fill="#8FC98A" />
          </svg>
        ))}
      </div>
      {/* field */}
      <div style={{ position: "absolute", left: 0, right: 0, top: railPx - h * 0.14, bottom: 0, background: "linear-gradient(#9CD48A, #7CC171 70%)" }} />
      {/* far trees on the field's edge */}
      <div ref={farTrees} style={{ position: "absolute", left: 0, top: railPx - h * 0.14, width: 0, height: 0, willChange: "transform" }}>
        {Array.from({ length: farCount }, (_, j) => (
          <FarTree key={j} x={(j - 1) * farSpacing} size={trainH * (0.42 + 0.1 * (j % 3))} kind={j % 4} />
        ))}
      </div>
      {/* near trees, bushes and poles: one per beat */}
      <div ref={near} style={{ position: "absolute", left: 0, top: railPx - trainH * 0.12, width: 0, height: 0, willChange: "transform" }}>
        {Array.from({ length: nearCount }, (_, j) => (
          <NearItem key={j} x={nearFirst + j * spacing} size={trainH} kind={mod(j, 4)} />
        ))}
      </div>
      {/* railway */}
      <div style={{ position: "absolute", left: 0, right: 0, top: railPx - trainH * 0.05, height: trainH * 0.2, background: "linear-gradient(#B9A58C, #9C8770)" }} />
      <div
        ref={sleepers}
        style={{
          position: "absolute",
          left: 0,
          top: railPx - trainH * 0.04,
          width: w + sleeperGap * 2,
          height: trainH * 0.16,
          background: `repeating-linear-gradient(90deg, transparent 0 ${sleeperGap * 0.45}px, #7A5A3E ${sleeperGap * 0.45}px ${sleeperGap}px)`,
          willChange: "transform",
        }}
      />
      <div style={{ position: "absolute", left: 0, right: 0, top: railPx - trainH * 0.01, height: Math.max(3, trainH * 0.03), background: "#6E7A8A", boxShadow: "0 2px 0 #4D5663" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: railPx + trainH * 0.09, height: Math.max(3, trainH * 0.03), background: "#6E7A8A", boxShadow: "0 2px 0 #4D5663" }} />

      {/* the station (scrolls away when the train leaves) */}
      <div ref={station} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, willChange: "transform" }}>
        <StationHouse left={w * 0.01} bottom={railPx - trainH * 0.02} width={stationW} />
      </div>

      {/* foreground: path, flowers, fence */}
      <div ref={front} style={{ position: "absolute", left: 0, top: railPx + trainH * 0.18, width: frontW * 2, bottom: 0, willChange: "transform" }}>
        {[0, 1].map((i) => (
          <Foreground key={i} left={i * frontW} width={frontW} />
        ))}
      </div>

      {/* the conductor (the child), with a flag */}
      <div ref={conductor} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, willChange: "transform", zIndex: 1 }}>
        <div
          style={{
            position: "absolute",
            left: w * 0.03,
            ...(p.endScreen
              ? { top: h * 0.97 - Math.min(h * 0.4, w * 0.12) * 1.25, width: Math.min(h * 0.4, w * 0.12) }
              : { top: p.compact ? railPx + trainH * 0.12 - trainH * 0.98 : h * 0.97 - trainH * 1.2, width: p.compact ? trainH * 0.78 : trainH * 0.95 }),
          }}
        >
          <svg viewBox="0 0 40 60" style={{ position: "absolute", left: "-26%", top: "8%", width: "45%", overflow: "visible" }}>
            <rect x={30} y={4} width={3} height={52} fill="#6B4A2E" />
            <path d="M33,5 L33,24 L8,15 Z" fill={p.flag === "red" ? "#FF5A5F" : "#2BC48A"} />
          </svg>
          <SvgPuppet
            choice={p.conductor}
            state={p.conductorState ?? "idle"}
            reaction={p.conductorReaction}
            style={{ width: "100%", height: "auto", display: "block", position: "relative" }}
          />
        </div>
      </div>
    </div>
  );
}

export const Scenery = memo(forwardRef(SceneryImpl));

const Clouds = memo(function Clouds() {
  return (
    <svg viewBox="0 0 1600 400" preserveAspectRatio="xMidYMin slice" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "45%" }}>
      {[[180, 110, 1], [620, 70, 0.8], [1100, 130, 1.1], [1450, 60, 0.7]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`} fill="white" opacity={0.9}>
          <ellipse cx={0} cy={0} rx={70} ry={30} />
          <ellipse cx={-50} cy={10} rx={45} ry={24} />
          <ellipse cx={55} cy={12} rx={50} ry={22} />
          <ellipse cx={10} cy={-22} rx={40} ry={28} />
        </g>
      ))}
    </svg>
  );
});

function FarTree({ x, size, kind }: { x: number; size: number; kind: number }) {
  const green = ["#6DBE6A", "#5BAF63", "#78C873", "#62B768"][kind];
  return (
    <svg viewBox="-30 -70 60 72" style={{ position: "absolute", left: x - size * 0.4, top: -size * 0.95, width: size * 0.8, height: size }}>
      <rect x={-3} y={-22} width={6} height={24} fill="#A87B4F" />
      {kind === 1 ? (
        <path d="M0,-68 L20,-18 L-20,-18 Z" fill="#4FA35E" />
      ) : (
        <>
          <circle cx={0} cy={-40} r={20} fill={green} />
          <circle cx={-12} cy={-30} r={13} fill={green} />
          <circle cx={13} cy={-31} r={14} fill={green} />
        </>
      )}
    </svg>
  );
}

// kind 0: a big round tree · 1: a telegraph pole · 2: a pine · 3: a bush
// with flowers. Centred on x; their feet just behind the rails.
function NearItem({ x, size, kind }: { x: number; size: number; kind: number }) {
  if (kind === 1) {
    return (
      <svg viewBox="-20 -150 40 152" style={{ position: "absolute", left: x - size * 0.13, top: -size * 1.5, width: size * 0.26, height: size * 1.5 }}>
        <rect x={-3} y={-140} width={6} height={142} fill="#8A6A4A" />
        <rect x={-16} y={-130} width={32} height={5} rx={2} fill="#6B4A2E" />
        <circle cx={-12} cy={-133} r={3} fill="#D9E2EC" />
        <circle cx={12} cy={-133} r={3} fill="#D9E2EC" />
      </svg>
    );
  }
  if (kind === 3) {
    return (
      <svg viewBox="-50 -50 100 52" style={{ position: "absolute", left: x - size * 0.5, top: -size * 0.52, width: size, height: size * 0.52 }}>
        <ellipse cx={-22} cy={-16} rx={26} ry={20} fill="#4FA35E" />
        <ellipse cx={20} cy={-18} rx={28} ry={22} fill="#5BAF63" />
        <ellipse cx={0} cy={-28} rx={24} ry={20} fill="#62B768" />
        {[[-26, -24], [-6, -38], [16, -26], [30, -12], [-14, -8]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={4} fill={i % 2 ? "#FF9EC4" : "#FFD23F"} />
        ))}
      </svg>
    );
  }
  if (kind === 2) {
    return (
      <svg viewBox="-40 -160 80 162" style={{ position: "absolute", left: x - size * 0.32, top: -size * 1.6, width: size * 0.64, height: size * 1.6 }}>
        <rect x={-5} y={-30} width={10} height={32} fill="#8A5A34" />
        <path d="M0,-158 L26,-100 L-26,-100 Z M0,-125 L32,-62 L-32,-62 Z M0,-90 L38,-26 L-38,-26 Z" fill="#3F8F55" />
      </svg>
    );
  }
  return (
    <svg viewBox="-60 -150 120 152" style={{ position: "absolute", left: x - size * 0.6, top: -size * 1.5, width: size * 1.2, height: size * 1.5 }}>
      <rect x={-8} y={-60} width={16} height={62} fill="#A87B4F" />
      <circle cx={0} cy={-100} r={46} fill="#5BAF63" />
      <circle cx={-34} cy={-74} r={30} fill="#5BAF63" />
      <circle cx={34} cy={-78} r={32} fill="#6DBE6A" />
      <circle cx={10} cy={-122} r={28} fill="#6DBE6A" />
      <circle cx={-20} cy={-108} r={5} fill="#FF7A6B" />
      <circle cx={24} cy={-92} r={5} fill="#FF7A6B" />
    </svg>
  );
}

const StationHouse = memo(function StationHouse({ left, bottom, width }: { left: number; bottom: number; width: number }) {
  const height = width * 0.5;
  return (
    <svg viewBox="0 0 600 300" style={{ position: "absolute", left, top: bottom - height, width, height }}>
      <rect x={0} y={262} width={560} height={38} fill="#D9C7A6" />
      <rect x={0} y={258} width={560} height={8} fill="#F2E3C4" />
      <rect x={40} y={120} width={250} height={140} fill="#FFE9C2" stroke="#E0BE86" strokeWidth={4} />
      <path d="M22,126 L165,48 L308,126 Z" fill="#E8524A" />
      <rect x={22} y={120} width={286} height={12} fill="#C63D36" />
      <rect x={70} y={160} width={60} height={60} rx={8} fill="#9ED8F5" stroke="#E0BE86" strokeWidth={4} />
      <rect x={200} y={170} width={56} height={90} rx={6} fill="#B07445" />
      <circle cx={245} cy={215} r={4} fill="#FFD23F" />
      <circle cx={165} cy={95} r={20} fill="white" stroke="#3D3A4F" strokeWidth={4} />
      <path d="M165,95 L165,82 M165,95 L174,99" stroke="#3D3A4F" strokeWidth={3} strokeLinecap="round" />
      <rect x={64} y={222} width={72} height={12} rx={3} fill="#A86B3C" />
      {[76, 90, 104, 118, 130].map((x, i) => (
        <circle key={x} cx={x} cy={219} r={6} fill={i % 2 ? "#FF7AB6" : "#FFD23F"} />
      ))}
      <rect x={360} y={150} width={6} height={110} fill="#3D3A4F" />
      <path d="M350,150 L376,150 L370,132 L356,132 Z" fill="#3D3A4F" />
      <circle cx={363} cy={142} r={6} fill="#FFE27A" />
      <rect x={400} y={232} width={90} height={8} rx={3} fill="#A86B3C" />
      <rect x={400} y={214} width={90} height={6} rx={3} fill="#A86B3C" />
      <rect x={408} y={240} width={6} height={20} fill="#6B4A2E" />
      <rect x={476} y={240} width={6} height={20} fill="#6B4A2E" />
    </svg>
  );
});

const Foreground = memo(function Foreground({ left, width }: { left: number; width: number }) {
  return (
    <div style={{ position: "absolute", left, top: 0, bottom: 0, width }}>
      <svg viewBox="0 0 1600 300" preserveAspectRatio="none" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}>
        <path d="M0,130 C300,100 600,160 900,130 C1150,106 1400,150 1600,130 L1600,180 C1400,200 1150,160 900,182 C600,210 300,150 0,180 Z" fill="#E8D3A8" opacity={0.85} />
        {[[120, 60], [260, 236], [480, 70], [700, 246], [980, 60], [1230, 240], [1460, 80], [40, 250], [820, 40], [1560, 236]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M0,0 L0,34" stroke="#4E9A4A" strokeWidth={5} />
            <circle r={15} fill={["#FF9EC4", "#FFD23F", "#FFFFFF", "#B79CFF"][i % 4]} />
            <circle r={6} fill="#FFB020" />
          </g>
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "16%",
          minHeight: 18,
          maxHeight: 44,
          background:
            "linear-gradient(transparent 22%, #C9935D 22% 34%, transparent 34% 58%, #C9935D 58% 70%, transparent 70%), repeating-linear-gradient(90deg, #DDA66E 0 12px, transparent 12px 50px)",
        }}
      />
    </div>
  );
});
