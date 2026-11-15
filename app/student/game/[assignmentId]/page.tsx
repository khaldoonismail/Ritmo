import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  verifyStudentSessionToken,
  STUDENT_SESSION_COOKIE,
} from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { colors } from "@/lib/theme";
import GamePlayer from "./GamePlayer";
import { assignmentQuestions } from "@/lib/gameQuestions";
import { NOTE_READING_GENERATOR, configLabel, normalizeNoteReadingConfig } from "@/lib/noteReading";

function NotFound({ message }: { message: string }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>
        {message}
      </h1>
      <a href="/student/dashboard" style={{ color: "inherit", textDecoration: "underline" }}>
        ← Back to Dashboard
      </a>
    </main>
  );
}

export default async function StudentGamePage({
  params,
}: {
  params: { assignmentId: string };
}) {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;

  if (!session) {
    redirect("/student/login");
  }

  const supabase = createAdminSupabaseClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, class_id, game_id, student_id, game_settings")
    .eq("id", params.assignmentId)
    .maybeSingle();

  if (!assignment || assignment.class_id !== session.classId || !assignment.game_id) {
    return <NotFound message="Assignment not found" />;
  }

  if (assignment.student_id && assignment.student_id !== session.studentId) {
    return <NotFound message="Assignment not found" />;
  }

  const { data: game } = await supabase
    .from("games")
    .select("id, title, questions, generator")
    .eq("id", assignment.game_id)
    .maybeSingle();

  if (!game) {
    return <NotFound message="This game isn't available yet" />;
  }

  // Already completed? Show the saved result instead of letting the
  // student re-take it and silently overwrite their score.
  const { data: progress } = await supabase
    .from("student_progress")
    .select("status, score")
    .eq("student_id", session.studentId)
    .eq("assignment_id", assignment.id)
    .maybeSingle();
  const alreadyCompleted = progress?.status === "completed";

  // The shared Note Reading game: this student's own generated set (made on
  // first open, not for an already-completed assignment).
  const questions = await assignmentQuestions(supabase, {
    assignmentId: assignment.id,
    studentId: session.studentId,
    game,
    gameSettings: assignment.game_settings,
    create: !alreadyCompleted,
  });
  if (questions.length === 0 && !alreadyCompleted) {
    return <NotFound message="This game isn't available yet" />;
  }
  const title =
    game.generator === NOTE_READING_GENERATOR
      ? `${game.title} – ${configLabel(normalizeNoteReadingConfig(assignment.game_settings))}`
      : game.title;

  return (
    <GamePlayer
      assignmentId={assignment.id}
      title={title}
      questions={questions as Parameters<typeof GamePlayer>[0]["questions"]}
      alreadyCompleted={alreadyCompleted}
      savedScore={progress?.score ?? null}
    />
  );
}
