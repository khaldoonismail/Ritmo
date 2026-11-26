import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { loadRunnerAssignment } from "@/lib/runnerAssignment";

// Starts one run of an assigned runner game (lib/runnerGames.ts): the server
// stamps the start time (game_runs.started_at, 0029_runner_games.sql) so
// the finish route can tell how long the run really took.

// A student can't start runs faster than this (runs are at least several
// seconds long; this only stops a script from filling the table).
const MAX_RUNS_PER_MINUTE = 20;

export async function POST(request: NextRequest) {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId : "";
  const supabase = createAdminSupabaseClient();
  const assignment = await loadRunnerAssignment(supabase, session, assignmentId);
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("game_runs")
    .select("id", { count: "exact", head: true })
    .eq("student_id", session.studentId)
    .gte("started_at", since);
  if ((count ?? 0) >= MAX_RUNS_PER_MINUTE) {
    return NextResponse.json({ error: "Too many runs at once. Wait a moment." }, { status: 429 });
  }

  const { data: run, error } = await supabase
    .from("game_runs")
    .insert({ assignment_id: assignment.assignmentId, student_id: session.studentId, game_id: assignment.gameId })
    .select("id")
    .single();
  if (error || !run) return NextResponse.json({ error: error?.message || "Could not start" }, { status: 500 });
  return NextResponse.json({ runId: run.id });
}
