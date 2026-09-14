// Fixed palette for Team Battle team colors — 6 entries to exactly cover the
// 2-6 team range. The first four reuse the existing Kahoot-style answer-tile
// colors (see app/games/play/[id]/page.tsx's answerColors) so a team's color
// stays visually consistent with the answer tile shape/color students tap
// during the round.

export interface TeamColor {
  name: string;
  hex: string;
  shadowHex: string;
}

export const teamColorPalette: TeamColor[] = [
  { name: "Red", hex: "#e21b3c", shadowHex: "#a8112c" },
  { name: "Blue", hex: "#1368ce", shadowHex: "#0d4a8f" },
  { name: "Yellow", hex: "#d89e00", shadowHex: "#a67800" },
  { name: "Green", hex: "#2ca30f", shadowHex: "#1f7a0b" },
  { name: "Purple", hex: "#8e44ad", shadowHex: "#6c3483" },
  { name: "Teal", hex: "#17a398", shadowHex: "#0f7a70" },
];

export function defaultTeamColor(index: number): TeamColor {
  return teamColorPalette[index % teamColorPalette.length];
}

export function shadowForColor(hex: string): string {
  return teamColorPalette.find((c) => c.hex === hex)?.shadowHex ?? hex;
}
