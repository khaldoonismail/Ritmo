import { GAMES, gameByGenerator } from "@/lib/gameRegistry";
import { rankByOf } from "@/lib/runnerGames";

// What Music Island shows for one student, worked out on the server from
// their assignments, progress and game_results (app/student/dashboard):
// per registry game its stars / best result, whether it was ever played,
// the homework flag, and where tapping it leads. No browser code, so
// scripts/check-game-registry.ts can test it.

export interface IslandAssignment {
  id: string;
  game_id: string | null;
  due_at: string | null;
  assigned_at: string;
}
export interface IslandResult {
  game_id: string;
  points: number | null;
  accuracy: number | string | null;
}
export interface IslandGameProgress {
  stars?: 0 | 1 | 2 | 3;
  best?: string;
  played: boolean;
  homework?: { due: string };
}
export interface IslandData {
  progress: Record<string, IslandGameProgress>;
  hrefs: Record<string, string | null>;
  notes: Record<string, string>;
  homeworkCount: number;
}

type Status = "not_started" | "in_progress" | "completed";

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Today", "Fri" (within a week), "12 Dec", or "To do" with no due date.
// Dates are shown in UTC, like the server sees them.
export function dueLabel(dueAt: string | null, now: number): string {
  if (!dueAt) return "To do";
  const due = new Date(dueAt);
  const ms = due.getTime() - now;
  if (ms < 0) return "Late!";
  const sameDay = new Date(now).toISOString().slice(0, 10) === due.toISOString().slice(0, 10);
  if (sameDay) return "Today";
  if (ms < 6 * DAY) return WEEKDAY[due.getUTCDay()];
  return `${due.getUTCDate()} ${MONTH[due.getUTCMonth()]}`;
}

// Rounds: 3 stars from 90%, 2 from 60%, 1 for any finished round (the
// same as the games' own end screens).
export function starsForAccuracy(pct: number): 1 | 2 | 3 {
  if (pct >= 90) return 3;
  if (pct >= 60) return 2;
  return 1;
}

export function buildIslandData({
  assignments,
  generatorOf,
  statusOf,
  results,
  now = Date.now(),
}: {
  assignments: IslandAssignment[];
  generatorOf: Map<string, string | null>; // games.id → games.generator
  statusOf: Map<string, Status>; // assignment id → this student's status
  results: IslandResult[]; // this student's game_results rows
  now?: number;
}): IslandData {
  const progress: Record<string, IslandGameProgress> = {};
  const hrefs: Record<string, string | null> = {};
  const notes: Record<string, string> = {};

  // Best result per registry game, over every assignment of it.
  for (const r of results) {
    const g = gameByGenerator(generatorOf.get(r.game_id));
    if (!g) continue;
    const p = (progress[g.id] ??= { played: true });
    p.played = true;
    if (rankByOf(g.generator) === "accuracy") {
      const pct = Math.round(Number(r.accuracy ?? 0));
      const prev = p.best ? Number(p.best.replace("%", "")) : -1;
      if (pct > prev) {
        p.best = `${pct}%`;
        p.stars = starsForAccuracy(pct);
      }
    } else {
      const pts = Number(r.points ?? 0);
      const prev = p.best ? Number(p.best.replace(/\D/g, "")) : -1;
      if (pts > prev) p.best = pts.toLocaleString("en-US");
    }
  }

  // Homework: the active game assignments not completed yet, soonest due
  // first; tapping the landmark opens that assignment (results saved).
  let homeworkCount = 0;
  const byGame = new Map<string, IslandAssignment[]>();
  for (const a of assignments) {
    if (!a.game_id) continue;
    const g = gameByGenerator(generatorOf.get(a.game_id));
    if (!g) continue;
    byGame.set(g.id, [...(byGame.get(g.id) ?? []), a]);
    if ((statusOf.get(a.id) ?? "not_started") !== "not_started") (progress[g.id] ??= { played: true }).played = true;
  }
  const dueTime = (a: IslandAssignment) => (a.due_at ? new Date(a.due_at).getTime() : Infinity);
  for (const [id, list] of byGame) {
    const open = list.filter((a) => (statusOf.get(a.id) ?? "not_started") !== "completed").sort((a, b) => dueTime(a) - dueTime(b) || b.assigned_at.localeCompare(a.assigned_at));
    homeworkCount += open.length;
    const target = open[0] ?? [...list].sort((a, b) => b.assigned_at.localeCompare(a.assigned_at))[0];
    hrefs[id] = `/student/game/${target.id}`;
    if (open[0]) (progress[id] ??= { played: false }).homework = { due: dueLabel(open[0].due_at, now) };
  }

  // Everything else: the game's own page, for practice (not saved).
  for (const g of GAMES) {
    if (hrefs[g.id] !== undefined) continue;
    if (g.skill === "class") hrefs[g.id] = "/student/play";
    else if (g.route) hrefs[g.id] = g.route;
    else {
      hrefs[g.id] = null;
      notes[g.id] = `Your teacher will open ${g.title} for you.`;
    }
  }
  for (const g of GAMES) progress[g.id] ??= { played: false };
  return { progress, hrefs, notes, homeworkCount };
}
