import type { GameEntry, LandmarkArt, SkillArea } from "@/lib/gameRegistry";
import { Landmark } from "./Landmarks";

// The Game Library's little preview: the game's island landmark on its
// skill colour, with a light looping animation in the game's spirit
// (notes float up, the landmark bobs to a beat). CSS only, so it costs
// nothing on old tablets; switched off for "reduce motion".

const BG: Record<SkillArea, string> = {
  reading: "#FBE7B8",
  listening: "#CFEBC8",
  rhythm: "#CDEAF7",
  piano: "#E4F3D3",
  "tempo-dynamics": "#EEF0C2",
  class: "#F7DCE6",
};

// How fast each landmark bobs: Music Train's and Rhythm Jump's to a
// quick beat, Sleepy Town's slowly, as if breathing.
const BOB: Partial<Record<LandmarkArt, number>> = { station: 0.6, pond: 0.75, "sleepy-town": 3.2, "piano-bridge": 1.2 };

export function GamePreview({ game, height }: { game: GameEntry; height: number }) {
  const bob = BOB[game.art] ?? 2.2;
  return (
    <div className="lib-anim" aria-hidden="true" style={{ position: "relative", height, background: BG[game.skill], display: "grid", placeItems: "center", overflow: "hidden" }}>
      <svg viewBox="-120 -170 240 200" height={height - 8} style={{ animation: `lib-bob ${bob}s ease-in-out infinite`, overflow: "visible" }}>
        <Landmark art={game.art} />
      </svg>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${58 + i * 9}%`,
            top: "52%",
            fontSize: 20,
            fontWeight: 900,
            color: "#2B2745",
            opacity: 0,
            animation: `lib-note 2.4s ease-out ${i * 0.8}s infinite`,
          }}
        >
          {i % 2 ? "♫" : "♪"}
        </span>
      ))}
    </div>
  );
}
