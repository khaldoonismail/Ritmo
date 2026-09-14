import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { colors } from "@/lib/theme";
import TeamBattlePlayer from "./TeamBattlePlayer";

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
      <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>{message}</h1>
      <a href="/student/dashboard" style={{ color: "inherit", textDecoration: "underline" }}>
        ← Back to Dashboard
      </a>
    </main>
  );
}

export default async function TeamBattleSessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;
  if (!session) {
    redirect("/student/login");
  }

  const supabase = createAdminSupabaseClient();
  const { data: participant } = await supabase
    .from("game_participants")
    .select("id, team_id")
    .eq("session_id", params.sessionId)
    .eq("student_id", session.studentId)
    .maybeSingle();

  if (!participant) {
    return <NotFound message="You're not part of this game" />;
  }

  return <TeamBattlePlayer sessionId={params.sessionId} />;
}
