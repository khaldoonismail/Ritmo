import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { loadRunnerAssignment } from "@/lib/runnerAssignment";
import { rankByOf, runnerVariant } from "@/lib/runnerGames";
import { checkRun } from "@/lib/runCheck";

// Ends a run started by ../start: checks the answers against the chosen
// level and the time since the server started the run, recalculates the
// points (lib/runCheck.ts), and keeps the student's best run:
//   * game_results — one row per student per assignment (the leaderboard),
//     replaced only by a better run: more points for endless runs (Note
//     Runner, Up or Down, Piano Hop); higher accuracy, then more points,
//     for rounds (Happy or Sad, Rhythm Jump, Music Train — rankByOf);
//   * student_progress — completed, with the best run's accuracy (0–100) as
//     the score the reports show.
// Each run can be submitted once.

// A run left open longer than this can't be submitted any more.
const MAX_RUN_HOURS = 6;

export async function POST(request: NextRequest) {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const runId = typeof body?.runId === "string" ? body.runId : "";
  const answers: unknown = body?.answers;
  if (!runId) return NextResponse.json({ error: "Missing runId" }, { status: 400 });

  const supabase = createAdminSupabaseClient();
  const { data: run } = await supabase
    .from("game_runs")
    .select("id, assignment_id, student_id, started_at, finished_at")
    .eq("id", runId)
    .maybeSingle();
  if (!run || run.student_id !== session.studentId) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (run.finished_at) return NextResponse.json({ error: "This run was already saved" }, { status: 409 });

  const assignment = await loadRunnerAssignment(supabase, session, run.assignment_id);
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const now = new Date();
  const elapsedSeconds = (now.getTime() - new Date(run.started_at).getTime()) / 1000;
  const check =
    elapsedSeconds > MAX_RUN_HOURS * 3600
      ? ({ ok: false, reason: "run too old" } as const)
      : checkRun(assignment.settings, answers, elapsedSeconds);

  // Close the run first, and only if it's still open, so the same run can
  // never be saved twice (two tabs, a double tap, a replayed request).
  const { data: closed } = await supabase
    .from("game_runs")
    .update({
      finished_at: now.toISOString(),
      points: check.ok ? check.score.points : null,
      correct_count: check.ok ? check.score.correct : null,
      answer_count: Array.isArray(answers) ? answers.length : null,
    })
    .eq("id", run.id)
    .is("finished_at", null)
    .select("id");
  if (!closed || closed.length === 0) {
    return NextResponse.json({ error: "This run was already saved" }, { status: 409 });
  }

  if (!check.ok) {
    console.warn("runs/finish: rejected run", run.id, check.reason);
    return NextResponse.json({ error: "This run couldn't be saved.", reason: check.reason }, { status: 422 });
  }

  const score = check.score;
  const { data: existing } = await supabase
    .from("game_results")
    .select("points, accuracy")
    .eq("assignment_id", assignment.assignmentId)
    .eq("student_id", session.studentId)
    .maybeSingle();
  const previousBest = existing?.points ?? null;
  const previousAccuracy = existing ? Number(existing.accuracy) : null;

  // A run with no answers (quit straight away) counts for nothing.
  if (score.total === 0) {
    return NextResponse.json({
      ...score,
      best: previousBest ?? 0,
      bestAccuracy: previousAccuracy ?? 0,
      newBest: false,
      saved: false,
    });
  }

  const byAccuracy = rankByOf(assignment.generator) === "accuracy";
  const newBest =
    !existing ||
    (byAccuracy
      ? score.accuracy > previousAccuracy! || (score.accuracy === previousAccuracy && score.points > previousBest!)
      : score.points > previousBest!);
  if (newBest) {
    const { error: resultError } = await supabase.from("game_results").upsert(
      {
        student_id: session.studentId,
        class_id: assignment.classId,
        game_id: assignment.gameId,
        source: "assignment",
        assignment_id: assignment.assignmentId,
        points: score.points,
        correct_count: score.correct,
        total_questions: score.total,
        accuracy: score.accuracy,
        completed_at: now.toISOString(),
        variant: runnerVariant(assignment.settings),
      },
      { onConflict: "assignment_id,student_id" }
    );
    if (resultError) return NextResponse.json({ error: resultError.message }, { status: 500 });

    const { error: progressError } = await supabase.from("student_progress").upsert(
      {
        student_id: session.studentId,
        assignment_id: assignment.assignmentId,
        status: "completed",
        score: Math.round(score.accuracy),
      },
      { onConflict: "student_id,assignment_id" }
    );
    if (progressError) console.error("runs/finish: could not update student_progress", progressError.message);
  }

  return NextResponse.json({
    ...score,
    best: newBest ? score.points : previousBest,
    bestAccuracy: newBest ? score.accuracy : previousAccuracy,
    newBest,
    saved: true,
  });
}
