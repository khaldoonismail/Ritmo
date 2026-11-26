import {
  HARD_KEYS,
  HARD_MELODIES,
  hardPiece,
  piecesFor,
  type HappyOrSadLevel,
  type Mode,
  type Piece,
} from "@/lib/happyOrSad/pieces";

// One round of Happy or Sad: 10 pieces. Happy and sad come up about
// equally (4–6 of each), never more than three of one in a row, so
// guessing never pays. Hard: a melody never comes twice in a row, and its
// mode and key are picked fresh each time.

export const ROUND_LENGTH = 10;

// After an answer: how long the weather stays before the next piece (at
// least; the piece always plays to its end first), the quiet between
// pieces, before the first piece and before the round's end.
export const HOLD_RIGHT_MS = 1400;
export const HOLD_WRONG_MS = 2200;
export const GAP_MS = 900;
export const FIRST_PIECE_DELAY_MS = 600;
export const FINISH_DELAY_MS = 500;

export type Labels = "mood" | "mode"; // Happy/Sad or Major/Minor

// The choices on the settings screens (stage-1 page and Assign).
export const HAPPY_OR_SAD_LEVELS: { key: HappyOrSadLevel; label: string; detail: string }[] = [
  { key: "easy", label: "Easy", detail: "Bright, quick happy music, or slow, soft sad music" },
  { key: "medium", label: "Medium", detail: "Same speed and loudness: only major or minor tells them apart" },
  { key: "hard", label: "Hard", detail: "The same tune, sometimes major and sometimes minor, in different keys" },
];
export const HAPPY_OR_SAD_LABELS: { key: Labels; label: string }[] = [
  { key: "mood", label: "Happy / Sad" },
  { key: "mode", label: "Major / Minor" },
];

export function answerLabel(mode: Mode, labels: Labels): string {
  if (labels === "mode") return mode === "major" ? "Major" : "Minor";
  return mode === "major" ? "Happy" : "Sad";
}

// 1–3 stars for a round (no zero: every round builds something to see).
export function starsFor(correct: number): 1 | 2 | 3 {
  if (correct >= 9) return 3;
  if (correct >= 6) return 2;
  return 1;
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A mode sequence: 5 of each, no run of 4.
function modeOrder(rand: () => number): Mode[] {
  for (;;) {
    const seq = shuffle<Mode>([...Array(5).fill("major"), ...Array(5).fill("minor")], rand);
    if (!seq.some((m, i) => i >= 3 && seq[i - 1] === m && seq[i - 2] === m && seq[i - 3] === m)) return seq;
  }
}

export function buildRound(level: HappyOrSadLevel, rand: () => number = Math.random): Piece[] {
  const order = modeOrder(rand);
  if (level === "hard") {
    const out: Piece[] = [];
    let pool: typeof HARD_MELODIES = [];
    let last = "";
    for (const mode of order) {
      if (pool.length === 0) pool = shuffle(HARD_MELODIES, rand);
      let i = pool.findIndex((m) => m.id !== last);
      if (i < 0) i = 0;
      const [melody] = pool.splice(i, 1);
      last = melody.id;
      const key = HARD_KEYS[Math.floor(rand() * HARD_KEYS.length)];
      out.push(hardPiece(melody, mode, key));
    }
    return out;
  }
  const all = piecesFor(level);
  const happy = shuffle(all.filter((p) => p.mode === "major"), rand);
  const sad = shuffle(all.filter((p) => p.mode === "minor"), rand);
  return order.map((m) => (m === "major" ? happy : sad).shift()!);
}
