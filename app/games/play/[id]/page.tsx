"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type MediaType = "text" | "image" | "video" | "audio";

interface Question {
  id: string;
  mediaType: MediaType;
  prompt: string;
  mediaContent: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
}

interface Game {
  id: string;
  title: string;
  questions: Question[];
  createdAt: number;
}

interface Player {
  name: string;
  score: number;
}

const STORAGE_KEY = "ritmo_games";

const answerColors = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];
const answerShapes = ["▲", "◆", "●", "■"];

type Stage = "loading" | "notfound" | "lobby" | "question" | "reveal" | "leaderboard" | "final";

export default function PlayGamePage() {
  const params = useParams();
  const id = params?.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [pin] = useState(() => Math.floor(100000 + Math.random() * 900000));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [answerCounts, setAnswerCounts] = useState([0, 0, 0, 0]);
  const [roundGain, setRoundGain] = useState(0);
  const [players, setPlayers] = useState<Player[]>([
    { name: "You", score: 0 },
    { name: "RhythmRex", score: 0 },
    { name: "MelodyMax", score: 0 },
    { name: "BeatBella", score: 0 },
  ]);

  const timeLeftRef = useRef(0);
  timeLeftRef.current = timeLeft;
  const roundEndedRef = useRef(false);

  useEffect(() => {
    const games: Game[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const found = games.find((g) => g.id === id) || null;
    setGame(found);
    setStage(found ? "lobby" : "notfound");
  }, [id]);

  useEffect(() => {
    if (stage !== "question") return;
    if (timeLeft <= 0) {
      finishQuestion(null);
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, timeLeft]);

  function startGame() {
    if (!game) return;
    roundEndedRef.current = false;
    setCurrentIndex(0);
    setTimeLeft(game.questions[0].timeLimit);
    setSelected(null);
    setLocked(false);
    setStage("question");
  }

  function handleAnswer(i: number) {
    if (locked) return;
    setLocked(true);
    setSelected(i);
    setTimeout(() => finishQuestion(i), 600);
  }

  function finishQuestion(chosen: number | null) {
    if (!game || roundEndedRef.current) return;
    roundEndedRef.current = true;
    const q = game.questions[currentIndex];
    const timeUsed = timeLeftRef.current;
    const correct = chosen !== null && chosen === q.correctIndex;
    const playerPoints = correct
      ? Math.round(500 + 500 * (timeUsed / q.timeLimit))
      : 0;

    const counts = [0, 0, 0, 0];
    if (chosen !== null) counts[chosen]++;

    setPlayers((prev) =>
      prev.map((p, idx) => {
        if (idx === 0) return { ...p, score: p.score + playerPoints };
        const botCorrect = Math.random() < 0.65;
        const botChoice = botCorrect
          ? q.correctIndex
          : Math.floor(Math.random() * q.options.length);
        counts[botChoice]++;
        const gain = botCorrect ? 300 + Math.floor(Math.random() * 650) : 0;
        return { ...p, score: p.score + gain };
      })
    );

    setAnswerCounts(counts);
    setRoundGain(playerPoints);
    setLocked(false);
    setStage("reveal");
  }

  function nextQuestion() {
    if (!game) return;
    const next = currentIndex + 1;
    if (next >= game.questions.length) {
      setStage("final");
      return;
    }
    roundEndedRef.current = false;
    setCurrentIndex(next);
    setTimeLeft(game.questions[next].timeLimit);
    setSelected(null);
    setLocked(false);
    setStage("question");
  }

  if (stage === "loading") {
    return <main style={{ minHeight: "100vh" }} />;
  }

  if (stage === "notfound") {
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
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>
          Game not found
        </h1>
        <Link
          href="/games/teacher/library"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          ← Back to My Games
        </Link>
      </main>
    );
  }

  const q = game!.questions[currentIndex];
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        textAlign: "center",
        padding: "2rem",
        background: "#26890c",
        color: "#fff",
      }}
    >
      {stage === "lobby" && (
        <>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: 0 }}>
            {game!.title}
          </h1>
          <p style={{ fontSize: "1.1rem", opacity: 0.85 }}>Game PIN</p>
          <div
            style={{
              fontSize: "3rem",
              fontWeight: 800,
              letterSpacing: "0.1em",
              direction: "ltr",
              background: "rgba(255,255,255,0.15)",
              padding: "0.5rem 1.5rem",
              borderRadius: "12px",
            }}
          >
            {pin}
          </div>
          <p style={{ opacity: 0.8, maxWidth: "420px" }}>
            {game!.questions.length} question
            {game!.questions.length === 1 ? "" : "s"} · This is a single-device
            demo — you'll play alongside 3 simulated players.
          </p>
          <button
            onClick={startGame}
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              padding: "0.8rem 2rem",
              borderRadius: "10px",
              border: "none",
              background: "#fff",
              color: "#111",
              cursor: "pointer",
            }}
          >
            Start Game
          </button>
        </>
      )}

      {stage === "question" && (
        <div style={{ width: "100%", maxWidth: "800px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <span style={{ fontWeight: 700, opacity: 0.85 }}>
              Question {currentIndex + 1} / {game!.questions.length}
            </span>
            <span
              style={{
                fontSize: "1.5rem",
                fontWeight: 800,
                direction: "ltr",
                background: "rgba(255,255,255,0.15)",
                padding: "0.2rem 0.9rem",
                borderRadius: "999px",
              }}
            >
              {timeLeft}s
            </span>
          </div>

          <div
            style={{
              background: "#fff",
              color: "#111",
              borderRadius: "14px",
              padding: "1.5rem",
              marginBottom: "1.25rem",
            }}
          >
            <p style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
              {q.prompt || "Question"}
            </p>
            {q.mediaType === "text" && q.mediaContent && (
              <p style={{ fontSize: "1.1rem", lineHeight: 1.5 }}>{q.mediaContent}</p>
            )}
            {q.mediaType === "image" && q.mediaContent && (
              <img
                src={q.mediaContent}
                alt="Question media"
                style={{ maxWidth: "100%", maxHeight: "260px", borderRadius: "8px" }}
              />
            )}
            {q.mediaType === "video" && q.mediaContent && (
              <video
                src={q.mediaContent}
                controls
                autoPlay
                style={{ maxWidth: "100%", maxHeight: "260px", borderRadius: "8px" }}
              />
            )}
            {q.mediaType === "audio" && q.mediaContent && (
              <audio src={q.mediaContent} controls autoPlay style={{ width: "100%" }} />
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
            }}
          >
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={locked}
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  padding: "1.1rem",
                  borderRadius: "10px",
                  border: "none",
                  background: answerColors[i],
                  color: "#fff",
                  cursor: locked ? "default" : "pointer",
                  opacity: selected !== null && selected !== i ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>{answerShapes[i]}</span>
                <span>{opt || `Answer ${i + 1}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {stage === "reveal" && (
        <div style={{ width: "100%", maxWidth: "700px" }}>
          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0 0 0.5rem" }}>
            {roundGain > 0 ? `+${roundGain} points!` : "No points this round"}
          </h2>
          <p style={{ opacity: 0.85, marginBottom: "1.25rem" }}>
            Correct answer: {answerShapes[q.correctIndex]}{" "}
            {q.options[q.correctIndex] || `Answer ${q.correctIndex + 1}`}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {q.options.map((opt, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  padding: "0.5rem 0.75rem",
                  border: i === q.correctIndex ? "2px solid #fff" : "none",
                }}
              >
                <span
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "4px",
                    background: answerColors[i],
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, textAlign: "left" }}>
                  {opt || `Answer ${i + 1}`}
                </span>
                <span style={{ fontWeight: 700, direction: "ltr" }}>
                  {answerCounts[i]}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStage("leaderboard")}
            style={{
              marginTop: "1.5rem",
              fontSize: "1rem",
              fontWeight: 700,
              padding: "0.7rem 1.6rem",
              borderRadius: "10px",
              border: "none",
              background: "#fff",
              color: "#111",
              cursor: "pointer",
            }}
          >
            See Leaderboard
          </button>
        </div>
      )}

      {stage === "leaderboard" && (
        <div style={{ width: "100%", maxWidth: "500px" }}>
          <h2 style={{ fontSize: "1.9rem", fontWeight: 800, margin: "0 0 1rem" }}>
            Leaderboard
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {sortedPlayers.map((p, i) => (
              <div
                key={p.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  padding: "0.6rem 1rem",
                  fontWeight: p.name === "You" ? 800 : 500,
                }}
              >
                <span style={{ width: "1.5rem", direction: "ltr" }}>{i + 1}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{p.name}</span>
                <span style={{ direction: "ltr" }}>{p.score}</span>
              </div>
            ))}
          </div>
          <button
            onClick={nextQuestion}
            style={{
              marginTop: "1.5rem",
              fontSize: "1rem",
              fontWeight: 700,
              padding: "0.7rem 1.6rem",
              borderRadius: "10px",
              border: "none",
              background: "#fff",
              color: "#111",
              cursor: "pointer",
            }}
          >
            {currentIndex + 1 >= game!.questions.length
              ? "See Final Results"
              : "Next Question"}
          </button>
        </div>
      )}

      {stage === "final" && (
        <div style={{ width: "100%", maxWidth: "500px" }}>
          <h2 style={{ fontSize: "2.25rem", fontWeight: 800, margin: "0 0 1rem" }}>
            Final Results
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {sortedPlayers.map((p, i) => (
              <div
                key={p.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  background: i === 0 ? "#d89e00" : "rgba(255,255,255,0.15)",
                  borderRadius: "8px",
                  padding: "0.7rem 1rem",
                  fontWeight: p.name === "You" ? 800 : 500,
                }}
              >
                <span style={{ width: "1.5rem", direction: "ltr" }}>{i + 1}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{p.name}</span>
                <span style={{ direction: "ltr" }}>{p.score}</span>
              </div>
            ))}
          </div>
          <Link
            href="/games/teacher/library"
            style={{
              display: "inline-block",
              marginTop: "1.5rem",
              fontSize: "0.9rem",
              color: "#fff",
              textDecoration: "underline",
            }}
          >
            ← Back to My Games
          </Link>
        </div>
      )}
    </main>
  );
}
