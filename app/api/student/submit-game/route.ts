import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

interface QuestionShape {
  id: string;
  correctIndex: number;
}

interface AnswerInput {
  questionId: string;
  selectedIndex: number | null;
}

// Auto-grades a game-based assignment: a student answers every question in
// GamePlayer.tsx (self-paced, single player — no game_sessions/hosting
// involved, unlike the teacher's live-demo player at games/play/[id]),
// then this route scores the submission against each question's
// correctIndex and marks the assignment done. Runs via the service-role
// client since students authenticate with a signed JWT cookie rather than
// Supabase Auth and so have no auth.uid() for RLS to key off (same as
// every other app/api/student/* route).
export async function POST(request: NextRequest) {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId : "";
  const answers: AnswerInput[] = Array.isArray(body?.answers) ? body.answers : [];

  if (!assignmentId) {
    return NextResponse.json({ error: "Missing assignmentId" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, class_id, game_id, student_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment || assignment.class_id !== session.classId || !assignment.game_id) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  if (assignment.student_id && assignment.student_id !== session.studentId) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const { data: game } = await supabase
    .from("games")
    .select("questions")
    .eq("id", assignment.game_id)
    .maybeSingle();

  const questions = (game?.questions as QuestionShape[] | undefined) || [];
  if (questions.length === 0) {
    return NextResponse.json({ error: "This game has no questions" }, { status: 400 });
  }

  const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.selectedIndex]));
  const correctCount = questions.filter(
    (q) => answerByQuestionId.get(q.id) === q.correctIndex
  ).length;
  const score = Math.round((correctCount / questions.length) * 100);

  const { error: upsertError } = await supabase.from("student_progress").upsert(
    {
      student_id: session.studentId,
      assignment_id: assignmentId,
      status: "completed",
      score,
    },
    { onConflict: "student_id,assignment_id" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ score, correctCount, total: questions.length });
}
