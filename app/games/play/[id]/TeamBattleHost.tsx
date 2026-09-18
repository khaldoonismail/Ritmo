"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { subscribeToTable } from "@/lib/supabase/realtime";
import { colors, radius, solidShadow } from "@/lib/theme";
import { shadowForColor } from "@/lib/teamColors";
import TeamLeaderboard, { LeaderboardTeam } from "@/components/TeamLeaderboard";
import TeamSetup, { TeamSetupConfig } from "./TeamSetup";

interface Question {
  id: string;
  mediaType: string;
  prompt: string;
  mediaContent: string;
  imageContent?: string;
  options: string[];
}

interface Game {
  id: string;
  title: string;
  questions: Question[];
}

// Small local copy of page.tsx's Kahoot-style answer-tile constants — kept
// separate rather than shared, matching the same call made for
// TeamBattlePlayer.tsx, so the untouched Individual-mode file stays that way.
const answerColors = ["#e21b3c", "#1368ce", "#d89e00", "#2ca30f"];
const answerShadowColors = ["#a8112c", "#0d4a8f", "#a67800", "#1f7a0b"];
const answerShapes = ["▲", "◆", "●", "■"];

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
  const [paused, setPaused] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [addingTime, setAddingTime] = useState(false);
  const [settings, setSettings] = useState({ timerEnabled: true, timeLimitSeconds: 20 });
  const [extensionSeconds, setExtensionSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
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

  // Host-side countdown display — a local mirror of the same per-client,
  // independent countdown TeamBattlePlayer runs for each student (no
  // server-anchored clock exists; see that file's timer effect). It's
  // purely a display for the teacher's own screen: it never drives
  // advancing the question or locking answers, which stay entirely
  // student- and teacher-button-driven.
  useEffect(() => {
    if (stage !== "live" || !settings.timerEnabled || paused) return;
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, timeLeft, settings.timerEnabled, paused]);

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
      setSettings({ timerEnabled: config.timerEnabled, timeLimitSeconds: config.timeLimitSeconds });
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
      .update({ status: "question", current_question_index: 0, time_extension_seconds: 0 })
      .eq("id", sessionId);
    setCurrentQuestionIndex(0);
    setPaused(false);
    setExtensionSeconds(0);
    setTimeLeft(settings.timerEnabled ? settings.timeLimitSeconds : 0);
    await loadTeams(sessionId);
    setStage("live");
  }

  async function handleNextQuestion() {
    // Guards against a double-click (or anything else firing this twice in
    // quick succession) racing on currentQuestionIndex before the first
    // call's state update lands — without it, two rapid calls both read the
    // same stale index and only one increment actually sticks. Also blocked
    // while paused so the round can't be advanced out from under a frozen
    // question.
    if (advancing || paused || skipping) return;
    setAdvancing(true);
    try {
      const next = currentQuestionIndex + 1;
      if (next >= totalQuestions) {
        await supabase.from("game_sessions").update({ status: "final" }).eq("id", sessionId);
        await loadRoster(sessionId);
        setStage("final");
        return;
      }
      await supabase
        .from("game_sessions")
        .update({ current_question_index: next, time_extension_seconds: 0 })
        .eq("id", sessionId);
      setCurrentQuestionIndex(next);
      setExtensionSeconds(0);
      setTimeLeft(settings.timerEnabled ? settings.timeLimitSeconds : 0);
    } finally {
      setAdvancing(false);
    }
  }

  // Discards the current question entirely: reverses any points already
  // earned for it (skip_team_battle_question, supabase/migrations/
  // 0023_quick_adjust.sql) before advancing, so a question the teacher
  // pulls mid-round leaves no score trace for anyone, even students who'd
  // already answered. Shares handleNextQuestion's advance/end-game shape
  // but isn't gated on `paused` — skipping a paused question is exactly
  // the situation this button exists for.
  async function handleSkipQuestion() {
    if (advancing || skipping) return;
    if (!window.confirm("Skip this question? No answers or points for it will count.")) return;
    setSkipping(true);
    try {
      const { error: skipError } = await supabase.rpc("skip_team_battle_question", {
        p_session_id: sessionId,
        p_question_index: currentQuestionIndex,
      });
      if (skipError) {
        setError(skipError.message || "Could not skip this question");
        return;
      }
      setError("");
      await loadTeams(sessionId);

      const next = currentQuestionIndex + 1;
      if (next >= totalQuestions) {
        await supabase.from("game_sessions").update({ status: "final" }).eq("id", sessionId);
        await loadRoster(sessionId);
        setStage("final");
        return;
      }
      await supabase
        .from("game_sessions")
        .update({ current_question_index: next, time_extension_seconds: 0, status: "question" })
        .eq("id", sessionId);
      setCurrentQuestionIndex(next);
      setPaused(false);
      setExtensionSeconds(0);
      setTimeLeft(settings.timerEnabled ? settings.timeLimitSeconds : 0);
    } finally {
      setSkipping(false);
    }
  }

  // Adds extra time to the current question. Just a number going up, so it
  // works the same whether the question is running or paused — pausing
  // only stops timeLeft from ticking, it doesn't stop it from being added
  // to. Propagates to every student the same way pause does: they're
  // already subscribed to this row, and add the same delta onto their own
  // local timeLeft the moment they see time_extension_seconds increase
  // (see TeamBattlePlayer).
  async function handleAddTime(seconds: number) {
    if (addingTime) return;
    setAddingTime(true);
    try {
      const nextExtension = extensionSeconds + seconds;
      const { error: extendError } = await supabase
        .from("game_sessions")
        .update({ time_extension_seconds: nextExtension })
        .eq("id", sessionId);
      if (extendError) {
        setError(extendError.message || "Could not add time");
        return;
      }
      setError("");
      setExtensionSeconds(nextExtension);
      setTimeLeft((v) => v + seconds);
    } finally {
      setAddingTime(false);
    }
  }

  // Toggles the round between "question" and "paused" in game_sessions —
  // current_question_index is never touched, so resuming lands back on the
  // exact same question. Each connected device (this host and every
  // student in TeamBattlePlayer) freezes its own already-ticking local
  // countdown the moment it sees status leave "question", and simply
  // continues it from wherever it was once status returns to "question" —
  // see TeamBattlePlayer's question-fetch effect, which is keyed on
  // questionIndex alone so it doesn't refetch/reset the timer on this flip.
  async function togglePause() {
    if (pausing || skipping) return;
    setPausing(true);
    try {
      const nextPaused = !paused;
      const { error: pauseError } = await supabase
        .from("game_sessions")
        .update({ status: nextPaused ? "paused" : "question" })
        .eq("id", sessionId);
      // Only flip the host's own local state once the write actually
      // lands — otherwise a failed update (e.g. a network blip) would show
      // "Game Paused" here while every student's screen stays live.
      if (pauseError) {
        setError(pauseError.message || "Could not update the game's pause state");
      } else {
        setError("");
        setPaused(nextPaused);
      }
    } finally {
      setPausing(false);
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
    const question = game.questions[currentQuestionIndex];
    return (
      <div style={{ width: "100%", maxWidth: "560px", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {error && <p style={{ color: colors.coralText, fontWeight: 700, margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <p style={{ fontWeight: 700, opacity: 0.85, margin: 0 }}>
            Question {currentQuestionIndex + 1} / {totalQuestions}
          </p>

          {/* Teacher controls toolbar — kept separate from the question and
              leaderboard below so Quick Adjust doesn't clutter the main
              view; every action here disables the others via the shared
              advancing/pausing/skipping/addingTime in-flight flags so two
              can't race against each other. */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {settings.timerEnabled && (
              <span
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  direction: "ltr",
                  background: colors.white,
                  color: colors.textPrimary,
                  padding: "0.35rem 0.7rem",
                  borderRadius: radius.pill,
                }}
              >
                {timeLeft}s
              </span>
            )}
            {settings.timerEnabled && (
              <button
                onClick={() => handleAddTime(15)}
                disabled={addingTime || skipping}
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  padding: "0.4rem 0.7rem",
                  borderRadius: radius.pill,
                  border: "none",
                  background: "rgba(255,255,255,0.15)",
                  color: colors.white,
                  cursor: addingTime || skipping ? "default" : "pointer",
                  opacity: addingTime || skipping ? 0.6 : 1,
                }}
              >
                +15s
              </button>
            )}
            <button
              onClick={togglePause}
              disabled={pausing || skipping}
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                padding: "0.4rem 0.9rem",
                borderRadius: radius.pill,
                border: "none",
                background: "rgba(255,255,255,0.15)",
                color: colors.white,
                cursor: pausing || skipping ? "default" : "pointer",
                opacity: pausing || skipping ? 0.6 : 1,
              }}
            >
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button
              onClick={handleSkipQuestion}
              disabled={advancing || skipping}
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                padding: "0.4rem 0.9rem",
                borderRadius: radius.pill,
                border: "none",
                background: "rgba(255,255,255,0.15)",
                color: colors.white,
                cursor: advancing || skipping ? "default" : "pointer",
                opacity: advancing || skipping ? 0.6 : 1,
              }}
            >
              ⏭ Skip
            </button>
          </div>
        </div>

        <div style={{ position: "relative" }}>
          {paused && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                background: "rgba(0,0,0,0.55)",
                borderRadius: radius.card,
                color: colors.white,
              }}
            >
              <span style={{ fontSize: "2rem" }}>⏸</span>
              <span style={{ fontSize: "1.3rem", fontWeight: 800 }}>Game Paused</span>
            </div>
          )}

          {question && (
            <>
              <div
                style={{
                  background: colors.white,
                  color: colors.textPrimary,
                  borderRadius: radius.card,
                  boxShadow: solidShadow(4, colors.gamesCardShadow),
                  padding: "1.25rem",
                  textAlign: "left",
                  marginBottom: "0.75rem",
                }}
              >
                <p style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                  {question.prompt || "Question"}
                </p>
                {question.mediaType === "audio" && question.mediaContent && (
                  <audio
                    key={question.id}
                    src={question.mediaContent}
                    controls
                    autoPlay
                    style={{ width: "100%", marginTop: "0.75rem" }}
                  />
                )}
                {question.imageContent && (
                  <img
                    src={question.imageContent}
                    alt=""
                    style={{ maxWidth: "100%", maxHeight: "220px", borderRadius: "8px", marginTop: "0.75rem" }}
                  />
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                {question.options.map((opt, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: "1rem",
                      fontWeight: 800,
                      padding: "1rem",
                      borderRadius: radius.button,
                      background: answerColors[i],
                      boxShadow: solidShadow(4, answerShadowColors[i]),
                      color: colors.white,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      textAlign: "left",
                    }}
                  >
                    <span>{answerShapes[i]}</span>
                    <span style={{ flex: 1 }}>{opt}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <TeamLeaderboard teams={teams} />
        <button
          onClick={handleNextQuestion}
          disabled={advancing || paused || skipping}
          style={{
            fontSize: "1rem",
            fontWeight: 800,
            padding: "0.75rem 1.5rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.greenButton,
            boxShadow: solidShadow(4, colors.greenButtonShadow),
            color: colors.white,
            cursor: advancing || paused || skipping ? "default" : "pointer",
            opacity: advancing || paused || skipping ? 0.6 : 1,
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
