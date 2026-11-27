import type { LandmarkArt } from "@/lib/gameRegistry";

// The island's landmarks, one per game, each in its game's own style, in
// our cartoon look (dark outline, flat fills, one highlight). Each is drawn
// standing on (0, 0), about 180 wide and 150 tall, so the map can place
// it on its spot. The teacher library uses the same drawings as previews.

const INK = "#2B2745";
const SW = 4;

function Lighthouse() {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      <ellipse cx={0} cy={0} rx={70} ry={14} fill="#E9C98A" />
      <path d="M-26,0 L-18,-104 L18,-104 L26,0 Z" fill="#FFFFFF" />
      <path d="M-24,-30 L24,-30 L22,-52 L-22,-52 Z M-20,-74 L20,-74 L19,-94 L-19,-94 Z" fill="#E2504C" />
      <rect x={-24} y={-130} width={48} height={28} rx={6} fill="#FFE27A" />
      <path d="M-30,-130 L0,-152 L30,-130 Z" fill="#E2504C" />
      {/* a note in the lamp */}
      <ellipse cx={-4} cy={-112} rx={6} ry={4.5} fill={INK} transform="rotate(-20 -4 -112)" stroke="none" />
      <path d="M1.5,-113 L1.5,-127" strokeWidth={3} />
      <path d="M-34,-118 l-26,-8 M-34,-112 l-26,4 M34,-118 l26,-8 M34,-112 l26,4" stroke="#FFE27A" strokeWidth={5} strokeLinecap="round" />
      <rect x={-8} y={-22} width={16} height={22} rx={6} fill="#6B4A6E" />
    </g>
  );
}

function FinishArch() {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      <path d="M-80,0 L-40,-30 L40,-30 L80,0 Z" fill="#E9A45E" />
      <path d="M-54,-10 L54,-10 M-66,-2 L66,-2" stroke="#FFFFFF" strokeWidth={3} strokeDasharray="10 8" />
      <rect x={-66} y={-118} width={12} height={110} fill="#8A86A8" />
      <rect x={54} y={-118} width={12} height={110} fill="#8A86A8" />
      <rect x={-72} y={-134} width={144} height={34} rx={8} fill="#6FD3FF" />
      {[-56, -36, -16, 4, 24, 44].map((x, i) => (
        <rect key={x} x={x} y={-128} width={10} height={10} fill={i % 2 ? "#FFFFFF" : INK} strokeWidth={0} />
      ))}
      {/* notes as stepping stones */}
      <ellipse cx={-20} cy={-50} rx={10} ry={7.5} fill={INK} transform="rotate(-20 -20 -50)" />
      <path d="M-11,-52 L-11,-78" strokeWidth={3.5} />
      <ellipse cx={20} cy={-62} rx={10} ry={7.5} fill={INK} transform="rotate(-20 20 -62)" />
      <path d="M29,-64 L29,-90" strokeWidth={3.5} />
    </g>
  );
}

function Treehouse() {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      <rect x={-12} y={-80} width={24} height={80} fill="#8A5A34" />
      <circle cx={0} cy={-118} r={52} fill="#4F8F5A" />
      <circle cx={-46} cy={-92} r={30} fill="#4F8F5A" />
      <circle cx={46} cy={-92} r={30} fill="#4F8F5A" />
      <rect x={-34} y={-112} width={68} height={42} rx={4} fill="#D9A066" />
      <path d="M-42,-110 L0,-140 L42,-110 Z" fill="#E2504C" />
      <rect x={-8} y={-102} width={16} height={18} rx={3} fill="#FFE27A" />
      {/* ladder */}
      <path d="M44,0 L52,-72 M64,0 L72,-72 M46,-16 L66,-16 M48,-34 L68,-34 M50,-52 L70,-52" strokeWidth={3.5} fill="none" />
      {/* up and down arrows */}
      <path d="M-66,-56 L-56,-72 L-46,-56 Z" fill="#8EE07A" />
      <path d="M-66,-36 L-56,-20 L-46,-36 Z" fill="#FF8A4C" />
    </g>
  );
}

function Village() {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      <rect x={-74} y={-60} width={64} height={60} fill="#F3D38A" />
      <path d="M-82,-58 L-42,-94 L-2,-58 Z" fill="#E2504C" />
      <rect x={-50} y={-30} width={18} height={30} rx={4} fill="#8A5A34" />
      <rect x={10} y={-50} width={60} height={50} fill="#9FC7E8" />
      <path d="M2,-48 L40,-82 L78,-48 Z" fill="#4D5C9E" />
      <rect x={32} y={-28} width={16} height={28} rx={4} fill="#6B4A6E" />
      {/* sun over one, rain over the other */}
      <circle cx={-42} cy={-128} r={16} fill="#FFC23D" />
      {[0, 60, 120, 180, 240, 300].map((d) => (
        <path key={d} d="M-42,-150 L-42,-158" transform={`rotate(${d} -42 -128)`} stroke="#F28C28" strokeWidth={4} strokeLinecap="round" />
      ))}
      <path d="M22,-116 Q22,-132 38,-132 Q46,-146 60,-136 Q76,-136 74,-120 Q74,-110 62,-110 L32,-110 Q22,-110 22,-116 Z" fill="#EEF3FB" />
      <path d="M34,-102 l-3,8 M48,-102 l-3,8 M62,-102 l-3,8" stroke="#5B7FD6" strokeWidth={3.5} strokeLinecap="round" />
    </g>
  );
}

function Pond() {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      <ellipse cx={0} cy={-26} rx={88} ry={36} fill="#7CCBF2" />
      <path d="M-50,-30 q10,-4 20,0 M20,-14 q10,-4 20,0" stroke="#FFFFFF" strokeWidth={3} fill="none" />
      <ellipse cx={-46} cy={-20} rx={22} ry={10} fill="#6DBE5E" />
      <ellipse cx={8} cy={-40} rx={22} ry={10} fill="#6DBE5E" />
      <ellipse cx={54} cy={-22} rx={22} ry={10} fill="#6DBE5E" />
      {/* the frog mid-hop */}
      <g transform="translate(-14,-82)">
        <ellipse cx={0} cy={0} rx={20} ry={16} fill="#86D474" />
        <circle cx={-9} cy={-14} r={7} fill="#86D474" />
        <circle cx={9} cy={-14} r={7} fill="#86D474" />
        <circle cx={-9} cy={-15} r={2.6} fill={INK} stroke="none" />
        <circle cx={9} cy={-15} r={2.6} fill={INK} stroke="none" />
        <path d="M-7,2 q7,6 14,0" fill="none" strokeWidth={3} />
      </g>
      <path d="M-30,-60 q16,-22 30,-12" stroke="#FFFFFF" strokeWidth={3} fill="none" strokeDasharray="4 6" />
    </g>
  );
}

function PianoBridge() {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      <path d="M-90,-6 Q0,-30 90,-6 L90,6 L-90,6 Z" fill="#7CCBF2" />
      <path d="M-84,-20 Q0,-96 84,-20" fill="none" strokeWidth={6} />
      {Array.from({ length: 7 }, (_, i) => {
        const x = -70 + i * 20;
        const t = (x + 84) / 168;
        const y = -20 - Math.sin(t * Math.PI) * 58;
        return <rect key={i} x={x} y={y} width={20} height={30} fill="#FFFFFF" strokeWidth={3} />;
      })}
      {[0, 1, 3, 4, 5].map((i) => {
        const x = -56 + i * 20;
        const t = (x + 84) / 168;
        const y = -20 - Math.sin(t * Math.PI) * 58;
        return <rect key={i} x={x} y={y - 2} width={12} height={18} fill={INK} strokeWidth={0} />;
      })}
      <path d="M-84,-20 L-84,6 M84,-20 L84,6" strokeWidth={6} />
    </g>
  );
}

function Station() {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      <path d="M-90,0 L90,0" strokeWidth={6} />
      <path d="M-84,-8 L84,-8" strokeWidth={3} strokeDasharray="6 10" />
      <rect x={-86} y={-92} width={8} height={70} fill="#8A86A8" />
      <rect x={-30} y={-92} width={8} height={70} fill="#8A86A8" />
      <path d="M-98,-92 L-58,-118 L-10,-92 Z" fill="#E2504C" />
      <rect x={-92} y={-30} width={76} height={12} fill="#C9B8A0" />
      {/* the little engine */}
      <rect x={4} y={-64} width={32} height={46} rx={4} fill="#E8524A" />
      <rect x={34} y={-44} width={50} height={26} rx={12} fill="#E8524A" />
      <rect x={62} y={-62} width={12} height={20} fill={INK} />
      <rect x={10} y={-58} width={20} height={14} rx={3} fill="#FFF3D6" />
      <circle cx={18} cy={-12} r={10} fill={INK} />
      <circle cx={56} cy={-12} r={10} fill={INK} />
      <circle cx={68} cy={-84} r={10} fill="#FFFFFF" strokeWidth={3} />
      <circle cx={84} cy={-98} r={13} fill="#FFFFFF" strokeWidth={3} />
    </g>
  );
}

function SleepyTown() {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      <ellipse cx={0} cy={-62} rx={96} ry={70} fill="#2F346A" />
      <circle cx={46} cy={-102} r={16} fill="#FFF0A8" />
      <path d="M40,-104 q3,3 6,0 M50,-104 q3,3 6,0" fill="none" strokeWidth={2.4} />
      {[[-60, -100], [-30, -118], [10, -110], [74, -70]].map(([x, y], i) => (
        <path key={i} d={`M${x},${y - 6} L${x + 2},${y - 2} L${x + 6},${y} L${x + 2},${y + 2} L${x},${y + 6} L${x - 2},${y + 2} L${x - 6},${y} L${x - 2},${y - 2} Z`} fill="#FFF3B0" strokeWidth={0} />
      ))}
      <rect x={-70} y={-52} width={50} height={52} fill="#E7A0A8" />
      <path d="M-78,-50 L-45,-80 L-12,-50 Z" fill="#7A4E8C" />
      <rect x={-58} y={-40} width={12} height={14} rx={3} fill="#3A3E6E" />
      <rect x={-8} y={-64} width={44} height={64} fill="#9FC7E8" />
      <path d="M-16,-62 L14,-90 L44,-62 Z" fill="#4D5C9E" />
      <rect x={2} y={-50} width={12} height={14} rx={3} fill="#FFD66B" />
      <rect x={48} y={-40} width={34} height={40} fill="#F3D38A" />
      <path d="M42,-38 L65,-60 L88,-38 Z" fill="#B5553F" />
      <g fill="#DDE3FF" stroke="none" fontWeight={900} fontFamily="system-ui, sans-serif">
        <text x={-34} y={-62} fontSize={16}>z</text>
        <text x={-24} y={-76} fontSize={20}>Z</text>
      </g>
    </g>
  );
}

function Arena() {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      <ellipse cx={0} cy={0} rx={86} ry={16} fill="#E9C98A" />
      <path d="M-72,-2 L-60,-70 L60,-70 L72,-2 Z" fill="#FFFFFF" />
      <path d="M-60,-70 L-48,-2 M-30,-70 L-24,-2 M0,-70 L0,-2 M30,-70 L24,-2 M60,-70 L48,-2" strokeWidth={3} />
      <path d="M-72,-2 L-60,-70 L-30,-70 L-24,-2 Z M0,-70 L30,-70 L24,-2 L0,-2 Z" fill="#FF6B8A" />
      <path d="M-66,-70 L0,-120 L66,-70 Z" fill="#6FD3FF" />
      <path d="M0,-120 L0,-150" strokeWidth={3.5} />
      <path d="M0,-150 L30,-142 L0,-134 Z" fill="#FFD24A" />
      <path d="M-70,-70 L-70,-104 M70,-70 L70,-104" strokeWidth={3.5} />
      <path d="M-70,-104 L-92,-98 L-70,-92 Z" fill="#E2504C" />
      <path d="M70,-104 L92,-98 L70,-92 Z" fill="#3D7FE0" />
    </g>
  );
}

// "Coming soon": a wooden sign on a post.
export function ComingSoon() {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round">
      <rect x={-6} y={-60} width={12} height={60} fill="#8A5A34" />
      <rect x={-74} y={-92} width={148} height={44} rx={8} fill="#D9A066" />
      <path d="M-66,-80 L66,-80 M-66,-62 L66,-62" stroke="#B9824C" strokeWidth={2} />
      <text x={0} y={-63} textAnchor="middle" fontSize={20} fontWeight={900} fill={INK} stroke="none" fontFamily="system-ui, sans-serif">
        Coming soon
      </text>
      {/* a little barrier stripe */}
      <path d="M-40,-34 L40,-34" stroke="#FFD24A" strokeWidth={8} />
      <path d="M-30,-34 L-22,-34 M-6,-34 L2,-34 M18,-34 L26,-34" stroke={INK} strokeWidth={8} />
    </g>
  );
}

export const LANDMARK: Record<LandmarkArt, () => JSX.Element> = {
  lighthouse: Lighthouse,
  "finish-arch": FinishArch,
  treehouse: Treehouse,
  village: Village,
  pond: Pond,
  "piano-bridge": PianoBridge,
  station: Station,
  "sleepy-town": SleepyTown,
  arena: Arena,
};

export function Landmark({ art }: { art: LandmarkArt }) {
  const Art = LANDMARK[art];
  return <Art />;
}
