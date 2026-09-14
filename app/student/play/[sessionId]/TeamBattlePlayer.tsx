"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { subscribeToTable } from "@/lib/supabase/realtime";
import { colors, radius, solidShadow } from "@/lib/theme";
import TeamLeaderboard, { LeaderboardTeam } from "@/components/TeamLeaderboard";

// Small local copies of page.tsx's Kahoot-style answer-tile constants — kept
// separate rather than shared, so the existing single-device Play Demo file
// stays untouched (see the plan's decision on lib/scoring.ts for the same
// reasoning).
const answerColors = ["#e21b3c", "#1368ce", "#d89e00", "#2ca30f"];
const answerShadowColors = ["#a8112c", "#0d4a8f", "#a67800", "#1f7a0b"];
const answerShapes = ["▲", "◆", "●", "■"];
const stageBg = "#1b6b0a";

type SessionStatus = "lobby" | "question" | "reveal" | "leaderboard" | "final";

interface QuestionPayload {
  id: string;
  mediaType: string;
  prompt: string;
  mediaContent: string;
  imageContent?: string;
  options: string[];
}

interface FinalTeam extends LeaderboardTeam {
  topScorer: { name: string; score: number } | null;
}

export default function TeamBattlePlayer({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<SessionStatus>("lobby");
  const [questionIndex, setQuestionIndex] = useState<number | null>(null);
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [settings, setSettings] = useState<{ timerEnabled?: boolean; timeLimitSeconds?: number }>({});
  const [teams, setTeams] = useState<LeaderboardTeam[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  // Starts locked so the timeout effect can't fire on a stale timeLeft=0
  // before the freshly-fetched question's real timer value lands (see the
  // question-fetch effect below, which unlocks only once that value is set).
  const [locked, setLocked] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [finalResults, setFinalResults] = useState<FinalTeam[]>([]);

  const answeredIndexRef = useRef<number | null>(null);
  const supabaseRef = useRef(createBrowserSupabaseClient());

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
      .select("status, current_question_index")
      .eq("id", sessionId)
      .maybeSingle();
    if (data) {
      setStatus(data.status);
      setQuestionIndex(data.current_question_index);
    }
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
    if (status !== "question" || questionIndex === null) return;
    const alreadyAnswered = answeredIndexRef.current === questionIndex;
    setSelected(null);
    fetch(`/api/student/session/${sessionId}/question`)
      .then((r) => r.json())
      .then((data) => {
        if (data.question) {
          setQuestion(data.question);
          setSettings(data.settings || {});
          if (!alreadyAnswered) {
            setTimeLeft(data.settings?.timerEnabled ? data.settings.timeLimitSeconds || 20 : 0);
          }
          // Unlock only once timeLeft carries its real value (or locked
          // stays true for an already-answered question) — batched with the
          // timeLeft update above so the timer effect never sees a stale 0.
          setLocked(alreadyAnswered);
        }
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

  useEffect(() => {
    if (status !== "question" || !settings.timerEnabled || locked) return;
    if (timeLeft <= 0) {
      handleTimeout();
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, timeLeft, settings.timerEnabled, locked]);

  async function submitAnswer(selectedIndex: number | null) {
    if (questionIndex === null) return;
    answeredIndexRef.current = questionIndex;
    await fetch(`/api/student/session/${sessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIndex, selectedIndex, timeLeftSeconds: timeLeft }),
    });
  }

  function handleAnswer(i: number) {
    if (locked) return;
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

  // status === "question" (or the unused reveal/leaderboard interstitials,
  // which the host never sets — see TeamBattleHost.handleNextQuestion)
  return (
    <main style={mainStyle(stageBg, colors.white)}>
      <div style={{ width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "1rem" }}>
        {settings.timerEnabled && !locked && (
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
                disabled={locked}
                style={{
                  fontSize: "1rem",
                  fontWeight: 800,
                  padding: "1rem",
                  borderRadius: radius.button,
                  border: selected === i ? `4px solid ${colors.white}` : "none",
                  background: answerColors[i],
                  boxShadow: solidShadow(4, answerShadowColors[i]),
                  color: colors.white,
                  cursor: locked ? "default" : "pointer",
                  opacity: locked && selected !== i ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  textAlign: "left",
                }}
              >
                <span>{answerShapes[i]}</span>
                <span style={{ flex: 1 }}>{opt}</span>
              </button>
            ))}
          </div>
        )}

        {locked && <p style={{ textAlign: "center", fontWeight: 700 }}>Answer submitted — waiting for the next question…</p>}

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
