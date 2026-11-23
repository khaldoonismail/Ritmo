"use client";

import { memo } from "react";

// The pond (drawn once; nothing here changes while playing, so it costs
// nothing per frame on old tablets): sky, far bank with trees, water with
// ripples, reeds and cattails at the front corners. `waterTop` is where
// the water starts, in % of the height.

function PondSceneryImpl({ waterTop }: { waterTop: number }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", background: "linear-gradient(#9ED8F5 0%, #CFEFFC 38%, #E9F8FF 46%)" }}>
      <svg viewBox="0 0 1600 260" preserveAspectRatio="xMidYMax meet" style={{ position: "absolute", left: 0, width: "100%", top: `${waterTop - 34}%`, height: "30%" }}>
        {[[90, 1], [260, 0.8], [1180, 0.9], [1330, 1.1], [1500, 0.75], [700, 0.6]].map(([x, s], i) => (
          <g key={i} transform={`translate(${x} 250) scale(${s})`}>
            <rect x={-9} y={-90} width={18} height={90} fill="#A87B4F" />
            <circle cx={0} cy={-130} r={62} fill={i % 2 ? "#6DBE6A" : "#5BAF63"} />
            <circle cx={-40} cy={-100} r={40} fill={i % 2 ? "#6DBE6A" : "#5BAF63"} />
            <circle cx={42} cy={-104} r={42} fill={i % 2 ? "#78C873" : "#62B768"} />
          </g>
        ))}
      </svg>
      <svg viewBox="0 0 1600 300" preserveAspectRatio="none" style={{ position: "absolute", left: 0, width: "100%", top: `${waterTop - 18}%`, height: "20%" }}>
        <path d="M0,160 C200,90 380,120 560,100 C760,78 900,140 1100,110 C1300,80 1450,120 1600,100 L1600,300 L0,300 Z" fill="#9BD58A" />
        <path d="M0,210 C260,170 520,200 800,180 C1080,160 1340,200 1600,175 L1600,300 L0,300 Z" fill="#7CC46F" />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: `${waterTop}%`, bottom: 0, background: "linear-gradient(#7FCBE8, #4FA9D6 60%, #3E95C6)" }} />
      <svg viewBox="0 0 1600 500" preserveAspectRatio="none" style={{ position: "absolute", left: 0, width: "100%", top: `${waterTop}%`, height: `${100 - waterTop}%` }}>
        <path d="M0,0 C300,26 600,8 900,22 C1200,36 1400,10 1600,20 L1600,0 Z" fill="#8FD07F" />
        {[[160, 120], [520, 300], [980, 90], [1300, 360], [760, 430], [1450, 200], [300, 420]].map(([x, y], i) => (
          <path key={i} d={`M${x - 40},${y} q20,-8 40,0 t40,0`} fill="none" stroke="white" strokeOpacity={0.35} strokeWidth={4} strokeLinecap="round" />
        ))}
        {[30, 60, 90, 1520, 1550, 1580].map((x, i) => (
          <g key={i}>
            <path d={`M${x},500 Q${x + (i % 2 ? 10 : -10)},380 ${x + (i % 2 ? 4 : -6)},300`} stroke="#4E9A4A" strokeWidth={9} fill="none" strokeLinecap="round" />
            {i % 3 === 0 && <rect x={x - 9} y={286} width={14} height={46} rx={7} fill="#8A5A34" />}
          </g>
        ))}
      </svg>
    </div>
  );
}

export const PondScenery = memo(PondSceneryImpl);

// A lily pad (fills its box's width). `flower` on half notes; `grey` for a
// missed note's pad.
export function LilyPad({ flower = false, glow = false, grey = false }: { flower?: boolean; glow?: boolean; grey?: boolean }) {
  const leaf = grey ? "#9DB5A3" : "#4CB868";
  const edge = grey ? "#86A08D" : "#3A9A55";
  return (
    <svg viewBox="-60 -26 120 52" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }} aria-hidden="true">
      {glow && <ellipse cx={0} cy={4} rx={66} ry={30} fill="#FFF3B0" opacity={0.75} />}
      <ellipse cx={0} cy={6} rx={58} ry={20} fill="#2F7D4F" opacity={0.3} />
      <path d="M0,0 L58,-6 A58,22 0 1 1 46,-14 Z" fill={leaf} stroke={edge} strokeWidth={2} />
      <path d="M0,0 L-34,8 M0,0 L-10,16 M0,0 L22,14 M0,0 L-40,-6" stroke={edge} strokeWidth={1.6} />
      {flower && (
        <g transform="translate(-30 -6)">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} cx={0} cy={-7} rx={4} ry={8} fill={grey ? "#D9C8D0" : "#FF9EC4"} transform={`rotate(${a})`} />
          ))}
          <circle r={4} fill={grey ? "#E6DFC0" : "#FFD23F"} />
        </g>
      )}
    </svg>
  );
}

// Open water where a rest is.
export function Ripple() {
  return (
    <svg viewBox="-60 -20 120 40" style={{ width: "100%", height: "auto", display: "block" }} aria-hidden="true">
      <ellipse rx={34} ry={9} fill="none" stroke="white" strokeOpacity={0.55} strokeWidth={2} />
      <ellipse rx={18} ry={5} fill="none" stroke="white" strokeOpacity={0.45} strokeWidth={2} />
    </svg>
  );
}

// The funny splash for a tap on a rest.
export function Splash() {
  return (
    <svg viewBox="-60 -70 120 90" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }} aria-hidden="true">
      <ellipse cx={0} cy={6} rx={46} ry={12} fill="none" stroke="white" strokeWidth={3} strokeOpacity={0.8} />
      <ellipse cx={0} cy={6} rx={26} ry={7} fill="white" fillOpacity={0.5} />
      {[[-30, -30, 7], [-12, -52, 9], [10, -60, 8], [30, -38, 7], [-40, -10, 5], [42, -14, 5], [0, -30, 6]].map(([x, y, r], i) => (
        <path
          key={i}
          d={`M${x},${y - r * 1.6} C${x + r},${y - r * 0.3} ${x + r},${y + r} ${x},${y + r} C${x - r},${y + r} ${x - r},${y - r * 0.3} ${x},${y - r * 1.6} Z`}
          fill="#BFEAFF"
          stroke="white"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
