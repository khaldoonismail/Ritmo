"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { subscribeToTable } from "@/lib/supabase/realtime";
import { colors, radius, solidShadow } from "@/lib/theme";
import { shadowForColor } from "@/lib/teamColors";
import TeamLeaderboard, { LeaderboardTeam } from "@/components/TeamLeaderboard";
import TeamSetup, { TeamSetupConfig } from "./TeamSetup";

interface Game {
  id: string;
  title: string;
  questions: { id: string }[];
}

interface Participant {
  id: string;
  student_id: string;
  team_id: string | null;
  join_status: "pending" | "joined";
  score: number;
  studentName: string;
}

type HostStage = "setup" | "waiting" | "live" | "final";

// Host-side state machine for a real, multi-device Team Battle session.
// Fully separate from the Individual "Play Demo" stage machine in
// page.tsx — nothing here is shared with or affects that code path.
export default function TeamBattleHost({ game, gameUrl }: { game: Game; gameUrl: string }) {
  const [stage, setStage] = useState<HostStage>("setup");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const [sessionId, setSessionId] = useState("");
  const [pin, setPin] = useState("");
  const [teams, setTeams] = useState<LeaderboardTeam[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const totalQuestions = game.questions.length;

  // Memoized rather than recreated per render — a fresh client each render
  // gave its Realtime channel its own new websocket/auth handshake, which
  // could subscribe before the teacher's session token was attached.
  const supabaseRef = useRef(createBrowserSupabaseClient());
  const supabase = supabaseRef.current;

  async function loadRoster(sid: string) {
    const { data } = await supabase
      .from("game_participants")
      .select("id, student_id, team_id, join_status, score, students(name)")
      .eq("session_id", sid);
    setParticipants(
      (data || []).map((p: any) => ({
        id: p.id,
        student_id: p.student_id,
        team_id: p.team_id,
        join_status: p.join_status,
        score: p.score,
        studentName: p.students?.name ?? "Student",
      }))
    );
  }

  async function loadTeams(sid: string) {
    const { data } = await supabase.from("teams").select("id, name, color, score").eq("session_id", sid);
    setTeams(data || []);
  }

  useEffect(() => {
    if (!sessionId) return;
    if (stage === "waiting") {
      const unsubscribe = subscribeToTable(supabase, {
        table: "game_participants",
        filter: `session_id=eq.${sessionId}`,
        onChange: () => loadRoster(sessionId),
      });
      return unsubscribe;
    }
    if (stage === "live") {
      const unsubscribe = subscribeToTable(supabase, {
        table: "teams",
        filter: `session_id=eq.${sessionId}`,
        onChange: () => loadTeams(sessionId),
      });
      return unsubscribe;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, stage]);

  async function handleStart(config: TeamSetupConfig) {
    setStarting(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      if (!teacherRow) throw new Error("Teacher not found");

      const newPin = String(Math.floor(100000 + Math.random() * 900000));

      const { data: sessionRow, error: sessionError } = await supabase
        .from("game_sessions")
        .insert({
          game_id: game.id,
          teacher_id: teacherRow.id,
          pin: newPin,
          status: "lobby",
          current_question_index: 0,
          play_mode: "team_battle",
          class_id: config.classId,
          settings: {
            timerEnabled: config.timerEnabled,
            timeLimitSeconds: config.timeLimitSeconds,
          },
        })
        .select("id")
        .single();
      if (sessionError || !sessionRow) throw new Error(sessionError?.message || "Could not create session");

      const { data: teamRows, error: teamsError } = await supabase
        .from("teams")
        .insert(config.teams.map((t) => ({ session_id: sessionRow.id, name: t.name, color: t.color })))
        .select("id, name, color, score");
      if (teamsError || !teamRows) throw new Error(teamsError?.message || "Could not create teams");

      if (config.assignments.length > 0) {
        const { error: participantsError } = await supabase.from("game_participants").insert(
          config.assignments.map((a) => ({
            session_id: sessionRow.id,
            student_id: a.studentId,
            team_id: teamRows[a.teamIndex].id,
            join_status: "pending",
          }))
        );
        if (participantsError) throw new Error(participantsError.message);
      }

      setSessionId(sessionRow.id);
      setPin(newPin);
      setTeams(teamRows);
      await loadRoster(sessionRow.id);
      setStage("waiting");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setStarting(false);
    }
  }

  async function handleStartGame() {
    await supabase
      .from("game_sessions")
      .update({ status: "question", current_question_index: 0 })
      .eq("id", sessionId);
    setCurrentQuestionIndex(0);
    await loadTeams(sessionId);
    setStage("live");
  }

  async function handleNextQuestion() {
    // Guards against a double-click (or anything else firing this twice in
    // quick succession) racing on currentQuestionIndex before the first
    // call's state update lands — without it, two rapid calls both read the
    // same stale index and only one increment actually sticks.
    if (advancing) return;
    setAdvancing(true);
    try {
      const next = currentQuestionIndex + 1;
      if (next >= totalQuestions) {
        await supabase.from("game_sessions").update({ status: "final" }).eq("id", sessionId);
        await loadRoster(sessionId);
        setStage("final");
        return;
      }
      await supabase.from("game_sessions").update({ current_question_index: next }).eq("id", sessionId);
      setCurrentQuestionIndex(next);
    } finally {
      setAdvancing(false);
    }
  }

  if (stage === "setup") {
    return (
      <>
        {error && <p style={{ color: colors.coralText, fontWeight: 700 }}>{error}</p>}
        <TeamSetup onStart={handleStart} starting={starting} />
      </>
    );
  }

  if (stage === "waiting") {
    const byTeam = new Map<string, Participant[]>();
    for (const p of participants) {
      const key = p.team_id || "unassigned";
      if (!byTeam.has(key)) byTeam.set(key, []);
      byTeam.get(key)!.push(p);
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <p style={{ fontSize: "1rem", fontWeight: 700, opacity: 0.7, margin: 0 }}>Game PIN</p>
        <div
          style={{
            fontSize: "1.75rem",
            fontWeight: 800,
            letterSpacing: "0.1em",
            direction: "ltr",
            background: colors.blueBackground,
            boxShadow: solidShadow(5, colors.gamesCardShadow),
            color: colors.blueText,
            padding: "0.6rem 1.75rem",
            borderRadius: radius.card,
          }}
        >
          {pin}
        </div>
        {gameUrl && (
          <div
            style={{
              background: colors.white,
              boxShadow: solidShadow(5, colors.gamesCardShadow),
              borderRadius: radius.card,
              padding: "0.75rem",
            }}
          >
            <QRCodeSVG value={`${gameUrl.replace(/\/games\/play\/.*/, "")}/student/play`} size={128} />
          </div>
        )}
        <p style={{ opacity: 0.7, fontWeight: 600, maxWidth: "420px", margin: 0 }}>
          Students: log in, then go to "Join a Game" and enter this PIN.
        </p>

        <div style={{ width: "100%", maxWidth: "560px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {teams.map((team) => (
            <div
              key={team.id}
              style={{
                background: colors.white,
                borderRadius: radius.card,
                boxShadow: solidShadow(4, colors.gamesCardShadow),
                padding: "0.9rem 1.1rem",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    background: team.color,
                    display: "inline-block",
                  }}
                />
                <span style={{ fontWeight: 800 }}>{team.name}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {(byTeam.get(team.id) || []).map((p) => (
                  <span
                    key={p.id}
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      padding: "0.25rem 0.6rem",
                      borderRadius: radius.pill,
                      background: p.join_status === "joined" ? colors.greenButton : colors.background,
                      color: p.join_status === "joined" ? colors.white : colors.textPrimary,
                      opacity: p.join_status === "joined" ? 1 : 0.6,
                    }}
                  >
                    {p.studentName} {p.join_status === "joined" ? "✓" : "…"}
                  </span>
                ))}
                {(byTeam.get(team.id) || []).length === 0 && (
                  <span style={{ fontSize: "0.8rem", opacity: 0.5 }}>No students assigned</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleStartGame}
          style={{
            fontSize: "1.1rem",
            fontWeight: 800,
            padding: "0.85rem 2rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.greenButton,
            boxShadow: solidShadow(5, colors.greenButtonShadow),
            color: colors.white,
            cursor: "pointer",
          }}
        >
          Start Game
        </button>
      </div>
    );
  }

  if (stage === "live") {
    return (
      <div style={{ width: "100%", maxWidth: "560px", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <p style={{ fontWeight: 700, opacity: 0.85, margin: 0 }}>
          Question {currentQuestionIndex + 1} / {totalQuestions}
        </p>
        <TeamLeaderboard teams={teams} />
        <button
          onClick={handleNextQuestion}
          disabled={advancing}
          style={{
            fontSize: "1rem",
            fontWeight: 800,
            padding: "0.75rem 1.5rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.greenButton,
            boxShadow: solidShadow(4, colors.greenButtonShadow),
            color: colors.white,
            cursor: advancing ? "default" : "pointer",
            opacity: advancing ? 0.6 : 1,
          }}
        >
          {currentQuestionIndex + 1 >= totalQuestions ? "End Game" : "Next Question"}
        </button>
      </div>
    );
  }

  // final
  const topScorerByTeam = new Map<string, { name: string; score: number }>();
  for (const p of participants) {
    if (!p.team_id) continue;
    const current = topScorerByTeam.get(p.team_id);
    if (!current || p.score > current.score) {
      topScorerByTeam.set(p.team_id, { name: p.studentName, score: p.score });
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: "500px" }}>
      <h2 style={{ fontSize: "2.25rem", fontWeight: 800, margin: "0 0 1rem" }}>Final Results</h2>
      <TeamLeaderboard teams={teams} />
      <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {[...teams]
          .sort((a, b) => b.score - a.score)
          .map((team) => {
            const top = topScorerByTeam.get(team.id);
            if (!top) return null;
            return (
              <p key={team.id} style={{ margin: 0, fontSize: "0.9rem", opacity: 0.85 }}>
                🏆 {team.name} top scorer: {top.name} ({top.score} pts)
              </p>
            );
          })}
      </div>
    </div>
  );
}
