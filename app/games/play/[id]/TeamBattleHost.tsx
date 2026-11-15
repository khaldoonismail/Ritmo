"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { subscribeToTable } from "@/lib/supabase/realtime";
import { colors, radius, solidShadow } from "@/lib/theme";
import { shadowForColor } from "@/lib/teamColors";
import TeamLeaderboard, { LeaderboardTeam } from "@/components/TeamLeaderboard";
import TeamSetup, { TeamSetupConfig } from "./TeamSetup";
import NoteStaff from "@/components/NoteStaff";
import { NOTE_READING_GENERATOR, generateFromConfig, isNoteSpec, noteReadingVariant } from "@/lib/noteReading";
import { playNote, unlockNoteAudio } from "@/lib/playNote";
import {
  DEFAULT_REVEAL_SECONDS,
  LATE_ANSWER_GRACE_SECONDS,
  displaySecondsLeft,
  revealSecondsLeft,
  revealTimingFromSessionRow,
  secondsLeft,
  timingFromSessionRow,
  type QuestionTiming,
  type RevealTiming,
} from "@/lib/teamBattleTiming";

interface Question {
  id: string;
  mediaType: string;
  prompt: string;
  mediaContent: string;
  imageContent?: string;
  options: string[];
  correctIndex: number;
  // Note Reading questions (lib/noteReading.ts).
  note?: unknown;
}

interface Game {
  id: string;
  title: string;
  questions: Question[];
  // 'note_reading': no saved questions; each session generates its own
  // and stores them in session_questions (0028_note_reading_single_game.sql).
  generator?: string | null;
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

// An unfinished Team Battle session for this game, found on load so a host
// who reloaded or closed the tab can pick it back up (or end it).
interface ResumableSession {
  id: string;
  pin: string;
  status: string;
  current_question_index: number;
  settings: { timerEnabled?: boolean; timeLimitSeconds?: number; autoAdvance?: boolean; revealSeconds?: number } | null;
}

interface HostSettings {
  timerEnabled: boolean;
  timeLimitSeconds: number;
  // Missing on sessions started before 0026_auto_advance.sql, which keep
  // the manual Show Answer / Next Question flow.
  autoAdvance: boolean;
  revealSeconds: number;
}

function hostSettingsFrom(raw: ResumableSession["settings"]): HostSettings {
  return {
    timerEnabled: raw?.timerEnabled ?? true,
    timeLimitSeconds: raw?.timeLimitSeconds ?? 20,
    autoAdvance: raw?.autoAdvance ?? false,
    revealSeconds: raw?.revealSeconds ?? DEFAULT_REVEAL_SECONDS,
  };
}

// How often the host retries an automatic step the database turned down
// (e.g. this device's clock ran slightly ahead of the database's).
const AUTO_RETRY_MS = 1000;

interface RevealStats {
  answered: number;
  correct: number;
  perOption: number[];
}

const SESSION_TIMING_COLUMNS =
  "status, current_question_index, time_extension_seconds, question_started_at, paused_at, paused_seconds, reveal_started_at, reveal_paused_seconds";

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
  const [revealing, setRevealing] = useState(false);
  const [revealStats, setRevealStats] = useState<RevealStats | null>(null);
  const [ending, setEnding] = useState(false);
  const [resumable, setResumable] = useState<ResumableSession | null>(null);
  const [settings, setSettingsState] = useState<HostSettings>(() => hostSettingsFrom(null));
  // Mirrors `settings` for the Realtime callback, which outlives renders.
  const settingsRef = useRef(settings);
  function setSettings(next: HostSettings) {
    settingsRef.current = next;
    setSettingsState(next);
  }
  // The current question's server-anchored clock (lib/teamBattleTiming.ts),
  // refreshed from game_sessions after every host action.
  const [timing, setTiming] = useState<QuestionTiming | null>(null);
  // The reveal countdown before an auto-advance (0026_auto_advance.sql).
  const [revealTiming, setRevealTiming] = useState<RevealTiming | null>(null);
  // Last time this device asked the database for an automatic reveal or
  // advance, so the 250ms tick doesn't fire one per tick.
  const autoRequestRef = useRef<{ key: string; at: number } | null>(null);
  // Database time minus this device's time, from the RPCs' returned now().
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // This session's generated questions (shared Note Reading game), else the
  // game's own saved questions.
  const [sessionQuestions, setSessionQuestions] = useState<Question[] | null>(null);
  const questions = sessionQuestions ?? game.questions;
  const totalQuestions = questions.length;
  const extensionSeconds = timing?.extensionSeconds ?? 0;
  const timeLeft = timing ? displaySecondsLeft(timing, nowMs + clockOffsetMs) : 0;
  const revealPaused = revealing && !!revealTiming?.pausedAt;
  const revealLeft = revealTiming
    ? Math.min(revealTiming.revealSeconds, Math.max(0, Math.ceil(revealSecondsLeft(revealTiming, nowMs + clockOffsetMs))))
    : 0;

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

  // Re-reads the session's status, question and clock — the single source
  // of truth for the live screen, so a reload lands on the same state.
  async function refreshSession(sid: string) {
    const data = await fetchSessionRow(sid);
    if (data) applySessionRow(data);
    return data;
  }

  async function fetchSessionRow(sid: string) {
    const { data } = await supabase.from("game_sessions").select(SESSION_TIMING_COLUMNS).eq("id", sid).maybeSingle();
    return data;
  }

  function applySessionRow(data: NonNullable<Awaited<ReturnType<typeof fetchSessionRow>>>) {
    const { timeLimitSeconds, revealSeconds } = settingsRef.current;
    // nowMs only ticks while a countdown runs, so it can be minutes old
    // here (e.g. from the lobby); refresh it with the new clock so the
    // first render doesn't show a too-long countdown.
    setNowMs(Date.now());
    setCurrentQuestionIndex(data.current_question_index);
    setPaused(data.status === "paused");
    setRevealing(data.status === "reveal");
    setTiming(timingFromSessionRow(data, timeLimitSeconds));
    setRevealTiming(data.status === "reveal" ? revealTimingFromSessionRow(data, revealSeconds) : null);
  }

  // Brings the live screen in line with the session row after any change —
  // the host's own actions, and ones made elsewhere (the answer route's
  // "everyone answered" reveal, the game ending in another tab).
  async function syncLive(sid: string) {
    const data = await fetchSessionRow(sid);
    if (!data) return null;
    // Load the reveal's answer counts before switching the screen to the
    // reveal, so the options never flash a count of 0.
    if (data.status === "reveal") {
      await Promise.all([loadRevealStats(sid, data.current_question_index), loadTeams(sid)]);
    } else {
      setRevealStats(null);
    }
    applySessionRow(data);
    if (data.status === "final") {
      await Promise.all([loadTeams(sid), loadRoster(sid)]);
      setStage("final");
    }
    return data;
  }

  function syncClock(serverNow: string | null) {
    if (serverNow) setClockOffsetMs(Date.parse(serverNow) - Date.now());
  }

  async function loadRevealStats(sid: string, questionIndex: number) {
    const { data } = await supabase
      .from("game_answers")
      .select("selected_index, is_correct")
      .eq("session_id", sid)
      .eq("question_index", questionIndex);
    const perOption = [0, 0, 0, 0];
    let correct = 0;
    for (const a of data || []) {
      if (a.selected_index !== null && a.selected_index >= 0 && a.selected_index < perOption.length) {
        perOption[a.selected_index] += 1;
      }
      if (a.is_correct) correct += 1;
    }
    setRevealStats({ answered: (data || []).length, correct, perOption });
  }

  // Looks for this teacher's unfinished Team Battle session for this game.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      if (!teacherRow) return;
      const { data } = await supabase
        .from("game_sessions")
        .select("id, pin, status, current_question_index, settings")
        .eq("game_id", game.id)
        .eq("teacher_id", teacherRow.id)
        .eq("play_mode", "team_battle")
        .neq("status", "final")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setResumable(data as ResumableSession);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  async function handleResume(row: ResumableSession) {
    unlockNoteAudio();
    setError("");
    setSessionId(row.id);
    setPin(row.pin);
    setSettings(hostSettingsFrom(row.settings));
    if (game.generator === NOTE_READING_GENERATOR) {
      const { data: sq } = await supabase
        .from("session_questions")
        .select("questions")
        .eq("session_id", row.id)
        .maybeSingle();
      if (!sq || !Array.isArray(sq.questions)) {
        setError("This game's questions could not be loaded. End it and start a new one.");
        return;
      }
      setSessionQuestions(sq.questions as Question[]);
    }
    await Promise.all([loadTeams(row.id), loadRoster(row.id)]);
    const current = await refreshSession(row.id);
    if (!current) {
      setError("That game could not be loaded.");
      return;
    }
    setResumable(null);
    if (current.status === "lobby") {
      setStage("waiting");
    } else if (current.status === "final") {
      setStage("final");
    } else {
      if (current.status === "reveal") await loadRevealStats(row.id, current.current_question_index);
      setStage("live");
    }
  }

  // Ends the session for everyone: students land on Final Results, and the
  // PIN is freed for reuse (game_sessions_active_pin_idx ignores 'final').
  async function endSession(sid: string) {
    const { error: endError } = await supabase
      .from("game_sessions")
      .update({ status: "final", ended_at: new Date().toISOString() })
      .eq("id", sid);
    if (endError) throw new Error(endError.message);
  }

  async function handleEndGame() {
    if (ending) return;
    if (!window.confirm("End this game for everyone now? Scores so far will be kept as the final results.")) return;
    setEnding(true);
    try {
      await endSession(sessionId);
      setError("");
      await Promise.all([loadTeams(sessionId), loadRoster(sessionId)]);
      setStage("final");
    } catch (e: any) {
      setError(e.message || "Could not end the game");
    } finally {
      setEnding(false);
    }
  }

  async function handleDiscardResumable(row: ResumableSession) {
    if (!window.confirm(`End the unfinished game (PIN ${row.pin}) for everyone?`)) return;
    try {
      await endSession(row.id);
      setResumable(null);
    } catch (e: any) {
      setError(e.message || "Could not end that game");
    }
  }

  // Starts question `index` via the server-stamped RPC, or ends the game
  // once past the last question.
  async function goToQuestion(index: number) {
    if (index >= totalQuestions) {
      await endSession(sessionId);
      await loadRoster(sessionId);
      await loadTeams(sessionId);
      setStage("final");
      return;
    }
    const { data: serverNow, error: startError } = await supabase.rpc("team_battle_start_question", {
      p_session_id: sessionId,
      p_question_index: index,
    });
    if (startError) throw new Error(startError.message);
    syncClock(serverNow as string | null);
    setRevealStats(null);
    await refreshSession(sessionId);
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
      const unsubscribeTeams = subscribeToTable(supabase, {
        table: "teams",
        filter: `session_id=eq.${sessionId}`,
        onChange: () => loadTeams(sessionId),
      });
      const unsubscribeSession = subscribeToTable(supabase, {
        table: "game_sessions",
        filter: `id=eq.${sessionId}`,
        onChange: () => syncLive(sessionId),
      });
      return () => {
        unsubscribeTeams();
        unsubscribeSession();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, stage]);

  // Host-side countdowns (question and reveal), derived from the same
  // server-anchored clocks the database checks. With auto-advance on, the
  // two effects below use them to ask the database to move on; the
  // database decides on its own clock, so a host clock that runs fast just
  // gets a refusal and retries.
  const questionClockRunning = stage === "live" && settings.timerEnabled && !paused && !revealing;
  const revealClockRunning = stage === "live" && settings.autoAdvance && revealing && !revealPaused;
  useEffect(() => {
    if (!questionClockRunning && !revealClockRunning) return;
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [questionClockRunning, revealClockRunning]);

  // Claims the right to make automatic request `key` now, at most once per
  // AUTO_RETRY_MS, so the 250ms tick doesn't send one per tick.
  function claimAutoRequest(key: string) {
    const last = autoRequestRef.current;
    const now = Date.now();
    if (last && last.key === key && now - last.at < AUTO_RETRY_MS) return false;
    autoRequestRef.current = { key, at: now };
    return true;
  }

  // Auto-reveal when time is up (plus the late-answer grace, which the
  // database also requires). "Everyone answered" is handled by the answer
  // route on the server, and arrives here through the session subscription.
  useEffect(() => {
    if (!questionClockRunning || !settings.autoAdvance || !timing?.questionStartedAt) return;
    if (advancing || skipping || pausing) return;
    if (secondsLeft(timing, nowMs + clockOffsetMs) > -LATE_ANSWER_GRACE_SECONDS) return;
    const index = currentQuestionIndex;
    if (!claimAutoRequest(`reveal:${index}`)) return;
    (async () => {
      const { data: serverNow, error: revealError } = await supabase.rpc("team_battle_reveal", {
        p_session_id: sessionId,
        p_question_index: index,
        p_reason: "time_up",
      });
      if (revealError) return;
      syncClock(serverNow as string | null);
      await syncLive(sessionId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, questionClockRunning]);

  // Auto-advance once the reveal countdown runs out.
  useEffect(() => {
    if (!revealClockRunning || !revealTiming?.revealStartedAt) return;
    if (advancing || pausing) return;
    if (revealSecondsLeft(revealTiming, nowMs + clockOffsetMs) > 0) return;
    const index = currentQuestionIndex;
    if (!claimAutoRequest(`advance:${index}`)) return;
    advanceFromReveal(index, false).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, revealClockRunning]);

  // Note Reading: the answer reveal plays the note on the host's speakers,
  // whether the teacher clicked "Show answer" or auto-advance revealed it.
  // Keyed by question so a refresh of the same reveal doesn't replay it.
  const playedRevealRef = useRef<number | null>(null);
  useEffect(() => {
    if (!revealing) return;
    if (playedRevealRef.current === currentQuestionIndex) return;
    playedRevealRef.current = currentQuestionIndex;
    const note = questions[currentQuestionIndex]?.note;
    if (isNoteSpec(note)) playNote(note);
  }, [revealing, currentQuestionIndex, questions]);

  // Leaves the reveal of question `fromIndex`: the next question, or Final
  // Results after the last one. skipCountdown = true for Next Question /
  // Next now; false for the auto-advance, which the database only allows
  // once the countdown is over and not paused.
  async function advanceFromReveal(fromIndex: number, skipCountdown: boolean) {
    const { data: serverNow, error: advanceError } = await supabase.rpc("team_battle_advance", {
      p_session_id: sessionId,
      p_from_index: fromIndex,
      p_skip_countdown: skipCountdown,
    });
    if (advanceError) throw new Error(advanceError.message);
    syncClock(serverNow as string | null);
    await syncLive(sessionId);
  }

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

      // Shared Note Reading game: fresh questions for this session only.
      const generated =
        game.generator === NOTE_READING_GENERATOR && config.noteReading
          ? (generateFromConfig(config.noteReading, config.timeLimitSeconds) as Question[])
          : null;

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
            autoAdvance: config.autoAdvance,
            revealSeconds: config.revealSeconds,
            // Labels this round's results on the leaderboard
            // (record_team_battle_results copies it to game_results.variant).
            ...(generated && config.noteReading
              ? { noteReading: config.noteReading, variant: noteReadingVariant(config.noteReading) }
              : {}),
          },
        })
        .select("id")
        .single();
      if (sessionError || !sessionRow) throw new Error(sessionError?.message || "Could not create session");

      if (generated) {
        const { error: questionsError } = await supabase
          .from("session_questions")
          .insert({ session_id: sessionRow.id, questions: generated });
        if (questionsError) throw new Error(questionsError.message);
        setSessionQuestions(generated);
      }

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
      setSettings({
        timerEnabled: config.timerEnabled,
        timeLimitSeconds: config.timeLimitSeconds,
        autoAdvance: config.autoAdvance,
        revealSeconds: config.revealSeconds,
      });
      await loadRoster(sessionRow.id);
      setStage("waiting");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setStarting(false);
    }
  }

  async function handleStartGame() {
    if (advancing) return;
    unlockNoteAudio();
    setAdvancing(true);
    try {
      await goToQuestion(0);
      setError("");
      await loadTeams(sessionId);
      setStage("live");
    } catch (e: any) {
      setError(e.message || "Could not start the game");
    } finally {
      setAdvancing(false);
    }
  }

  // Closes answering for the current question and shows everyone the
  // correct option, before the teacher moves on.
  async function handleReveal() {
    if (advancing || skipping || revealing) return;
    setAdvancing(true);
    try {
      const { data: serverNow, error: revealError } = await supabase.rpc("team_battle_reveal", {
        p_session_id: sessionId,
        p_question_index: currentQuestionIndex,
        p_reason: "manual",
      });
      if (revealError) throw new Error(revealError.message);
      setError("");
      syncClock(serverNow as string | null);
      await syncLive(sessionId);
    } catch (e: any) {
      setError(e.message || "Could not show the answer");
    } finally {
      setAdvancing(false);
    }
  }

  async function handleNextQuestion() {
    // Guards against a double-click (or anything else firing this twice in
    // quick succession) racing on currentQuestionIndex before the first
    // call's state update lands — without it, two rapid calls both read the
    // same stale index and only one increment actually sticks. The
    // database also only moves on from the reveal of this exact index, so
    // even a second tab can't skip a question. Allowed while the reveal
    // countdown is paused ("Next now").
    if (advancing || skipping || !revealing) return;
    setAdvancing(true);
    try {
      await advanceFromReveal(currentQuestionIndex, true);
      setError("");
    } catch (e: any) {
      setError(e.message || "Could not move to the next question");
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
      await goToQuestion(currentQuestionIndex + 1);
    } catch (e: any) {
      setError(e.message || "Could not skip this question");
    } finally {
      setSkipping(false);
    }
  }

  // Adds extra time to the current question. Just a number going up on the
  // session row, so it works the same whether the question is running or
  // paused; every device's countdown (and the answer route's grading)
  // derives from that row, so it applies everywhere at once.
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
      await refreshSession(sessionId);
    } finally {
      setAddingTime(false);
    }
  }

  // Toggles the round between "question" and "paused" via
  // team_battle_set_paused, which stamps the pause with the database clock
  // and, on resume, adds the paused stretch to paused_seconds — so the
  // server-anchored countdown on every device freezes and resumes in step,
  // and paused time never counts against anyone's speed bonus. During an
  // auto-advance reveal the same call pauses the reveal countdown instead.
  async function togglePause() {
    if (pausing || skipping || advancing) return;
    if (revealing && !settings.autoAdvance) return;
    setPausing(true);
    try {
      const { data: serverNow, error: pauseError } = await supabase.rpc("team_battle_set_paused", {
        p_session_id: sessionId,
        p_paused: revealing ? !revealPaused : !paused,
      });
      // Only flip the host's own local state once the write actually
      // lands — otherwise a failed update (e.g. a network blip) would show
      // "Game Paused" here while every student's screen stays live.
      if (pauseError) {
        setError(pauseError.message || "Could not update the game's pause state");
      } else {
        setError("");
        syncClock(serverNow as string | null);
        await refreshSession(sessionId);
      }
    } finally {
      setPausing(false);
    }
  }

  const secondaryButtonStyle: React.CSSProperties = {
    fontSize: "0.85rem",
    fontWeight: 700,
    padding: "0.5rem 1rem",
    borderRadius: radius.pill,
    border: `1px solid ${colors.rosterCardShadow}`,
    background: colors.white,
    color: colors.textPrimary,
    cursor: "pointer",
  };

  if (stage === "setup") {
    return (
      <>
        {error && <p style={{ color: colors.coralText, fontWeight: 700 }}>{error}</p>}
        {resumable && (
          <div
            role="status"
            style={{
              width: "100%",
              maxWidth: "560px",
              background: colors.blueBackground,
              color: colors.blueText,
              borderRadius: radius.card,
              boxShadow: solidShadow(4, colors.gamesCardShadow),
              padding: "1rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              textAlign: "left",
            }}
          >
            <span style={{ fontWeight: 800 }}>
              You have an unfinished Team Battle for this game (PIN {resumable.pin}
              {resumable.status === "lobby" ? ", still in the lobby" : `, question ${resumable.current_question_index + 1}`}).
            </span>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                onClick={() => handleResume(resumable)}
                style={{
                  ...secondaryButtonStyle,
                  border: "none",
                  background: colors.greenButton,
                  boxShadow: solidShadow(3, colors.greenButtonShadow),
                  color: colors.white,
                  fontWeight: 800,
                }}
              >
                Resume game
              </button>
              <button onClick={() => handleDiscardResumable(resumable)} style={secondaryButtonStyle}>
                End it
              </button>
            </div>
          </div>
        )}
        <TeamSetup
          onStart={handleStart}
          starting={starting}
          noteReading={game.generator === NOTE_READING_GENERATOR}
        />
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
        {error && <p style={{ color: colors.coralText, fontWeight: 700, margin: 0 }}>{error}</p>}
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
          disabled={advancing}
          style={{
            fontSize: "1.1rem",
            fontWeight: 800,
            padding: "0.85rem 2rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.greenButton,
            boxShadow: solidShadow(5, colors.greenButtonShadow),
            color: colors.white,
            cursor: advancing ? "default" : "pointer",
            opacity: advancing ? 0.6 : 1,
          }}
        >
          Start Game
        </button>
        <button onClick={handleEndGame} disabled={ending} style={secondaryButtonStyle}>
          End game
        </button>
      </div>
    );
  }

  if (stage === "live") {
    const question = questions[currentQuestionIndex];
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
            {settings.timerEnabled && !revealing && (
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
                {timeLeft > 0 ? `${timeLeft}s` : "Time's up"}
              </span>
            )}
            {settings.timerEnabled && !revealing && (
              <button
                onClick={() => handleAddTime(15)}
                disabled={addingTime || skipping}
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  padding: "0.4rem 0.7rem",
                  borderRadius: radius.pill,
                  border: "none",
                  background: colors.white,
                  boxShadow: solidShadow(3, colors.gamesCardShadow),
                  color: colors.textPrimary,
                  cursor: addingTime || skipping ? "default" : "pointer",
                  opacity: addingTime || skipping ? 0.6 : 1,
                }}
              >
                +15s
              </button>
            )}
            {revealing && settings.autoAdvance && (
              <span
                role="timer"
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  background: colors.white,
                  color: colors.textPrimary,
                  padding: "0.35rem 0.7rem",
                  borderRadius: radius.pill,
                }}
              >
                {revealPaused
                  ? "Countdown paused"
                  : currentQuestionIndex + 1 >= totalQuestions
                    ? `Results in ${revealLeft}s`
                    : `Next in ${revealLeft}s`}
              </span>
            )}
            {(!revealing || settings.autoAdvance) && (
              <button
                onClick={togglePause}
                disabled={pausing || skipping}
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  padding: "0.4rem 0.9rem",
                  borderRadius: radius.pill,
                  border: "none",
                  background: colors.white,
                  boxShadow: solidShadow(3, colors.gamesCardShadow),
                  color: colors.textPrimary,
                  cursor: pausing || skipping ? "default" : "pointer",
                  opacity: pausing || skipping ? 0.6 : 1,
                }}
              >
                {(revealing ? revealPaused : paused) ? "▶ Resume" : "⏸ Pause"}
              </button>
            )}
            {/* Danger-styled (matches the "Delete" button convention in
                app/games/teacher/library/page.tsx) since it's the one
                control here that discards data — everyone's answers and
                points for the current question. */}
            {!revealing && (
              <button
                onClick={handleSkipQuestion}
                disabled={advancing || skipping}
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  padding: "0.4rem 0.9rem",
                  borderRadius: radius.pill,
                  border: "none",
                  background: colors.coralText,
                  color: colors.white,
                  cursor: advancing || skipping ? "default" : "pointer",
                  opacity: advancing || skipping ? 0.6 : 1,
                }}
              >
                ⏭ Skip
              </button>
            )}
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
                {question.mediaType === "note" && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <NoteStaff note={question.note} maxWidth={460} />
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                {question.options.map((opt, i) => (
                  <div
                    key={i}
                    style={{
                      opacity: revealing && i !== question.correctIndex ? 0.35 : 1,
                      outline: revealing && i === question.correctIndex ? `4px solid ${colors.textPrimary}` : "none",
                      outlineOffset: "3px",
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
                    {revealing && (
                      <span style={{ fontSize: "0.85rem" }}>
                        {i === question.correctIndex ? "✓ " : ""}
                        {revealStats ? revealStats.perOption[i] : "…"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {revealing && revealStats && (
                <p style={{ fontWeight: 700, margin: "0.75rem 0 0", textAlign: "center" }}>
                  {revealStats.correct} of {revealStats.answered} answered correctly
                </p>
              )}
            </>
          )}
        </div>

        <TeamLeaderboard teams={teams} />
        <button
          onClick={revealing ? handleNextQuestion : handleReveal}
          disabled={advancing || skipping}
          style={{
            fontSize: "1rem",
            fontWeight: 800,
            padding: "0.75rem 1.5rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.greenButton,
            boxShadow: solidShadow(4, colors.greenButtonShadow),
            color: colors.white,
            cursor: advancing || skipping ? "default" : "pointer",
            opacity: advancing || skipping ? 0.6 : 1,
          }}
        >
          {!revealing
            ? "Show Answer"
            : currentQuestionIndex + 1 >= totalQuestions
              ? settings.autoAdvance
                ? "See Final Results now"
                : "See Final Results"
              : settings.autoAdvance
                ? "Next now"
                : "Next Question"}
        </button>
        <button onClick={handleEndGame} disabled={ending} style={{ ...secondaryButtonStyle, alignSelf: "center" }}>
          End game now
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
