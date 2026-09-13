// Daily activity streak — how many consecutive days (including today, with a
// one-day grace period before it's considered broken) a student has had at
// least one non-"not_started" student_progress row. No dedicated activity
// log: this is derived from the same student_progress.updated_at timestamps
// already used elsewhere (weekly report, dashboard summary) as the app's
// standing proxy for "the student did something."

function isoDate(d: Date): string {
  return d.toLocaleDateString("en-CA"); // yyyy-mm-dd, local time
}

export function activityDateSet(timestamps: string[]): Set<string> {
  return new Set(timestamps.map((t) => isoDate(new Date(t))));
}

export function computeStreak(dates: Set<string>): number {
  if (dates.size === 0) return 0;

  const cursor = new Date();
  // Grace period: if nothing happened yet today, the streak isn't broken
  // until today ends — start counting from yesterday instead.
  if (!dates.has(isoDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (dates.has(isoDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
