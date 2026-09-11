// Motivational level ladder for the student dashboard. A student's total
// points is the sum of every graded (non-null score) student_progress row
// they own — the same score a teacher enters on the Assessment page
// (app/academy/teacher/assessment/StudentProgress.tsx), so no new grading
// concept or migration is needed, just a read of data that already exists.

export interface StudentLevel {
  key: string;
  label: string;
  icon: string;
  minPoints: number;
}

export const studentLevelLadder: StudentLevel[] = [
  { key: "beginner", label: "Beginner", icon: "🌱", minPoints: 0 },
  { key: "rising_star", label: "Rising Star", icon: "⭐", minPoints: 50 },
  { key: "star_performer", label: "Star Performer", icon: "🌟", minPoints: 150 },
  { key: "virtuoso", label: "Virtuoso", icon: "🏆", minPoints: 300 },
  { key: "maestro", label: "Maestro", icon: "👑", minPoints: 500 },
];

export interface LevelProgress {
  level: StudentLevel;
  next: StudentLevel | null;
  pointsIntoLevel: number;
  pointsToNext: number | null;
}

export function levelForPoints(totalPoints: number): LevelProgress {
  let current = studentLevelLadder[0];
  let next: StudentLevel | null = null;

  for (let i = 0; i < studentLevelLadder.length; i++) {
    if (totalPoints >= studentLevelLadder[i].minPoints) {
      current = studentLevelLadder[i];
      next = studentLevelLadder[i + 1] ?? null;
    }
  }

  return {
    level: current,
    next,
    pointsIntoLevel: totalPoints - current.minPoints,
    pointsToNext: next ? next.minPoints - totalPoints : null,
  };
}

// Per-lesson badge shown on a completed card with a graded score — kept to
// a couple of simple, obviously-earned thresholds rather than a whole
// achievements system.
export function scoreBadge(score: number | null): { icon: string; label: string } | null {
  if (score === null) return null;
  if (score >= 90) return { icon: "🌟", label: "Excellent score" };
  if (score >= 70) return { icon: "👍", label: "Good score" };
  return null;
}
