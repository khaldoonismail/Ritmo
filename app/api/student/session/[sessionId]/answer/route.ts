import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Grades one Team Battle answer on the server (never trusting the client
// for correctIndex) in a single database call: team_battle_submit_answer
// (supabase/migrations/0032_team_battle_submit_answer.sql) checks the
// session and question, the student's team, the server-anchored question
// clock (lib/teamBattleTiming.ts) and the late-answer grace, works out the
// points (lib/scoring.ts's formula), saves the answer, pools the points onto
// the team atomically and, with auto-advance on, moves to the reveal once
// everyone has answered. One round trip instead of 5-7, so an answer is
// quick wherever the server runs.
export async function POST(request: NextRequest, { params }: { params: { sessionId: string } }) {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const questionIndex = Number.isInteger(body?.questionIndex) ? body.questionIndex : -1;
  const selectedIndex = Number.isInteger(body?.selectedIndex) ? body.selectedIndex : null;
  // Only used for sessions started before 0024_team_battle_hardening.sql
  // (no server-anchored clock).
  const clientTimeLeftSeconds = typeof body?.timeLeftSeconds === "number" && Number.isFinite(body.timeLeftSeconds) ? body.timeLeftSeconds : 0;

  // A session id that isn't a uuid can't match a game (and would make the
  // database call fail).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.sessionId)) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("team_battle_submit_answer", {
    p_session_id: params.sessionId,
    p_student_id: session.studentId,
    p_question_index: questionIndex,
    p_selected_index: selectedIndex,
    p_client_time_left: clientTimeLeftSeconds,
  });
  if (error || !data || typeof data !== "object") {
    return NextResponse.json({ error: "Could not save your answer" }, { status: 500 });
  }

  const result = data as { status: number; error?: string; correct?: boolean; points?: number };
  if (result.status !== 200) {
    return NextResponse.json({ error: result.error ?? "Could not save your answer" }, { status: result.status });
  }
  return NextResponse.json({ correct: result.correct, points: result.points });
}
