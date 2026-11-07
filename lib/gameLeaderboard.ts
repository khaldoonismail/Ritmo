// Class game leaderboard, built from game_results (supabase/migrations/
// 0025_game_results.sql). Shared by the teacher's class page (which reads
// the rows through RLS) and the student dashboard (which reads them
// server-side), so both rank exactly the same way:
//   * Per game: each student's best play — highest accuracy, then points.
//   * Overall: the sum of each student's best accuracy across every game
//     they've played (so playing more games counts), then total best points.

export interface GameResultRow {
  student_id: string;
  game_id: string;
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
  gameId: string;
  title: string;
  entries: LeaderboardEntry[];
}

export interface Leaderboards {
  overall: LeaderboardEntry[];
  games: GameBoard[];
}

function byRank(a: LeaderboardEntry, b: LeaderboardEntry) {
  return b.score - a.score || b.points - a.points || a.name.localeCompare(b.name);
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

export function buildLeaderboards(
  rows: GameResultRow[],
  nameByStudent: Map<string, string>,
  titleByGame: Map<string, string>
): Leaderboards {
  // Best play per (game, student).
  const best = new Map<string, Map<string, { accuracy: number; points: number }>>();
  for (const row of rows) {
    if (!nameByStudent.has(row.student_id)) continue;
    const accuracy = Number(row.accuracy);
    let perStudent = best.get(row.game_id);
    if (!perStudent) {
      perStudent = new Map();
      best.set(row.game_id, perStudent);
    }
    const current = perStudent.get(row.student_id);
    if (!current || accuracy > current.accuracy || (accuracy === current.accuracy && row.points > current.points)) {
      perStudent.set(row.student_id, { accuracy, points: row.points });
    }
  }

  const overallTotals = new Map<string, LeaderboardEntry>();
  const games: GameBoard[] = [];
  for (const [gameId, perStudent] of best) {
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
    games.push({ gameId, title: titleByGame.get(gameId) ?? "Untitled game", entries: entries.sort(byRank) });
  }

  return {
    overall: [...overallTotals.values()].sort(byRank),
    games: games.sort((a, b) => a.title.localeCompare(b.title)),
  };
}
