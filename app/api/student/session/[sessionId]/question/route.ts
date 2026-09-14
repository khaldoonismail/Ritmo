import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

interface QuestionShape {
  id: string;
  mediaType: string;
  prompt: string;
  mediaContent: string;
  imageContent?: string;
  options: string[];
  correctIndex: number;
}

// Returns the current question for a Team Battle round, with correctIndex
// stripped so a student's browser never sees the answer key — grading
// happens server-side in the answer route below.
export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: gameSession } = await supabase
    .from("game_sessions")
    .select("id, game_id, status, current_question_index, settings")
    .eq("id", params.sessionId)
    .maybeSingle();
  if (!gameSession) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const { data: participant } = await supabase
    .from("game_participants")
    .select("id")
    .eq("session_id", gameSession.id)
    .eq("student_id", session.studentId)
    .maybeSingle();
  if (!participant) {
    return NextResponse.json({ error: "You're not part of this game" }, { status: 403 });
  }

  const { data: game } = await supabase.from("games").select("questions").eq("id", gameSession.game_id).maybeSingle();
  const questions = (game?.questions as QuestionShape[] | undefined) || [];
  const q = questions[gameSession.current_question_index];
  if (!q) {
    return NextResponse.json({ error: "No question available" }, { status: 404 });
  }

  return NextResponse.json({
    status: gameSession.status,
    questionIndex: gameSession.current_question_index,
    question: {
      id: q.id,
      mediaType: q.mediaType,
      prompt: q.prompt,
      mediaContent: q.mediaContent,
      imageContent: q.imageContent,
      options: q.options,
    },
    settings: gameSession.settings,
  });
}
