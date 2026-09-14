import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Final Team Battle results for the student-facing end screen. Uses the
// admin client because it needs to join student names, which anon-key
// clients can't read directly (students table RLS is teacher-only).
export async function GET(request: NextRequest, { params }: { params: { sessionId: string } }) {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: participant } = await supabase
    .from("game_participants")
    .select("id")
    .eq("session_id", params.sessionId)
    .eq("student_id", session.studentId)
    .maybeSingle();
  if (!participant) {
    return NextResponse.json({ error: "You're not part of this game" }, { status: 403 });
  }

  const [{ data: teams }, { data: participants }] = await Promise.all([
    supabase.from("teams").select("id, name, color, score").eq("session_id", params.sessionId),
    supabase
      .from("game_participants")
      .select("team_id, score, students(name)")
      .eq("session_id", params.sessionId),
  ]);

  const topScorerByTeam = new Map<string, { name: string; score: number }>();
  for (const p of participants || []) {
    if (!p.team_id) continue;
    const name = (p.students as any)?.name ?? "Student";
    const current = topScorerByTeam.get(p.team_id);
    if (!current || p.score > current.score) {
      topScorerByTeam.set(p.team_id, { name, score: p.score });
    }
  }

  const results = (teams || [])
    .map((t) => ({ ...t, topScorer: topScorerByTeam.get(t.id) ?? null }))
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({ teams: results });
}
