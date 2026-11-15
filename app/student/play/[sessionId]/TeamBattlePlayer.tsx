"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { subscribeToTable } from "@/lib/supabase/realtime";
import { colors, radius, solidShadow } from "@/lib/theme";
import TeamLeaderboard, { LeaderboardTeam } from "@/components/TeamLeaderboard";
import {
  DEFAULT_REVEAL_SECONDS,
  displaySecondsLeft,
  revealSecondsLeft,
  revealTimingFromSessionRow,
  secondsLeft,
  timingFromSessionRow,
} from "@/lib/teamBattleTiming";

// Small local copies of page.tsx's Kahoot-style answer-tile constants — kept
// separate rather than shared, so the existing single-device Play Demo file
// stays untouched (see the plan's decision on lib/scoring.ts for the same
// reasoning).
const answerColors = ["#e21b3c", "#1368ce", "#d89e00", "#2ca30f"];
const answerShadowColors = ["#a8112c", "#0d4a8f", "#a67800", "#1f7a0b"];
const answerShapes = ["▲", "◆", "●", "■"];
const stageBg = "#1b6b0a";

type SessionStatus = "lobby" | "question" | "paused" | "reveal" | "leaderboard" | "final";

interface QuestionPayload {
  id: string;
  mediaType: string;
  prompt: string;
  mediaContent: string;
  imageContent?: string;
  options: string[];
}

interface RevealPayload {
  correctIndex: number;
  myAnswer: { selectedIndex: number | null; correct: boolean; points: number } | null;
}

interface SessionRow {
  status: SessionStatus;
  current_question_index: number;
  time_extension_seconds: number;
  question_started_at: string | null;
  paused_at: string | null;
  paused_seconds: number | string;
  reveal_started_at?: string | null;
  reveal_paused_seconds?: number | string;
}

interface PlayerSettings {
  timerEnabled?: boolean;
  timeLimitSeconds?: number;
  autoAdvance?: boolean;
  revealSeconds?: number;
}

interface FinalTeam extends LeaderboardTeam {
  topScorer: { name: string; score: number } | null;
}

export default function TeamBattlePlayer({ sessionId }: { sessionId: string }) {
  const [sessionRow, setSessionRow] = useState<SessionRow | null>(null);
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [settings, setSettings] = useState<PlayerSettings>({});
  const [teams, setTeams] = useState<LeaderboardTeam[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  // Starts locked so the timeout effect can't fire before the current
  // question (and its timer settings) has actually loaded.
  const [locked, setLocked] = useState(true);
  // Server time minus this device's time, from the question route's
  // serverNow — so the countdown matches the clock the server grades by.
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [finalResults, setFinalResults] = useState<FinalTeam[]>([]);

  const answeredIndexRef = useRef<number | null>(null);
  const fetchedIndexRef = useRef<number | null>(null);
  const supabaseRef = useRef(createBrowserSupabaseClient());

  const status: SessionStatus = sessionRow?.status ?? "lobby";
  const questionIndex = sessionRow ? sessionRow.current_question_index : null;
  const timing = sessionRow ? timingFromSessionRow(sessionRow, settings.timeLimitSeconds || 20) : null;
  const timeLeft = timing ? displaySecondsLeft(timing, nowMs + clockOffsetMs) : 0;
  // Reveal countdown before the next question (0026_auto_advance.sql).
  const revealTiming =
    sessionRow && sessionRow.status === "reveal" && settings.autoAdvance && sessionRow.reveal_started_at
      ? revealTimingFromSessionRow(sessionRow, settings.revealSeconds ?? DEFAULT_REVEAL_SECONDS)
      : null;
  const revealLeft = revealTiming
    ? Math.min(revealTiming.revealSeconds, Math.max(0, Math.ceil(revealSecondsLeft(revealTiming, nowMs + clockOffsetMs))))
    : 0;

  async function loadTeams() {
    const { data } = await supabaseRef.current
      .from("teams")
      .select("id, name, color, score")
      .eq("session_id", sessionId);
    setTeams(data || []);
  }

  async function loadSessionState() {
    const { data } = await supabaseRef.current
      .from("game_sessions")
      .select(
        "status, current_question_index, time_extension_seconds, question_started_at, paused_at, paused_seconds, reveal_started_at, reveal_paused_seconds"
      )
      .eq("id", sessionId)
      .maybeSingle();
    if (data) setSessionRow(data as SessionRow);
  }

  useEffect(() => {
    loadSessionState();
    loadTeams();
    const supabase = supabaseRef.current;
    const unsubSession = subscribeToTable(supabase, {
      table: "game_sessions",
      filter: `id=eq.${sessionId}`,
      onChange: loadSessionState,
    });
    const unsubTeams = subscribeToTable(supabase, {
      table: "teams",
      filter: `session_id=eq.${sessionId}`,
      onChange: loadTeams,
    });
    return () => {
      unsubSession();
      unsubTeams();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    // Fetches each question once — a pause/resume for the same index needs
    // no refetch, since the countdown is derived from the session row
    // rather than kept locally. The one exception is the switch to
    // "reveal", which refetches to get the correct answer and this
    // student's own result.
    if ((status !== "question" && status !== "paused" && status !== "reveal") || questionIndex === null) return;
    const isNewIndex = fetchedIndexRef.current !== questionIndex;
    if (!isNewIndex && status !== "reveal") return;
    fetchedIndexRef.current = questionIndex;
    if (isNewIndex) {
      setSelected(null);
      setReveal(null);
      setLocked(true);
    }
    const alreadyAnswered = answeredIndexRef.current === questionIndex;
    fetch(`/api/student/session/${sessionId}/question`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.question || data.questionIndex !== questionIndex) return;
        setQuestion(data.question);
        setSettings(data.settings || {});
        if (data.serverNow) setClockOffsetMs(Date.parse(data.serverNow) - Date.now());
        setReveal(data.reveal ?? null);
        if (data.reveal?.myAnswer) setSelected(data.reveal.myAnswer.selectedIndex);
        setLocked(alreadyAnswered || !!data.reveal);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, questionIndex]);

  useEffect(() => {
    if (status === "final") {
      fetch(`/api/student/session/${sessionId}/results`)
        .then((r) => r.json())
        .then((data) => setFinalResults(data.teams || []));
    }
  }, [status, sessionId]);

  // Re-renders the countdown a few times a second while a question is live,
  // or while the reveal counts down to the next question.
  const revealCounting = !!revealTiming && !revealTiming.pausedAt;
  useEffect(() => {
    if (!(status === "question" && settings.timerEnabled) && !revealCounting) return;
    const id = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(id);
  }, [status, settings.timerEnabled, revealCounting]);

  // Submits a blank answer once the server-anchored clock runs out.
  useEffect(() => {
    if (status !== "question" || !settings.timerEnabled || locked || !timing?.questionStartedAt) return;
    if (secondsLeft(timing, nowMs + clockOffsetMs) <= 0) handleTimeout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, nowMs, settings.timerEnabled, locked]);

  async function submitAnswer(selectedIndex: number | null) {
    if (questionIndex === null) return;
    answeredIndexRef.current = questionIndex;
    await fetch(`/api/student/session/${sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // timeLeftSeconds is only used for sessions started before the
      // server-anchored clock existed; the server ignores it otherwise.
      body: JSON.stringify({ questionIndex, selectedIndex, timeLeftSeconds: timeLeft }),
    });
  }

  function handleAnswer(i: number) {
    if (locked || status !== "question") return;
    setLocked(true);
    setSelected(i);
    submitAnswer(i);
  }

  function handleTimeout() {
    if (locked) return;
    setLocked(true);
    submitAnswer(null);
  }

  if (status === "lobby") {
    return (
      <main style={mainStyle(colors.background, colors.textPrimary)}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>Waiting for your teacher…</h1>
        <p style={{ opacity: 0.7, fontWeight: 600 }}>The game will start any moment.</p>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          <TeamLeaderboard teams={teams} />
        </div>
      </main>
    );
  }

  if (status === "final") {
    return (
      <main style={mainStyle(stageBg, colors.white)}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 1rem" }}>Final Results</h1>
        <div style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <TeamLeaderboard teams={finalResults} />
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {finalResults.map(
              (t) =>
                t.topScorer && (
                  <p key={t.id} style={{ margin: 0, fontSize: "0.9rem", opacity: 0.85 }}>
                    🏆 {t.name} top scorer: {t.topScorer.name} ({t.topScorer.score} pts)
                  </p>
                )
            )}
          </div>
        </div>
      </main>
    );
  }

  // status === "question", "paused" or "reveal" (the "leaderboard"
  // interstitial is never set by the host)
  const paused = status === "paused";
  const revealing = status === "reveal" && reveal !== null;
  return (
    <main style={mainStyle(stageBg, colors.white)}>
      <div style={{ width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {paused && (
          <div
            style={{
              background: "rgba(255,255,255,0.15)",
              borderRadius: radius.card,
              padding: "0.75rem 1rem",
              fontWeight: 800,
            }}
          >
            ⏸ Game Paused — waiting for teacher
          </div>
        )}

        {revealing && (
          <div
            style={{
              background: "rgba(255,255,255,0.15)",
              borderRadius: radius.card,
              padding: "0.75rem 1rem",
              fontWeight: 800,
              fontSize: "1.2rem",
            }}
          >
            {reveal.myAnswer === null
              ? "⏰ No answer this time"
              : reveal.myAnswer.correct
                ? `✅ Correct! +${reveal.myAnswer.points} pts`
                : "❌ Not quite"}
          </div>
        )}

        {settings.timerEnabled && !locked && !paused && !revealing && (
          <span
            style={{
              alignSelf: "center",
              fontSize: "1.3rem",
              fontWeight: 800,
              direction: "ltr",
              background: colors.white,
              color: stageBg,
              padding: "0.25rem 1rem",
              borderRadius: radius.pill,
            }}
          >
            {timeLeft}s
          </span>
        )}

        {question && (
          <div
            style={{
              background: colors.white,
              color: colors.textPrimary,
              borderRadius: radius.card,
              padding: "1.25rem",
            }}
          >
            <p style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>{question.prompt || "Question"}</p>
            {question.mediaType === "audio" && question.mediaContent && (
              <audio src={question.mediaContent} controls autoPlay style={{ width: "100%", marginTop: "0.75rem" }} />
            )}
            {question.imageContent && (
              <img
                src={question.imageContent}
                alt=""
                style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "8px", marginTop: "0.75rem" }}
              />
            )}
          </div>
        )}

        {question && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            {question.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={locked || paused || revealing}
                style={{
                  fontSize: "1rem",
                  fontWeight: 800,
                  padding: "1rem",
                  borderRadius: radius.button,
                  border: selected === i ? `4px solid ${colors.white}` : "none",
                  outline: revealing && reveal.correctIndex === i ? `4px solid ${colors.white}` : "none",
                  outlineOffset: "3px",
                  background: answerColors[i],
                  boxShadow: solidShadow(4, answerShadowColors[i]),
                  color: colors.white,
                  cursor: locked || paused || revealing ? "default" : "pointer",
                  opacity: revealing
                    ? reveal.correctIndex === i
                      ? 1
                      : 0.35
                    : (locked && selected !== i) || paused
                      ? 0.5
                      : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  textAlign: "left",
                }}
              >
                <span>{answerShapes[i]}</span>
                <span style={{ flex: 1 }}>{opt}</span>
                {revealing && reveal.correctIndex === i && <span aria-label="Correct answer">✓</span>}
              </button>
            ))}
          </div>
        )}

        {revealing ? (
          <p style={{ textAlign: "center", fontWeight: 700 }}>
            {!revealTiming
              ? "Waiting for the next question…"
              : revealTiming.pausedAt
                ? "⏸ Paused by your teacher"
                : `Next up in ${revealLeft}s…`}
          </p>
        ) : (
          locked &&
          question && <p style={{ textAlign: "center", fontWeight: 700 }}>Answer submitted — waiting for the next question…</p>
        )}

        <TeamLeaderboard teams={teams} />
      </div>
    </main>
  );
}

function mainStyle(background: string, color: string): CSSProperties {
  return {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    textAlign: "center",
    padding: "2rem",
    background,
    color,
  };
}
