import { variantLabel } from "@/lib/noteReading";

// Class game leaderboard, built from game_results (supabase/migrations/
// 0025_game_results.sql). Shared by the teacher's class page (which reads
// the rows through RLS) and the student dashboard (which reads them
// server-side), so both rank exactly the same way:
//   * Per game: each student's best play — highest accuracy, then points.
//     Results with a difficulty label (game_results.variant — the shared
//     Note Reading game's settings, e.g. "Treble Easy") get a board of their
//     own, so an Easy score is never ranked against a Hard one.
//     Endless runs (Note Runner, Up or Down: games in `pointsRanked`) have
//     no fixed number of questions, so their boards rank by points instead,
//     then accuracy.
//   * Overall: the sum of each student's best accuracy across every game
//     they've played (so playing more games counts), then total best points.

export interface GameResultRow {
  student_id: string;
  game_id: string;
  variant?: string | null;
  accuracy: number | string;
  points: number;
}

export interface LeaderboardEntry {
  studentId: string;
  name: string;
  // Per game: best accuracy (0–100). Overall: sum of best accuracies.
  score: number;
  // Points from the same best play(s) — the tie-breaker.
  points: number;
  // Overall only: distinct games this student has played.
  gamesPlayed: number;
}

export interface GameBoard {
  // Unique per board: the game id, plus "|variant" for labelled results.
  gameId: string;
  title: string;
  // Ranked by points (endless runs) rather than accuracy.
  byPoints?: boolean;
  entries: LeaderboardEntry[];
}

export interface Leaderboards {
  overall: LeaderboardEntry[];
  games: GameBoard[];
}

function byRank(a: LeaderboardEntry, b: LeaderboardEntry) {
  return b.score - a.score || b.points - a.points || a.name.localeCompare(b.name);
}

function byPointsRank(a: LeaderboardEntry, b: LeaderboardEntry) {
  return b.points - a.points || b.score - a.score || a.name.localeCompare(b.name);
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

// Student-facing names: first name only, plus the last name's initial
// ("Ahmed K.") when two or more classmates share that first name
// (case-insensitive). A one-word name has no initial to add, so it stays.
export function studentDisplayNames(students: { id: string; name: string }[]): Map<string, string> {
  const key = (name: string) => firstName(name).toLocaleLowerCase();
  const count = new Map<string, number>();
  for (const s of students) count.set(key(s.name), (count.get(key(s.name)) ?? 0) + 1);

  return new Map(
    students.map((s) => {
      const first = firstName(s.name);
      const parts = s.name.trim().split(/\s+/);
      if ((count.get(key(s.name)) ?? 0) < 2 || parts.length < 2) return [s.id, first];
      return [s.id, `${first} ${parts[parts.length - 1][0].toLocaleUpperCase()}.`];
    })
  );
}

export function buildLeaderboards(
  rows: GameResultRow[],
  nameByStudent: Map<string, string>,
  titleByGame: Map<string, string>,
  pointsRanked: Set<string> = new Set()
): Leaderboards {
  // Best play per (board, student); a board is a game, or a game plus a
  // difficulty label.
  const best = new Map<string, Map<string, { accuracy: number; points: number }>>();
  const boardTitle = new Map<string, string>();
  for (const row of rows) {
    if (!nameByStudent.has(row.student_id)) continue;
    const accuracy = Number(row.accuracy);
    const boardKey = row.variant ? `${row.game_id}|${row.variant}` : row.game_id;
    if (!boardTitle.has(boardKey)) {
      const title = titleByGame.get(row.game_id) ?? "Untitled game";
      const label = variantLabel(row.variant);
      boardTitle.set(boardKey, label ? `${title} – ${label}` : title);
    }
    let perStudent = best.get(boardKey);
    if (!perStudent) {
      perStudent = new Map();
      best.set(boardKey, perStudent);
    }
    const current = perStudent.get(row.student_id);
    const better = pointsRanked.has(row.game_id)
      ? !current || row.points > current.points || (row.points === current.points && accuracy > current.accuracy)
      : !current || accuracy > current.accuracy || (accuracy === current.accuracy && row.points > current.points);
    if (better) {
      perStudent.set(row.student_id, { accuracy, points: row.points });
    }
  }

  const overallTotals = new Map<string, LeaderboardEntry>();
  const games: GameBoard[] = [];
  for (const [gameId, perStudent] of best) {
    const byPoints = pointsRanked.has(gameId.split("|")[0]);
    const entries: LeaderboardEntry[] = [];
    for (const [studentId, { accuracy, points }] of perStudent) {
      const name = nameByStudent.get(studentId)!;
      entries.push({ studentId, name, score: accuracy, points, gamesPlayed: 1 });
      const total = overallTotals.get(studentId) || { studentId, name, score: 0, points: 0, gamesPlayed: 0 };
      total.score += accuracy;
      total.points += points;
      total.gamesPlayed += 1;
      overallTotals.set(studentId, total);
    }
    games.push({
      gameId,
      title: boardTitle.get(gameId) ?? "Untitled game",
      byPoints,
      entries: entries.sort(byPoints ? byPointsRank : byRank),
    });
  }

  return {
    overall: [...overallTotals.values()].sort(byRank),
    games: games.sort((a, b) => a.title.localeCompare(b.title)),
  };
}
