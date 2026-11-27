import type { Answer } from "@/lib/loudOrSoft/music";

// Sleepy Town's answer pictures, drawn as SVG in our cartoon style (dark
// outlines, soft flat fills, pink cheeks) instead of emoji, so they look
// the same on every device. Each sits on a coloured disc with a white rim,
// like Happy or Sad's sun and rain cloud.

const INK = "#2B2745";
const SW = 3.5;
const CHEEK = "#FF8FA3";

const DISC: Record<Answer, string> = {
  pp: "#C9B8F0",
  p: "#8FC3F2",
  mf: "#9ED98A",
  f: "#FF9F86",
  ff: "#3B3F86",
  cresc: "#FFB561",
  dim: "#3B3F86",
  "subito-f": "#FF6B6B",
  "subito-p": "#B6A6E8",
};

export function AnswerIcon({ answer, size }: { answer: Answer; size: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ display: "block", flex: "0 0 auto" }}>
      <circle cx={32} cy={32} r={31} fill="#FFFFFF" />
      <circle cx={32} cy={32} r={27.5} fill={DISC[answer]} />
      <g stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round">
        {PICTURES[answer]}
      </g>
    </svg>
  );
}

// 🤫 A face going "shh": closed eyes, pursed lips and a finger on them,
// with little "shh" puffs beside.
const shh = (
  <>
    <circle cx={30} cy={30} r={18} fill="#FFD98A" />
    <path d="M19,27 q4,3.5 8,0 M33,27 q4,3.5 8,0" fill="none" strokeWidth={2.6} />
    <ellipse cx={18.5} cy={34} rx={3} ry={1.8} fill={CHEEK} stroke="none" />
    <ellipse cx={41.5} cy={34} rx={3} ry={1.8} fill={CHEEK} stroke="none" />
    <ellipse cx={30} cy={39} rx={4.2} ry={3.2} fill="#E2504C" strokeWidth={2.4} />
    <path d="M30,31 L30,50" stroke={INK} strokeWidth={7} />
    <path d="M30,31 L30,50" stroke="#F7C49B" strokeWidth={3.4} />
    <ellipse cx={30} cy={52} rx={7} ry={5.5} fill="#F7C49B" strokeWidth={2.6} />
    <path d="M50,30 q3,3 0,6 M54,27 q5,6 0,12" fill="none" stroke="#FFFFFF" strokeWidth={2.6} />
  </>
);

// 🪶 A feather: very, very soft.
const feather = (
  <>
    <path d="M44,16 Q50,30 34,44 Q26,50 20,48 Q18,40 24,32 Q32,20 44,16 Z" fill="#FFFFFF" />
    <path d="M44,16 Q32,32 20,48" fill="none" strokeWidth={2.6} />
    <path d="M36,27 l-6,-1 M32,33 l-6,-1 M38,32 l4,3 M33,38 l5,3" fill="none" strokeWidth={2.2} />
    <path d="M20,48 l-4,4" fill="none" strokeWidth={2.6} />
  </>
);

// 👟 A trainer: walking along.
const shoe = (
  <>
    <path d="M14,40 Q14,30 18,26 L28,26 Q30,32 38,33 L48,35 Q52,37 51,42 L51,44 L14,44 Z" fill="#FFFFFF" />
    <path d="M14,44 L51,44 L51,47 Q51,49 49,49 L16,49 Q14,49 14,47 Z" fill="#FF8A4C" />
    <path d="M24,30 l5,3 M22,34 l5,3" fill="none" strokeWidth={2.4} />
    <path d="M18,26 L28,26" fill="none" />
  </>
);

// 🥁 A drum with two sticks.
const drum = (
  <>
    <line x1={22} y1={22} x2={12} y2={10} strokeWidth={4} />
    <line x1={42} y1={22} x2={52} y2={10} strokeWidth={4} />
    <circle cx={12} cy={10} r={3} fill="#FFFFFF" strokeWidth={2.4} />
    <circle cx={52} cy={10} r={3} fill="#FFFFFF" strokeWidth={2.4} />
    <path d="M14,28 L14,44 Q32,54 50,44 L50,28 Z" fill="#E2504C" />
    <path d="M14,32 L22,44 L32,32 L42,44 L50,32" fill="none" stroke="#FFE27A" strokeWidth={3} />
    <ellipse cx={32} cy={28} rx={18} ry={6} fill="#F7EEDC" />
  </>
);

// 🎆 A firework burst on the night sky.
const firework = (
  <>
    {Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      const col = ["#FF6B8A", "#FFD24A", "#6FD3FF", "#8EE07A", "#FFFFFF"][i % 5];
      return <line key={i} x1={32 + Math.cos(a) * 7} y1={32 + Math.sin(a) * 7} x2={32 + Math.cos(a) * 19} y2={32 + Math.sin(a) * 19} stroke={col} strokeWidth={4} />;
    })}
    <circle cx={32} cy={32} r={4.5} fill="#FFD24A" strokeWidth={2.4} />
  </>
);

// 🌅 The sun coming up over a hill, with an arrow going up: waking up.
const sunrise = (
  <>
    {[-60, -30, 0, 30, 60].map((d) => (
      <line key={d} x1={32} y1={22} x2={32} y2={13} transform={`rotate(${d} 32 38)`} stroke="#FFF3B0" strokeWidth={3.4} />
    ))}
    <path d="M18,40 A14,14 0 0 1 46,40 Z" fill="#FFD24A" />
    <path d="M8,48 Q32,34 56,48 L56,52 L8,52 Z" fill="#6DBE5E" stroke="none" />
    <path d="M10,47 Q32,35 54,47" fill="none" />
  </>
);

// 🌙 A sleepy moon with a "z": falling asleep.
const moon = (
  <>
    <path d="M38,14 A18,18 0 1 0 50,42 A15,15 0 1 1 38,14 Z" fill="#FFF0A8" />
    <path d="M26,34 q3,2.5 6,0" fill="none" strokeWidth={2.4} />
    <ellipse cx={24} cy={39} rx={2.6} ry={1.6} fill={CHEEK} stroke="none" />
    <path d="M42,22 h7 l-7,8 h7" fill="none" stroke="#FFFFFF" strokeWidth={2.6} />
  </>
);

// 💥 A jagged burst with "!": suddenly loud.
const burst = (
  <>
    <path d="M32,10 L37,22 L50,16 L44,28 L56,33 L44,38 L50,50 L37,43 L32,55 L27,43 L14,50 L20,38 L8,33 L20,28 L14,16 L27,22 Z" fill="#FFE27A" />
    <path d="M32,23 L32,36" fill="none" strokeWidth={4.5} />
    <circle cx={32} cy={42.5} r={2.6} fill={INK} stroke="none" />
  </>
);

// 🛏️ A soft pillow with a "z": suddenly soft.
const pillow = (
  <>
    <path d="M12,30 Q12,22 20,22 L44,22 Q52,22 52,30 L52,40 Q52,48 44,48 L20,48 Q12,48 12,40 Z" fill="#FFFFFF" />
    <path d="M20,22 Q32,28 44,22 M20,48 Q32,42 44,48" fill="none" strokeWidth={2.4} />
    <path d="M26,31 h8 l-8,8 h8" fill="none" strokeWidth={2.8} stroke="#8C7BD0" />
  </>
);

const PICTURES: Record<Answer, React.ReactNode> = {
  pp: feather,
  p: shh,
  mf: shoe,
  f: drum,
  ff: firework,
  cresc: sunrise,
  dim: moon,
  "subito-f": burst,
  "subito-p": pillow,
};

// A dynamic marking written the way it is in music (bold italic serif),
// with a drawn hairpin for crescendo / diminuendo.
export function Hairpin({ dir, height = 12 }: { dir: "cresc" | "dim"; height?: number }) {
  return (
    <svg viewBox="0 0 60 24" width={height * 2.5} height={height} aria-hidden="true" style={{ display: "inline-block", verticalAlign: "middle" }}>
      <path d={dir === "cresc" ? "M2,12 L58,2 M2,12 L58,22" : "M2,2 L58,12 M2,22 L58,12"} stroke="currentColor" strokeWidth={3.2} fill="none" strokeLinecap="round" />
    </svg>
  );
}
