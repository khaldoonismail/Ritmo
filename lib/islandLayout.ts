import type { SkillArea } from "@/lib/gameRegistry";

// Music Island's layout (1600 × 1100 map units, components/island). Where
// each region's games stand (the base of the landmark), in order: a game's
// `spot` (lib/gameRegistry.ts) picks one; the rest show "Coming soon".
export const SPOTS: Record<SkillArea, [number, number][]> = {
  listening: [[270, 310], [530, 270], [390, 495]],
  class: [[800, 270]],
  piano: [[1080, 310], [1340, 270], [1220, 495]],
  rhythm: [[800, 600], [610, 670], [995, 670]],
  reading: [[230, 790], [470, 870], [250, 1000]],
  "tempo-dynamics": [[1140, 800], [1380, 870], [1180, 1000]],
};
export const SPOT_COUNT = Object.fromEntries(Object.entries(SPOTS).map(([k, v]) => [k, v.length])) as Record<SkillArea, number>;
