import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// A student joins a live Team Battle round by PIN. If the teacher already
// pre-assigned this student to a team (the normal case — see
// TeamBattleHost.handleStart), this just flips their participant row from
// "pending" to "joined". A student who isn't pre-assigned (e.g. joined the
// class after setup) is auto-balanced onto whichever team currently has the
// fewest participants, rather than being blocked.
export async function POST(request: NextRequest) {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  if (!/^[0-9]{6}$/.test(pin)) {
    return NextResponse.json({ error: "Enter the 6-digit game PIN" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: gameSession } = await supabase
    .from("game_sessions")
    .select("id, class_id, play_mode, status")
    .eq("pin", pin)
    .neq("status", "final")
    .maybeSingle();

  if (!gameSession || gameSession.play_mode !== "team_battle") {
    return NextResponse.json({ error: "No live game with that PIN" }, { status: 404 });
  }
  if (gameSession.class_id !== session.classId) {
    return NextResponse.json({ error: "This game isn't for your class" }, { status: 403 });
  }
  if (gameSession.status !== "lobby") {
    return NextResponse.json({ error: "This game has already started" }, { status: 409 });
  }

  const { data: existing } = await supabase
    .from("game_participants")
    .select("id, team_id")
    .eq("session_id", gameSession.id)
    .eq("student_id", session.studentId)
    .maybeSingle();

  let teamId: string;

  if (existing) {
    teamId = existing.team_id;
    await supabase.from("game_participants").update({ join_status: "joined" }).eq("id", existing.id);
  } else {
    const [{ data: teams }, { data: participants }] = await Promise.all([
      supabase.from("teams").select("id").eq("session_id", gameSession.id),
      supabase.from("game_participants").select("team_id").eq("session_id", gameSession.id),
    ]);
    if (!teams || teams.length === 0) {
      return NextResponse.json({ error: "This game has no teams set up" }, { status: 500 });
    }
    const counts = new Map<string, number>(teams.map((t) => [t.id, 0]));
    for (const p of participants || []) {
      if (p.team_id && counts.has(p.team_id)) counts.set(p.team_id, (counts.get(p.team_id) || 0) + 1);
    }
    let smallest = teams[0].id;
    for (const t of teams) {
      if ((counts.get(t.id) || 0) < (counts.get(smallest) || 0)) smallest = t.id;
    }
    teamId = smallest;
    await supabase.from("game_participants").insert({
      session_id: gameSession.id,
      student_id: session.studentId,
      team_id: teamId,
      join_status: "joined",
    });
  }

  const { data: team } = await supabase.from("teams").select("name, color").eq("id", teamId).maybeSingle();

  return NextResponse.json({
    sessionId: gameSession.id,
    teamId,
    teamName: team?.name ?? "",
    teamColor: team?.color ?? "",
  });
}
