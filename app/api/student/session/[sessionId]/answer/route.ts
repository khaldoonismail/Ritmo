import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { computeAnswerPoints } from "@/lib/scoring";

interface QuestionShape {
  id: string;
  correctIndex: number;
}

interface SessionSettings {
  timerEnabled?: boolean;
  timeLimitSeconds?: number;
}

// Grades one Team Battle answer server-side (never trusting the client for
// correctIndex) and pools the resulting points onto the student's team via
// the award_team_battle_points RPC (supabase/migrations/0020_team_battle.sql),
// which does both updates atomically so concurrent teammates can't race.
export async function POST(request: NextRequest, { params }: { params: { sessionId: string } }) {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const questionIndex = Number.isInteger(body?.questionIndex) ? body.questionIndex : -1;
  const selectedIndex = Number.isInteger(body?.selectedIndex) ? body.selectedIndex : null;
  const timeLeftSeconds = typeof body?.timeLeftSeconds === "number" ? body.timeLeftSeconds : 0;

  const supabase = createAdminSupabaseClient();

  const { data: gameSession } = await supabase
    .from("game_sessions")
    .select("id, game_id, status, current_question_index, settings")
    .eq("id", params.sessionId)
    .maybeSingle();
  if (!gameSession) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (gameSession.status !== "question" || questionIndex !== gameSession.current_question_index) {
    return NextResponse.json({ error: "This question is no longer active" }, { status: 409 });
  }

  const { data: participant } = await supabase
    .from("game_participants")
    .select("id, team_id")
    .eq("session_id", gameSession.id)
    .eq("student_id", session.studentId)
    .maybeSingle();
  if (!participant || !participant.team_id) {
    return NextResponse.json({ error: "You're not part of this game" }, { status: 403 });
  }

  const { data: game } = await supabase.from("games").select("questions").eq("id", gameSession.game_id).maybeSingle();
  const questions = (game?.questions as QuestionShape[] | undefined) || [];
  const q = questions[questionIndex];
  if (!q) {
    return NextResponse.json({ error: "No question available" }, { status: 404 });
  }

  const correct = selectedIndex !== null && selectedIndex === q.correctIndex;
  const settings = (gameSession.settings as SessionSettings) || {};
  const points = computeAnswerPoints({
    correct,
    timerEnabled: settings.timerEnabled ?? true,
    timeLimitSeconds: settings.timeLimitSeconds ?? 20,
    timeLeftSeconds,
  });

  const { error: insertError } = await supabase.from("game_answers").insert({
    session_id: gameSession.id,
    participant_id: participant.id,
    question_index: questionIndex,
    selected_index: selectedIndex,
    is_correct: correct,
    points_earned: points,
  });
  if (insertError) {
    // Unique constraint on (session_id, participant_id, question_index) —
    // most likely a double-submit for the same question.
    return NextResponse.json({ error: "You already answered this question" }, { status: 409 });
  }

  if (points > 0) {
    await supabase.rpc("award_team_battle_points", {
      p_team_id: participant.team_id,
      p_participant_id: participant.id,
      p_points: points,
    });
  }

  return NextResponse.json({ correct, points });
}
