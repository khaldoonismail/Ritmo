// Fixed vocabulary of category tags a teacher can attach to a game, shown
// as toggle chips on Create Game and as filter chips on the Community
// Games list in the Games Library. Stored as a plain text[] on
// public.games (0012_game_tags.sql) — kept as a small fixed list here
// (rather than open free-text) so filtering stays exact-match and the UI
// doesn't sprawl into dozens of one-off tags.

export const gameTagGallery = [
  { key: "theory", label: "Theory" },
  { key: "instrument-id", label: "Instrument ID" },
  { key: "scales", label: "Scales / Solfège" },
  { key: "rhythm", label: "Rhythm" },
  { key: "ear-training", label: "Ear Training" },
  { key: "dynamics", label: "Dynamics" },
] as const;

export type GameTagKey = (typeof gameTagGallery)[number]["key"];

export function tagLabel(key: string): string {
  return gameTagGallery.find((t) => t.key === key)?.label ?? key;
}
