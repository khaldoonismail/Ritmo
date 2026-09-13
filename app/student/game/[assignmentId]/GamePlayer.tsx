"use client";

import { useState } from "react";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";

type MediaType = "text" | "image" | "video" | "audio";

interface Question {
  id: string;
  mediaType: MediaType;
  prompt: string;
  mediaContent: string;
  options: string[];
  correctIndex: number;
}

const answerColors = ["#e21b3c", "#1368ce", "#d89e00", "#2ca30f"];
const answerShadowColors = ["#a8112c", "#0d4a8f", "#a67800", "#1f7a0b"];
const answerShapes = ["▲", "◆", "●", "■"];
const stageBg = "#1b6b0a";
const cardShadowOnGreen = "#124e07";

// Self-paced, single-player take on a game-based assignment — deliberately
// simpler than the teacher's live-demo player at games/play/[id]/page.tsx
// (no lobby/PIN/bots/timer), since the point here is auto-graded
// submission, not hosting a round. Every answer is recorded locally and
// sent to /api/student/submit-game only once, after the last question.
export default function GamePlayer({
  assignmentId,
  title,
  questions,
  alreadyCompleted,
  savedScore,
}: {
  assignmentId: string;
  title: string;
  questions: Question[];
  alreadyCompleted: boolean;
  savedScore: number | null;
}) {
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: string; selectedIndex: number | null }[]>(
    []
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<{ score: number; correctCount: number; total: number } | null>(
    null
  );

  const q = questions[currentIndex];

  async function submitAnswers(finalAnswers: { questionId: string; selectedIndex: number | null }[]) {
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/student/submit-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, answers: finalAnswers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Could not submit your answers.");
        setSubmitting(false);
        return;
      }
      setResult(data);
    } catch {
      setSubmitError("Could not submit your answers. Check your connection and try again.");
    }
    setSubmitting(false);
  }

  function handleAnswer(i: number) {
    if (locked) return;
    setLocked(true);
    setSelected(i);

    const nextAnswers = [...answers, { questionId: q.id, selectedIndex: i }];
    setAnswers(nextAnswers);

    setTimeout(() => {
      const next = currentIndex + 1;
      if (next >= questions.length) {
        submitAnswers(nextAnswers);
        return;
      }
      setCurrentIndex(next);
      setSelected(null);
      setLocked(false);
    }, 1200);
  }

  const outerStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1.25rem",
    textAlign: "center",
    padding: "2rem",
  };

  if (alreadyCompleted && !result) {
    return (
      <main style={{ ...outerStyle, background: colors.background, color: colors.textPrimary }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>Already completed</h1>
        {savedScore !== null && (
          <p style={{ fontSize: "1.2rem", fontWeight: 700 }}>Your score: {savedScore} pts</p>
        )}
        <Link href="/student/dashboard" style={{ color: "inherit", textDecoration: "underline", fontWeight: 700 }}>
          ← Back to Dashboard
        </Link>
      </main>
    );
  }

  if (result) {
    return (
      <main style={{ ...outerStyle, background: colors.background, color: colors.textPrimary }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>Nice work!</h1>
        <p style={{ fontSize: "1.3rem", fontWeight: 700 }}>
          {result.correctCount} / {result.total} correct
        </p>
        <div
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            padding: "0.6rem 1.5rem",
            borderRadius: radius.pill,
            background: colors.greenCard,
            boxShadow: solidShadow(4, colors.greenCardShadow),
            color: colors.white,
          }}
        >
          {result.score} pts
        </div>
        <Link href="/student/dashboard" style={{ color: "inherit", textDecoration: "underline", fontWeight: 700 }}>
          ← Back to Dashboard
        </Link>
      </main>
    );
  }

  if (!started) {
    return (
      <main style={{ ...outerStyle, background: colors.background, color: colors.textPrimary }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "20px",
            background: colors.orange,
            boxShadow: solidShadow(6, colors.orangeShadow),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: "2rem", color: colors.white, lineHeight: 1 }}>♪</span>
        </div>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>{title}</h1>
        <p style={{ opacity: 0.7, fontWeight: 600, maxWidth: "380px", margin: 0 }}>
          {questions.length} question{questions.length === 1 ? "" : "s"} · answer at your own
          pace, then get your score right away.
        </p>
        <button
          onClick={() => setStarted(true)}
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
          Start
        </button>
        <Link
          href="/student/dashboard"
          style={{ fontSize: "0.85rem", fontWeight: 700, opacity: 0.6, color: "inherit", textDecoration: "underline" }}
        >
          ← Back to Dashboard
        </Link>
      </main>
    );
  }

  if (submitting) {
    return (
      <main style={{ ...outerStyle, background: stageBg, color: colors.white }}>
        <p style={{ fontWeight: 700 }}>Submitting your answers...</p>
      </main>
    );
  }

  return (
    <main style={{ ...outerStyle, backgroundColor: stageBg, color: colors.white }}>
      {submitError && (
        <p style={{ color: "#ffb3b3", fontWeight: 700, fontSize: "0.9rem" }}>{submitError}</p>
      )}
      <div style={{ width: "100%", maxWidth: "800px" }}>
        <div style={{ marginBottom: "1rem", fontWeight: 700, opacity: 0.85 }}>
          Question {currentIndex + 1} / {questions.length}
        </div>

        <div
          style={{
            background: colors.white,
            color: colors.textPrimary,
            borderRadius: radius.card,
            boxShadow: solidShadow(5, cardShadowOnGreen),
            padding: "1.5rem",
            marginBottom: "1.25rem",
          }}
        >
          <p style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 0.75rem" }}>{q.prompt || "Question"}</p>
          {q.mediaType === "text" && q.mediaContent && (
            <p style={{ fontSize: "1.1rem", lineHeight: 1.5 }}>{q.mediaContent}</p>
          )}
          {q.mediaType === "image" && q.mediaContent && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.mediaContent} alt="" style={{ maxWidth: "100%", maxHeight: "260px", borderRadius: "8px" }} />
          )}
          {q.mediaType === "video" && q.mediaContent && (
            <video src={q.mediaContent} controls autoPlay style={{ maxWidth: "100%", maxHeight: "260px", borderRadius: "8px" }} />
          )}
          {q.mediaType === "audio" && q.mediaContent && (
            <audio src={q.mediaContent} controls autoPlay style={{ width: "100%" }} />
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          {q.options.map((opt, i) => {
            const showFeedback = selected !== null;
            const isCorrectTile = i === q.correctIndex;
            const isWrongPick = showFeedback && selected === i && !isCorrectTile;
            const highlight = showFeedback && (isCorrectTile || isWrongPick);
            const dim = showFeedback && !isCorrectTile && !isWrongPick;
            return (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={locked}
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  padding: "1.1rem",
                  borderRadius: radius.button,
                  border: highlight ? `4px solid ${isCorrectTile ? "#1fbf4d" : "#ff3b3b"}` : "none",
                  background: answerColors[i],
                  boxShadow: dim ? "none" : solidShadow(4, answerShadowColors[i]),
                  color: colors.white,
                  cursor: locked ? "default" : "pointer",
                  opacity: dim ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  textAlign: "left",
                  transition: "opacity 150ms ease, border-color 150ms ease",
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>{answerShapes[i]}</span>
                <span style={{ flex: 1 }}>{opt || `Answer ${i + 1}`}</span>
                {showFeedback && isCorrectTile && <span style={{ fontSize: "1.2rem" }}>✓</span>}
                {isWrongPick && <span style={{ fontSize: "1.2rem" }}>✕</span>}
              </button>
            );
          })}
        </div>
      </div>
    </main>
  );
}
