"use client";

import { useEffect, useRef, useState } from "react";
import SvgPuppet from "@/components/characters/SvgPuppet";
import type { CharacterChoice } from "@/components/characters/choice";
import { GAMES, SKILLS, islandOf, type GameEntry, type LandmarkArt, type SkillArea } from "@/lib/gameRegistry";
import { SPOTS, SPOT_COUNT } from "@/lib/islandLayout";
import { ComingSoon, Landmark } from "./Landmarks";

// Music Island: the student's map of games. Drawn as one SVG (light for
// old tablets): regions by skill, a landmark for each game on its spot
// (from lib/gameRegistry.ts), "Coming soon" signs on the free spots. When
// a region has more games than spots, the extra ones go to a second
// island, reached by the boat. On a tablet the whole island fits; on a
// phone (landscape) it is drawn larger and the child drags around it.
//
// Tapping a landmark: the child's character walks there, then the game
// opens (`hrefs`); a game with no page for this child shows `notes` in a
// bubble instead.

export const MAP_W = 1600;
export const MAP_H = 1100;
const INK = "#2B2745";
const SCALE = 0.82; // the landmarks on the map

const REGION_LABEL: Record<SkillArea, [number, number]> = {
  listening: [300, 150],
  class: [800, 110],
  piano: [1300, 150],
  rhythm: [1040, 577],
  reading: [190, 655],
  "tempo-dynamics": [1425, 668],
};

// How tall each landmark is (its top, in its own units), so the badges
// sit right on it.
const ART_TOP: Record<LandmarkArt, number> = {
  lighthouse: -150,
  "finish-arch": -134,
  treehouse: -168,
  village: -156,
  pond: -100,
  "piano-bridge": -84,
  station: -118,
  "sleepy-town": -132,
  arena: -150,
};

const BOAT: [number, number] = [1530, 560];
const START: [number, number] = [672, 600];
const LAST_SPOT_KEY = "ritmo.island.lastGame";

export interface GameProgress {
  stars?: 0 | 1 | 2 | 3;
  best?: string; // "92%", "1 240"
  played: boolean;
  homework?: { due: string }; // "Fri", "To do"
}

// Where a game stands on which island.
// Where the character stands at a landmark: on its left, or on its right
// near the west shore (so it and its speech bubble stay on screen).
const standBy = (x: number, y: number): [number, number] => [x < 400 ? x + 105 : x - 105, y + 6];

export function placeOf(g: GameEntry): { island: number; x: number; y: number } {
  const { island, spot } = islandOf(g, SPOT_COUNT);
  const [x, y] = SPOTS[g.skill][spot];
  return { island, x, y };
}

export function IslandMap({
  progress,
  hrefs,
  notes,
  character,
  compact,
  onNavigate,
}: {
  progress: Record<string, GameProgress>;
  hrefs: Record<string, string | null>;
  notes?: Record<string, string>;
  character: CharacterChoice;
  compact: boolean;
  onNavigate: (href: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const charRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 1024, h: 700 });
  const [island, setIsland] = useState(0);
  const [stand, setStand] = useState<[number, number]>(START);
  const [walking, setWalking] = useState<{ ms: number; left: boolean } | null>(null);
  const [bubble, setBubble] = useState<{ id: string; text: string } | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Start next to the last game played (on its island).
  useEffect(() => {
    try {
      const g = GAMES.find((x) => x.id === window.localStorage.getItem(LAST_SPOT_KEY));
      if (g) {
        const pl = placeOf(g);
        setIsland(pl.island);
        setStand(standBy(pl.x, pl.y));
      }
    } catch {
      // nothing saved
    }
  }, []);

  // Tablets on their side: the whole island fits. Upright tablets: as
  // tall as the screen (panned sideways). Phones: bigger, panned both ways.
  const fit = Math.min(box.w / MAP_W, box.h / MAP_H);
  const upright = !compact && box.h > box.w;
  const s = compact ? Math.max(fit, 0.62) : upright ? Math.min(box.h / MAP_H, (box.w / MAP_W) * 1.5) : fit;
  const W = MAP_W * s;
  const H = MAP_H * s;
  const pan = W > box.w + 1 || H > box.h + 1;

  // When the map is bigger than the screen, start with the character in view.
  const centred = useRef(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !pan || centred.current || box.w < 50) return;
    centred.current = true;
    el.scrollLeft = stand[0] * s - box.w / 2;
    el.scrollTop = stand[1] * s - box.h / 2;
  }, [pan, s, box.w, box.h, stand]);

  const islands = 1 + Math.max(0, ...GAMES.map((g) => placeOf(g).island));
  const here = GAMES.filter((g) => placeOf(g).island === island);

  const walkTo = (to: [number, number], then: () => void) => {
    const dx = to[0] - stand[0];
    const dy = to[1] - stand[1];
    const ms = Math.max(450, Math.min(1500, Math.hypot(dx, dy) * 1.3));
    setWalking({ ms, left: dx < 0 });
    setStand(to);
    // Phones: scroll along so the character (and its bubble) stays in view.
    if (pan) boxRef.current?.scrollTo({ left: to[0] * s - box.w / 2, top: to[1] * s - box.h * 0.6, behavior: "smooth" });
    window.setTimeout(() => {
      setWalking(null);
      then();
    }, ms + 120);
  };

  const open = (g: GameEntry) => {
    if (busy.current) return;
    const { x, y } = placeOf(g);
    const href = hrefs[g.id];
    busy.current = true;
    setBubble(null);
    walkTo(standBy(x, y), () => {
      if (href) {
        try {
          window.localStorage.setItem(LAST_SPOT_KEY, g.id);
        } catch {
          // private mode
        }
        onNavigate(href);
        window.setTimeout(() => (busy.current = false), 3000);
      } else {
        busy.current = false;
        setBubble({ id: g.id, text: notes?.[g.id] ?? "Coming soon!" });
      }
    });
  };

  const sail = () => {
    if (busy.current) return;
    busy.current = true;
    walkTo([BOAT[0] - 70, BOAT[1] + 10], () => {
      busy.current = false;
      setIsland((i) => (i + 1) % islands);
      setStand(START);
    });
  };

  return (
    <div ref={boxRef} className="isl-map" style={{ position: "absolute", inset: 0, overflow: pan ? "auto" : "hidden", WebkitOverflowScrolling: "touch", display: pan ? "block" : "grid", placeItems: "center" }}>
      <style>{`
        @keyframes isl-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
        .isl-map [role=button]:focus { outline: none }
        .isl-map [role=button]:focus-visible { outline: 4px solid #2F6FD0; outline-offset: 4px }
      `}</style>
      <div style={{ position: "relative", width: W, height: H, margin: pan ? `${Math.max(0, (box.h - H) / 2)}px 0 0` : "auto" }}>
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width={W} height={H} style={{ display: "block" }} role="group" aria-label={island === 0 ? "Music Island" : `Music Island ${island + 1}`}>
          <Island second={island > 0} />
          {(Object.keys(SPOTS) as SkillArea[]).map((skill) =>
            SPOTS[skill].map(([x, y], i) => {
              const g = here.find((gg) => gg.skill === skill && islandOf(gg, SPOT_COUNT).spot === i);
              if (!g)
                return (
                  <g key={`${skill}${i}`} transform={`translate(${x},${y}) scale(0.72)`} opacity={0.9} aria-hidden="true">
                    <ComingSoon />
                  </g>
                );
              return <Spot key={g.id} game={g} x={x} y={y} p={progress[g.id]} onOpen={open} />;
            })
          )}
          {(Object.keys(REGION_LABEL) as SkillArea[]).map((k) => (
            <RegionBanner key={k} x={REGION_LABEL[k][0]} y={REGION_LABEL[k][1]} text={SKILLS[k].region} />
          ))}
          {/* the boat to the next island: only when there is one */}
          {islands > 1 && (
            <g transform={`translate(${BOAT[0]},${BOAT[1]})`} role="button" tabIndex={0} aria-label={`Sail to island ${((island + 1) % islands) + 1}`} onClick={sail} style={{ cursor: "pointer" }}>
              <rect x={-70} y={-90} width={140} height={130} fill="transparent" />
              <path d="M-40,0 L40,0 L28,22 L-28,22 Z" fill="#B5553F" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
              <path d="M0,0 L0,-56" stroke={INK} strokeWidth={4} />
              <path d="M0,-54 L32,-10 L0,-10 Z" fill="#FFFFFF" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
              <text x={0} y={-66} textAnchor="middle" fontSize={20} fontWeight={900} fill={INK} fontFamily="var(--font-nunito), system-ui, sans-serif">
                {island === 0 ? "More games" : "Back"}
              </text>
            </g>
          )}
        </svg>
        {/* the child's character */}
        <div
          ref={charRef}
          style={{
            position: "absolute",
            left: stand[0] * s,
            top: stand[1] * s,
            width: Math.max(52, 120 * s),
            transform: "translate(-50%, -100%)",
            transition: walking ? `left ${walking.ms}ms linear, top ${walking.ms}ms linear` : undefined,
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <div style={{ transform: walking?.left ? "scaleX(-1)" : undefined }}>
            <SvgPuppet choice={character} state={walking ? "run" : "idle"} style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
          {bubble && (
            <div
              role="status"
              style={{
                position: "absolute",
                left: "50%",
                bottom: "104%",
                transform: "translateX(-50%)",
                background: "#FFFFFF",
                color: INK,
                fontWeight: 800,
                fontSize: compact ? 13 : 15,
                padding: "0.35em 0.8em",
                borderRadius: 14,
                boxShadow: `0 0 0 3px ${INK}`,
                width: "max-content",
                maxWidth: 220,
                textAlign: "center",
              }}
            >
              {bubble.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Spot({ game, x, y, p, onOpen }: { game: GameEntry; x: number; y: number; p?: GameProgress; onOpen: (g: GameEntry) => void }) {
  const isClass = game.skill === "class";
  const isNew = !isClass && !p?.played;
  const plateW = Math.max(150, game.title.length * 13 + 36);
  const top = ART_TOP[game.art] * SCALE;
  const label = `${game.title}${isNew ? ", new" : p?.stars ? `, ${p.stars} stars` : ""}${p?.homework ? `, homework ${p.homework.due}` : ""}`;
  return (
    <g
      transform={`translate(${x},${y})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      style={{ cursor: "pointer" }}
      onClick={() => onOpen(game)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(game);
        }
      }}
    >
      {/* a big tap area */}
      <rect x={-105} y={top - 30} width={210} height={-top + 120} fill="transparent" />
      <ellipse cx={0} cy={4} rx={86} ry={16} fill="#000" opacity={0.08} />
      <g transform={`scale(${SCALE})`}>
        <Landmark art={game.art} />
      </g>
      {/* the badges sit on the landmark itself */}
      {p?.homework && <HomeworkFlag due={p.homework.due} x={34} y={top + 44} />}
      {isNew && <NewBadge x={-44} y={top + 26} />}
      {/* the name plate, with stars or the best result */}
      <g transform="translate(0,22)">
        <rect x={-plateW / 2} y={0} width={plateW} height={38} rx={19} fill="#FFFFFF" stroke={INK} strokeWidth={3.5} />
        <text x={0} y={26} textAnchor="middle" fontSize={22} fontWeight={900} fill={INK} fontFamily="var(--font-nunito), system-ui, sans-serif">
          {game.title}
        </text>
        {isClass ? <JoinPill /> : !isNew && (p?.stars !== undefined || p?.best) && <Stars n={p?.stars} best={p?.best} />}
      </g>
    </g>
  );
}

// Rounds (accuracy) show stars and the %, endless runs their best points.
function Stars({ n, best }: { n?: number; best?: string }) {
  const star = (cx: number, on: boolean) => (
    <path
      key={cx}
      d={`M${cx},-11 L${cx + 3.4},-3.6 L${cx + 11},-3.2 L${cx + 5},1.8 L${cx + 7},9.6 L${cx},5.4 L${cx - 7},9.6 L${cx - 5},1.8 L${cx - 11},-3.2 L${cx - 3.4},-3.6 Z`}
      fill={on ? "#FFC23D" : "#D8D4E4"}
      stroke={INK}
      strokeWidth={2.4}
      strokeLinejoin="round"
    />
  );
  if (n === undefined)
    return (
      <g transform="translate(0,56)">
        <rect x={-62} y={-15} width={124} height={30} rx={15} fill="#FFF7E0" stroke={INK} strokeWidth={2.5} />
        <path d="M-44,-8 h14 v6 q0,8 -7,8 q-7,0 -7,-8 Z M-37,6 v4 M-42,10 h10" fill="#FFC23D" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
        <text x={8} y={7} textAnchor="middle" fontSize={17} fontWeight={900} fill={INK} fontFamily="var(--font-nunito), system-ui, sans-serif">
          {best}
        </text>
      </g>
    );
  const w = best ? 150 : 92;
  return (
    <g transform="translate(0,56)">
      <rect x={-w / 2} y={-15} width={w} height={30} rx={15} fill="#FFF7E0" stroke={INK} strokeWidth={2.5} />
      <g transform={`translate(${best ? -36 : 0},0)`}>{[-26, 0, 26].map((cx, i) => star(cx, i < n))}</g>
      {best && (
        <text x={46} y={7} textAnchor="middle" fontSize={17} fontWeight={900} fill={INK} fontFamily="var(--font-nunito), system-ui, sans-serif">
          {best}
        </text>
      )}
    </g>
  );
}

// Team Battle has no score of its own: the teacher starts it in class.
function JoinPill() {
  return (
    <g transform="translate(0,56)">
      <rect x={-78} y={-15} width={156} height={30} rx={15} fill="#E6F0FF" stroke={INK} strokeWidth={2.5} />
      <text x={0} y={6} textAnchor="middle" fontSize={16} fontWeight={900} fill="#2F5FB3" fontFamily="var(--font-nunito), system-ui, sans-serif">
        Join with a code
      </text>
    </g>
  );
}

function NewBadge({ x, y }: { x: number; y: number }) {
  return (
    // (the bob is on an inner group: a CSS animation's transform would
    // replace the position given in the transform attribute)
    <g transform={`translate(${x},${y}) rotate(-12)`}>
      <g style={{ animation: "isl-bob 2.2s ease-in-out infinite" }}>
      <path d="M0,-30 L9,-12 L29,-14 L16,2 L26,20 L6,14 L-6,30 L-10,10 L-30,6 L-14,-6 L-22,-26 L-4,-16 Z" fill="#FF6B8A" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <text x={0} y={6} textAnchor="middle" fontSize={15} fontWeight={900} fill="#FFFFFF" fontFamily="var(--font-nunito), system-ui, sans-serif">
        New!
      </text>
      </g>
    </g>
  );
}

// A homework pennant planted on the landmark, with the due day.
function HomeworkFlag({ due, x, y }: { due: string; x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <path d="M0,0 L0,-46" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M0,-46 L92,-46 L80,-30 L92,-14 L0,-14 Z" fill="#FFE27A" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      {/* a little notebook */}
      <rect x={6} y={-41} width={16} height={22} rx={2} fill="#FFFFFF" stroke={INK} strokeWidth={2} />
      <path d="M10,-34 h8 M10,-28 h8 M10,-23 h5" stroke={INK} strokeWidth={1.6} />
      <text x={50} y={-24} textAnchor="middle" fontSize={14} fontWeight={900} fill={INK} fontFamily="var(--font-nunito), system-ui, sans-serif">
        {due}
      </text>
    </g>
  );
}

function RegionBanner({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 13 + 44;
  return (
    <g transform={`translate(${x},${y})`}>
      <path d={`M${-w / 2 - 18},6 L${-w / 2},-4 L${-w / 2},26 L${-w / 2 - 18},16 Z M${w / 2 + 18},6 L${w / 2},-4 L${w / 2},26 L${w / 2 + 18},16 Z`} fill="#B9824C" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <rect x={-w / 2} y={-16} width={w} height={36} rx={6} fill="#D9A066" stroke={INK} strokeWidth={3.5} />
      <text x={0} y={9} textAnchor="middle" fontSize={22} fontWeight={900} fill={INK} fontFamily="var(--font-nunito), system-ui, sans-serif">
        {text}
      </text>
    </g>
  );
}

// The island: sea, beach, regions, paths and decoration.
function Island({ second = false }: { second?: boolean }) {
  return (
    <g stroke={INK} strokeLinejoin="round" data-island={second ? 2 : 1}>
      <rect x={-200} y={-200} width={MAP_W + 400} height={MAP_H + 400} fill="#7CCBF2" stroke="none" />
      {[[120, 60], [1400, 1060], [60, 560], [1520, 300], [700, 1070], [1000, 40]].map(([x, y], i) => (
        <path key={i} d={`M${x - 30},${y} q15,-12 30,0 q15,12 30,0`} fill="none" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
      ))}
      {/* sand rim and grass */}
      <path d="M180,130 Q520,40 800,90 Q1120,40 1430,130 Q1560,330 1500,620 Q1560,900 1400,1040 Q1100,1090 800,1060 Q450,1100 170,1040 Q40,860 90,600 Q30,320 180,130 Z" fill="#F2D99B" strokeWidth={6} />
      <path d="M220,170 Q520,90 800,135 Q1110,90 1390,170 Q1500,350 1450,600 Q1490,760 1420,880 L1060,890 Q1000,720 800,730 Q600,720 540,900 L170,910 Q110,760 140,600 Q90,340 220,170 Z" fill="#9ED98A" strokeWidth={0} />
      {/* Ear Forest: darker woods */}
      <path d="M200,190 Q420,120 640,170 Q690,320 640,440 Q520,560 320,560 Q170,520 150,380 Q140,260 200,190 Z" fill="#7CC27A" stroke="none" />
      {[[180, 260], [160, 390], [620, 200], [660, 380], [450, 380], [210, 540], [600, 520]].map(([x, y], i) => (
        <Pine key={i} x={x} y={y} />
      ))}
      {/* Piano Hill */}
      <path d="M960,420 Q1000,170 1200,150 Q1420,140 1460,300 Q1480,440 1380,540 Q1180,580 1000,520 Z" fill="#B8E39E" stroke="none" />
      <path d="M1000,420 Q1140,330 1300,380 Q1400,410 1440,380" fill="none" stroke="#8CC47A" strokeWidth={6} strokeLinecap="round" />
      {/* the river from Piano Hill through Rhythm Valley to the sea */}
      <path d="M1180,560 Q1060,640 900,690 Q760,730 700,820 Q660,920 700,1070" fill="none" stroke="#7CCBF2" strokeWidth={26} strokeLinecap="round" />
      {/* Note Beach: wide sand on the left */}
      <path d="M90,620 Q300,640 560,700 Q600,860 560,1060 Q300,1090 170,1040 Q50,880 90,620 Z" fill="#F2D99B" stroke="none" />
      <Palm x={120} y={700} />
      <Palm x={580} y={1020} />
      <Palm x={400} y={720} />
      {/* Tempo & Dynamics Plain: fields */}
      <path d="M1020,700 Q1240,640 1480,700 Q1500,900 1400,1030 Q1180,1070 1020,1020 Q980,860 1020,700 Z" fill="#D9E88A" stroke="none" />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${1040 + i * 8},${930 + i * 22} Q1250,${900 + i * 22} ${1460 - i * 10},${930 + i * 22}`} fill="none" stroke="#C3D46E" strokeWidth={5} />
      ))}
      {/* sand paths between the places */}
      <path
        d="M230,820 Q350,860 470,900 Q640,860 800,630 M800,630 Q980,760 1140,830 Q1260,880 1380,900 M800,630 Q800,450 800,300 M800,300 Q560,300 270,340 M800,300 Q700,300 530,300 M800,300 Q960,320 1080,340 Q1210,300 1340,300"
        fill="none"
        stroke="#F6E2AE"
        strokeWidth={18}
        strokeLinecap="round"
        strokeDasharray="2 26"
      />
    </g>
  );
}

function Pine({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} strokeWidth={3.5}>
      <rect x={-5} y={-12} width={10} height={14} fill="#8A5A34" />
      <path d="M0,-74 L26,-30 L14,-30 L32,-10 L-32,-10 L-14,-30 L-26,-30 Z" fill="#3F8A55" />
    </g>
  );
}

function Palm({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} strokeWidth={3.5}>
      <path d="M0,0 Q-6,-40 6,-80" fill="none" stroke="#8A5A34" strokeWidth={9} strokeLinecap="round" />
      <path d="M6,-80 Q-24,-96 -44,-74 Q-20,-82 6,-80 Q34,-100 54,-80 Q28,-84 6,-80 Q-6,-108 -24,-112 Q-4,-100 6,-80 Q22,-112 42,-110 Q20,-100 6,-80 Z" fill="#4F9F5A" />
    </g>
  );
}
