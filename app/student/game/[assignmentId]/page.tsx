import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  verifyStudentSessionToken,
  STUDENT_SESSION_COOKIE,
} from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { colors } from "@/lib/theme";
import GamePlayer from "./GamePlayer";

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
    .select("id, class_id, game_id, student_id")
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
    .select("id, title, questions")
    .eq("id", assignment.game_id)
    .maybeSingle();

  if (!game || !Array.isArray(game.questions) || game.questions.length === 0) {
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

  return (
    <GamePlayer
      assignmentId={assignment.id}
      title={game.title}
      questions={game.questions}
      alreadyCompleted={progress?.status === "completed"}
      savedScore={progress?.score ?? null}
    />
  );
}
