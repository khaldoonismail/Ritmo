"use client";

import { memo } from "react";

// Sleepy Town at night, drawn as one SVG (light for old tablets). How
// awake the town is (`wake`, 0 asleep → 1 party → 1.3 ff) decides the lit
// windows (house by house, so a crescendo lights them one after another),
// the moon, the animals and the fireworks. `decorations` (0–10) are the
// festive things added by right answers; the garland's bulbs count them.
//
// The town is 1600 × 900, drawn "slice" from the bottom: the street always
// shows; a wide phone loses some sky, a tablet some of the sides.

export const VW = 1600;
export const VH = 900;
export const BASE = 690; // where the houses stand
export const SIDEWALK_Y = BASE + 22; // where the character stands
const INK = "#2B2745";

export const HOUSES = [
  { x: 70, w: 230, h: 230, body: "#E7A0A8", roof: "#7A4E8C", wakeAt: 0.15 },
  { x: 340, w: 200, h: 290, body: "#9FC7E8", roof: "#4D5C9E", wakeAt: 0.5 },
  { x: 580, w: 250, h: 220, body: "#F3D38A", roof: "#B5553F", wakeAt: 0.35 },
  { x: 1000, w: 220, h: 270, body: "#B8DDA5", roof: "#5A7F4A", wakeAt: 0.7 },
  { x: 1260, w: 250, h: 240, body: "#E9B98C", roof: "#7A4E8C", wakeAt: 0.85 },
];
export const PARTY_AT = 0.75; // animals up, moon smiling
const FIREWORKS_AT = 0.9;
const MORE_FIREWORKS_AT = 1.15;

export type CatMood = "sleep" | "grumpy" | "dance";

export const TOWN_CSS = `
  @keyframes st-boom { 0% { transform: scale(.2); opacity: 0 } 15% { opacity: 1 } 70% { transform: scale(1); opacity: 1 } 100% { transform: scale(1.1); opacity: 0 } }
  @keyframes st-z { 0%,100% { transform: translateY(0); opacity: .9 } 50% { transform: translateY(-10px); opacity: .55 } }
  @keyframes st-dance { 0%,100% { transform: translateY(0) rotate(-4deg) } 50% { transform: translateY(-14px) rotate(4deg) } }
  @keyframes st-pop { 0% { transform: scale(.1); opacity: 0 } 60% { transform: scale(1.2); opacity: 1 } 100% { transform: scale(1) } }
  @keyframes st-fizzle { 0% { transform: translateY(0) scale(.5); opacity: 0 } 30% { opacity: 1; transform: translateY(-40px) scale(1) } 100% { transform: translateY(30px) scale(.8); opacity: 0 } }
  .st-fx { transform-box: fill-box; transform-origin: center; }
  .st-win { transition: fill .35s ease; }
`;

function House({ x, w, h, body, roof, lit }: Omit<(typeof HOUSES)[number], "wakeAt"> & { lit: boolean }) {
  const top = BASE - h;
  const win = lit ? "#FFD66B" : "#3A3E6E";
  const ww = w * 0.2;
  return (
    <g stroke={INK} strokeWidth={5} strokeLinejoin="round">
      <rect x={x + w * 0.66} y={top - 70} width={w * 0.13} height={70} fill={roof} />
      <rect x={x} y={top} width={w} height={h} fill={body} />
      <path d={`M${x - 22},${top + 4} L${x + w / 2},${top - 95} L${x + w + 22},${top + 4} Z`} fill={roof} />
      {lit && (
        <g stroke="none" fill="#FFE27A" opacity={0.2}>
          <circle cx={x + w * 0.25} cy={top + h * 0.3} r={ww * 0.95} />
          <circle cx={x + w * 0.75} cy={top + h * 0.3} r={ww * 0.95} />
        </g>
      )}
      <rect className="st-win" x={x + w * 0.15} y={top + h * 0.2} width={ww} height={ww * 1.15} rx={8} fill={win} />
      <rect className="st-win" x={x + w * 0.65} y={top + h * 0.2} width={ww} height={ww * 1.15} rx={8} fill={win} />
      <rect className="st-win" x={x + w * 0.4} y={BASE - h * 0.38} width={w * 0.2} height={h * 0.38} rx={10} fill={lit ? "#FFD66B" : "#6B4A6E"} />
      <circle cx={x + w * 0.56} cy={BASE - h * 0.18} r={4} fill={INK} stroke="none" />
    </g>
  );
}

function Zzz({ x, y, s = 1, delay = 0 }: { x: number; y: number; s?: number; delay?: number }) {
  return (
    <g fill="#DDE3FF" fontWeight={900} fontFamily="system-ui, sans-serif" className="st-fx" style={{ animation: `st-z 2.4s ease-in-out ${delay}s infinite` }}>
      <text x={x} y={y} fontSize={26 * s}>z</text>
      <text x={x + 18 * s} y={y - 24 * s} fontSize={34 * s}>z</text>
      <text x={x + 42 * s} y={y - 54 * s} fontSize={42 * s}>Z</text>
    </g>
  );
}

function Cat({ x, y, mood }: { x: number; y: number; mood: CatMood }) {
  const c = "#F2A35E";
  const d = "#C8743A";
  if (mood === "sleep")
    return (
      <g transform={`translate(${x},${y})`} stroke={INK} strokeWidth={4.5} strokeLinejoin="round">
        <path d="M-60,0 Q-70,-40 -20,-48 Q40,-52 58,-12 Q60,0 50,0 Z" fill={c} />
        <path d="M50,-4 Q78,-2 70,-26" fill="none" stroke={d} strokeWidth={12} strokeLinecap="round" />
        <circle cx={-44} cy={-30} r={24} fill={c} />
        <path d="M-62,-44 L-60,-66 L-46,-52 Z M-38,-52 L-26,-66 L-24,-44 Z" fill={c} />
        <path d="M-56,-30 q5,4 10,0 M-40,-30 q5,4 10,0" fill="none" strokeLinecap="round" strokeWidth={3.5} />
        <ellipse cx={-58} cy={-21} rx={5} ry={3} fill="#FF8FA3" stroke="none" />
      </g>
    );
  return (
    <g transform={`translate(${x},${y})`}>
      <g className="st-fx" style={mood === "dance" ? { animation: "st-dance 0.55s ease-in-out infinite" } : undefined} stroke={INK} strokeWidth={4.5} strokeLinejoin="round">
        <path d="M20,-10 Q60,-20 52,-70" fill="none" stroke={d} strokeWidth={12} strokeLinecap="round" />
        <ellipse cx={0} cy={-28} rx={30} ry={30} fill={c} />
        <circle cx={0} cy={-80} r={30} fill={c} />
        <path d="M-26,-96 L-24,-124 L-6,-106 Z M6,-106 L24,-124 L26,-96 Z" fill={c} />
        {mood === "grumpy" ? (
          <>
            <path d="M-18,-90 l12,6 M18,-90 l-12,6" strokeLinecap="round" strokeWidth={4} />
            <circle cx={-10} cy={-80} r={4} fill={INK} />
            <circle cx={10} cy={-80} r={4} fill={INK} />
            <path d="M-9,-64 q9,-7 18,0" fill="none" strokeLinecap="round" />
            <path d="M-28,-40 L-34,-8 M28,-40 L34,-8" stroke={c} strokeWidth={12} strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M-16,-82 q6,-7 12,0 M4,-82 q6,-7 12,0" fill="none" strokeLinecap="round" strokeWidth={4} />
            <path d="M-9,-68 q9,9 18,0" fill="#FF7AB6" strokeLinecap="round" />
            <path d="M-28,-40 L-50,-70 M28,-40 L50,-70" stroke={c} strokeWidth={12} strokeLinecap="round" />
          </>
        )}
        <ellipse cx={-20} cy={-72} rx={5} ry={3} fill="#FF8FA3" stroke="none" />
        <ellipse cx={20} cy={-72} rx={5} ry={3} fill="#FF8FA3" stroke="none" />
      </g>
    </g>
  );
}

function Dog({ x, y, awake }: { x: number; y: number; awake: boolean }) {
  const c = "#D9A066";
  if (!awake)
    return (
      <g transform={`translate(${x},${y})`} stroke={INK} strokeWidth={4.5} strokeLinejoin="round">
        <path d="M-70,0 Q-74,-46 -10,-50 Q56,-50 64,-6 Q64,0 56,0 Z" fill={c} />
        <circle cx={-50} cy={-26} r={26} fill={c} />
        <path d="M-70,-40 Q-86,-20 -70,-6 Z" fill="#8A5A34" />
        <path d="M-58,-28 q5,4 10,0" fill="none" strokeLinecap="round" strokeWidth={3.5} />
        <ellipse cx={-74} cy={-18} rx={6} ry={4} fill={INK} />
      </g>
    );
  return (
    <g transform={`translate(${x},${y - 8})`}>
      <g className="st-fx" style={{ animation: "st-dance 0.6s ease-in-out 0.15s infinite" }} stroke={INK} strokeWidth={4.5} strokeLinejoin="round">
        <ellipse cx={0} cy={-30} rx={30} ry={30} fill={c} />
        <circle cx={0} cy={-82} r={28} fill={c} />
        <path d="M-26,-96 Q-44,-80 -32,-58 Z M26,-96 Q44,-80 32,-58 Z" fill="#8A5A34" />
        <path d="M-14,-86 q6,-7 12,0 M2,-86 q6,-7 12,0" fill="none" strokeLinecap="round" strokeWidth={4} />
        <ellipse cx={0} cy={-72} rx={6} ry={4} fill={INK} />
        <path d="M-6,-64 Q0,-54 6,-64 Z" fill="#FF7AB6" />
        <path d="M-26,-40 L-46,-74 M26,-40 L46,-74" stroke={c} strokeWidth={12} strokeLinecap="round" />
      </g>
    </g>
  );
}

function Owl({ x, y, awake }: { x: number; y: number; awake: boolean }) {
  return (
    <g transform={`translate(${x},${y})`} stroke={INK} strokeWidth={4.5} strokeLinejoin="round">
      <path d="M-28,0 Q-34,-60 0,-64 Q34,-60 28,0 Z" fill="#9C7BB8" />
      <path d="M-26,-50 L-30,-72 L-12,-60 Z M26,-50 L30,-72 L12,-60 Z" fill="#9C7BB8" />
      <ellipse cx={0} cy={-18} rx={16} ry={16} fill="#D9C6EA" stroke="none" />
      {awake ? (
        <>
          <circle cx={-11} cy={-42} r={10} fill="white" />
          <circle cx={11} cy={-42} r={10} fill="white" />
          <circle cx={-10} cy={-42} r={4} fill={INK} />
          <circle cx={12} cy={-42} r={4} fill={INK} />
        </>
      ) : (
        <path d="M-18,-42 q7,6 14,0 M4,-42 q7,6 14,0" fill="none" strokeLinecap="round" strokeWidth={3.5} />
      )}
      <path d="M-4,-32 L4,-32 L0,-24 Z" fill="#F2B84B" strokeWidth={3} />
    </g>
  );
}

function Firework({ x, y, color, r = 70, delay = 0 }: { x: number; y: number; color: string; r?: number; delay?: number }) {
  const rays = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);
  return (
    <g className="st-fx" style={{ animation: `st-boom 1.5s ease-out ${delay}s infinite`, opacity: 0 }} stroke={color} strokeWidth={7} strokeLinecap="round">
      {rays.map((a, i) => (
        <line key={i} x1={x + Math.cos(a) * r * 0.35} y1={y + Math.sin(a) * r * 0.35} x2={x + Math.cos(a) * r} y2={y + Math.sin(a) * r} />
      ))}
      {rays.map((a, i) => (
        <circle key={`d${i}`} cx={x + Math.cos(a + 0.26) * r * 1.15} cy={y + Math.sin(a + 0.26) * r * 1.15} r={4} fill={color} stroke="none" />
      ))}
    </g>
  );
}

// A sad little firework that goes "pfft" (the party fizzled).
function Fizzle({ x, y }: { x: number; y: number }) {
  return (
    <g className="st-fx" style={{ animation: "st-fizzle 1.6s ease-out forwards" }}>
      <g stroke="#9C98B8" strokeWidth={6} strokeLinecap="round">
        {[-50, -20, 20, 50].map((a) => (
          <line key={a} x1={x} y1={y} x2={x + Math.sin((a * Math.PI) / 180) * 34} y2={y + Math.cos((a * Math.PI) / 180) * 30} />
        ))}
      </g>
      <circle cx={x} cy={y} r={14} fill="#C9C6DA" stroke={INK} strokeWidth={4} />
      <text x={x + 26} y={y - 18} fill="#FFFFFF" fontSize={40} fontWeight={900} fontFamily="system-ui, sans-serif">
        pfft…
      </text>
    </g>
  );
}

// The garland of 10 bulbs across the sky: one lights per right answer.
const BULB_COLORS = ["#FF6B8A", "#FFD24A", "#6FD3FF", "#8EE07A", "#C79BFF"];
function Garland({ lit }: { lit: number }) {
  // Within a 4:3 tablet's view (about x 200–1400).
  const x1 = 300;
  const x2 = 1300;
  const y0 = 300;
  const bulbs = Array.from({ length: 10 }, (_, i) => {
    const t = (i + 0.5) / 10;
    return { x: x1 + (x2 - x1) * t, y: y0 + Math.sin(t * Math.PI) * 60, on: i < lit, c: BULB_COLORS[i % BULB_COLORS.length] };
  });
  return (
    <g>
      <path d={`M${x1 - 60},${y0 - 8} Q800,${y0 + 128} ${x2 + 60},${y0 - 8}`} stroke={INK} strokeWidth={4} fill="none" opacity={0.85} />
      {bulbs.map((b, i) => (
        <g key={i}>
          {b.on && <circle cx={b.x} cy={b.y + 14} r={26} fill={b.c} opacity={0.3} />}
          <rect x={b.x - 6} y={b.y - 2} width={12} height={10} fill={INK} />
          <ellipse
            cx={b.x}
            cy={b.y + 18}
            rx={11}
            ry={14}
            fill={b.on ? b.c : "#4A4E7A"}
            stroke={INK}
            strokeWidth={3.5}
            className={b.on ? "st-fx" : undefined}
            style={b.on && i === lit - 1 ? { animation: "st-pop 0.5s ease-out" } : undefined}
          />
        </g>
      ))}
    </g>
  );
}

// The decorations, in the order right answers add them: the middle of
// the town first (always on screen), the far edges last.
const DECORATIONS: React.ReactNode[] = [
  // a star on top of the tree
  <path key="star" d="M915,400 L924,421 L947,422 L929,436 L936,458 L915,445 L894,458 L901,436 L883,422 L906,421 Z" fill="#FFD24A" />,
  // a wreath on the yellow house's door
  <g key="wreath">
    <circle cx={705} cy={628} r={16} fill="none" stroke="#3F8A3B" strokeWidth={9} />
    <path d="M699,642 l6,-6 l6,6" fill="#E2504C" stroke="#E2504C" strokeWidth={4} />
  </g>,
  // a paper lantern by the blue house's door
  <g key="lantern">
    <line x1={500} y1={560} x2={500} y2={580} />
    <ellipse cx={500} cy={604} rx={20} ry={26} fill="#FF8A4C" />
    <line x1={486} y1={604} x2={514} y2={604} strokeWidth={2.5} />
  </g>,
  // little flags across the green house
  <g key="flags">
    <path d="M1004,428 Q1110,448 1216,428" fill="none" strokeWidth={3} />
    {[1030, 1075, 1120, 1165].map((x, i) => (
      <path key={x} d={`M${x},${434 + (i === 1 || i === 2 ? 6 : 0)} l26,0 l-13,28 Z`} fill={["#FFD24A", "#FF6B8A", "#6FD3FF", "#8EE07A"][i]} />
    ))}
  </g>,
  // balloons on the lamp post
  <g key="balloons">
    <path d="M1243,450 Q1228,400 1218,365 M1243,450 Q1248,395 1253,355 M1243,450 Q1263,405 1285,372" fill="none" strokeWidth={2.5} />
    <ellipse cx={1218} cy={345} rx={20} ry={25} fill="#6FD3FF" />
    <ellipse cx={1253} cy={332} rx={20} ry={25} fill="#FF6B8A" />
    <ellipse cx={1287} cy={352} rx={20} ry={25} fill="#8EE07A" />
  </g>,
  // a flag on the blue house's roof
  <g key="roofflag">
    <line x1={440} y1={305} x2={440} y2={240} />
    <path d="M440,242 l44,12 l-44,12 Z" fill="#FF6B8A" />
  </g>,
  // a kite in the sky
  <g key="kite">
    <path d="M560,170 L600,210 L560,270 L520,210 Z" fill="#FF8A4C" />
    <path d="M560,170 L560,270 M520,210 L600,210" fill="none" strokeWidth={3} />
    <path d="M560,270 q-14,20 0,36 q14,16 0,34" fill="none" strokeWidth={3} />
  </g>,

  // flower pots by the orange house
  <g key="pots">
    <path d="M1276,690 l6,-26 h28 l6,26 Z" fill="#C8743A" />
    <circle cx={1296} cy={652} r={12} fill="#FF6B8A" />
    <path d="M1452,690 l6,-26 h28 l6,26 Z" fill="#C8743A" />
    <circle cx={1472} cy={652} r={12} fill="#FFD24A" />
  </g>,
  // fairy lights along the orange house's roof
  <g key="rooflights">
    {Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      const x = 1240 + t * 290;
      const y = t < 0.5 ? 452 - t * 2 * 96 : 356 + (t - 0.5) * 2 * 96;
      return <circle key={i} cx={x} cy={y + 10} r={7} fill={BULB_COLORS[i % 5]} strokeWidth={2.5} />;
    })}
  </g>,
  // flower box under the pink house's window
  <g key="flowers">
    <rect x={100} y={562} width={70} height={18} rx={4} fill="#8A5A34" />
    <circle cx={112} cy={558} r={9} fill="#FF6B8A" />
    <circle cx={135} cy={554} r={9} fill="#FFD24A" />
    <circle cx={158} cy={558} r={9} fill="#C79BFF" />
  </g>,
];
export const DECORATION_COUNT = DECORATIONS.length;

export const Town = memo(function Town({
  wake,
  decorations,
  cat,
  fizzle,
  compact,
  portrait,
}: {
  wake: number;
  decorations: number;
  cat?: CatMood;
  fizzle?: number; // a key: a new value plays the fizzle again
  compact: boolean;
  portrait: boolean;
}) {
  const party = wake >= PARTY_AT;
  const fireworks = wake >= FIREWORKS_AT;
  const mood: CatMood = cat ?? (party ? "dance" : "sleep");
  // Phones: the moon sits low on the right, clear of the top card and the
  // buttons; elsewhere high in the sky.
  const moon = compact ? { x: 1480, y: 305, r: 46 } : { x: 1150, y: 170, r: 70 };
  const ms = moon.r / 70;
  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio={portrait ? "xMidYMax meet" : "xMidYMax slice"}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      {/* sky */}
      <rect x={-2000} y={-2000} width={VW + 4000} height={VH + 2000} fill={party ? "#3B3F86" : "#262A5C"} style={{ transition: "fill .4s" }} />
      <rect x={-2000} y={250} width={VW + 4000} height={450} fill={party ? "#4A4E96" : "#2F346A"} style={{ transition: "fill .4s" }} />
      {[
        // (above the top: only seen on upright tablets)
        [180, -420], [520, -300], [900, -460], [1250, -330], [400, -120], [760, -200], [1120, -90], [1420, -150], [80, -240],
        [120, 90], [260, 160], [420, 70], [610, 140], [760, 60], [1050, 120], [1240, 60], [1340, 150], [1480, 80], [980, 210], [200, 260], [1420, 220], [700, 250],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x},${y - 9} L${x + 3},${y - 3} L${x + 9},${y} L${x + 3},${y + 3} L${x},${y + 9} L${x - 3},${y + 3} L${x - 9},${y} L${x - 3},${y - 3} Z`} fill="#FFF3B0" />
      ))}
      {/* the moon: asleep, or awake for the party */}
      <g transform={`translate(${moon.x},${moon.y}) scale(${ms})`} stroke={INK} strokeWidth={5}>
        <circle cx={0} cy={0} r={70} fill="#FFF0A8" />
        {wake >= 0.5 ? (
          <>
            <circle cx={-22} cy={-10} r={6} fill={INK} />
            <circle cx={18} cy={-10} r={6} fill={INK} />
            <path d="M-20,20 Q-2,40 16,20" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M-32,-10 q10,9 20,0 M8,-10 q10,9 20,0" fill="none" strokeLinecap="round" />
            <path d="M-12,22 q10,6 20,0" fill="none" strokeLinecap="round" />
          </>
        )}
        <ellipse cx={-34} cy={12} rx={9} ry={5} fill="#FF8FA3" stroke="none" />
        <ellipse cx={32} cy={12} rx={9} ry={5} fill="#FF8FA3" stroke="none" />
      </g>
      {wake < 0.5 && <Zzz x={compact ? moon.x - 110 : moon.x + 65} y={compact ? moon.y - 10 : moon.y - 50} s={compact ? 0.7 : 1} />}
      {fireworks && (
        <>
          <Firework x={300} y={150} color="#FF6B8A" />
          <Firework x={720} y={110} color="#FFD24A" r={80} delay={0.5} />
          <Firework x={1400} y={compact ? 160 : 200} color="#6FD3FF" r={60} delay={0.9} />
          {wake >= MORE_FIREWORKS_AT && (
            <>
              <Firework x={520} y={240} color="#8EE07A" r={50} delay={0.25} />
              <Firework x={960} y={150} color="#C79BFF" r={70} delay={0.7} />
              <Firework x={1180} y={240} color="#FF8A4C" r={45} delay={1.1} />
            </>
          )}
        </>
      )}
      {/* far hills */}
      <path d="M-2000,560 L0,560 Q200,470 420,540 Q640,600 860,520 Q1100,440 1320,530 Q1480,580 1600,520 L3600,520 L3600,700 L-2000,700 Z" fill="#1F2350" />
      {/* the tree with the owl */}
      <g stroke={INK} strokeWidth={5}>
        <rect x={900} y={520} width={30} height={170} fill="#6B4A3A" />
        <circle cx={915} cy={500} r={70} fill="#3F6E5A" />
        <circle cx={870} cy={540} r={45} fill="#3F6E5A" />
        <circle cx={962} cy={540} r={45} fill="#3F6E5A" />
      </g>
      <Owl x={915} y={520} awake={party} />
      {!party && <Zzz x={945} y={450} s={0.7} delay={0.8} />}
      {HOUSES.map(({ wakeAt, ...h }, i) => (
        <House key={i} {...h} lit={wake >= wakeAt} />
      ))}
      <Garland lit={decorations} />
      <g stroke={INK} strokeWidth={4} strokeLinejoin="round">
        {DECORATIONS.slice(0, decorations).map((d, i) => (
          <g key={i} className="st-fx" style={i === decorations - 1 ? { animation: "st-pop 0.6s ease-out" } : undefined}>
            {d}
          </g>
        ))}
      </g>
      {/* the sidewalk and the street */}
      <rect x={-2000} y={BASE} width={VW + 4000} height={36} fill="#8A86A8" stroke={INK} strokeWidth={5} />
      <rect x={-2000} y={BASE + 36} width={VW + 4000} height={VH + 2000} fill="#4C4A6E" />
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={-590 + i * 210} y={810} width={110} height={14} rx={7} fill="#7C7AA0" />
      ))}
      {/* the street lamp */}
      <g stroke={INK} strokeWidth={5}>
        <rect x={1236} y={480} width={14} height={210} fill="#5A5880" />
        <rect x={1220} y={448} width={46} height={40} rx={8} fill={wake >= 0.35 ? "#FFE27A" : "#C9B866"} />
      </g>
      {/* the animals */}
      <Cat x={460} y={BASE - 290} mood={mood} />
      {mood === "sleep" && <Zzz x={500} y={BASE - 360} s={0.7} delay={0.4} />}
      <Dog x={1180} y={BASE + 10} awake={party} />
      {!party && <Zzz x={1110} y={BASE - 60} s={0.7} delay={1.2} />}
      {party && (
        <g fill="#FFFFFF" fontSize={52} fontWeight={900}>
          <text x={1120} y={BASE - 150}>♪</text>
          <text x={540} y={BASE - 430}>♫</text>
          <text x={860} y={420}>♪</text>
        </g>
      )}
      {fizzle ? <Fizzle key={fizzle} x={700} y={compact ? 330 : 230} /> : null}
    </svg>
  );
});
