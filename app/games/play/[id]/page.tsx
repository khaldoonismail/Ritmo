"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { colors, radius, solidShadow } from "@/lib/theme";

type MediaType = "text" | "image" | "video" | "audio";

interface Question {
  id: string;
  mediaType: MediaType;
  prompt: string;
  mediaContent: string;
  imageContent?: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
}

type MediaMode = "sound" | "photo" | "both";

interface Game {
  id: string;
  title: string;
  questions: Question[];
}

interface Player {
  name: string;
  score: number;
}

// Kept intentionally distinct from the Ritmo palette (colors.*) — these
// mimic Kahoot's answer-tile colors for game recognizability. Shadow
// variants are darker shades of each fill for the app-wide "3D" solid
// offset-shadow treatment.
const answerColors = ["#e21b3c", "#1368ce", "#d89e00", "#2ca30f"];
const answerShadowColors = ["#a8112c", "#0d4a8f", "#a67800", "#1f7a0b"];
const answerShapes = ["▲", "◆", "●", "■"];
const stageBg = "#1b6b0a";
const cardShadowOnGreen = "#124e07";
const whiteElementShadow = "#c7cdbf";

type Stage = "loading" | "notfound" | "lobby" | "question" | "final";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function playSound(kind: "correct" | "wrong") {
  const audio = new Audio(`/sounds/${kind}.mp3`);
  audio.play().catch(() => {});
}

export default function PlayGamePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [pin] = useState(() => Math.floor(100000 + Math.random() * 900000));
  const [gameUrl, setGameUrl] = useState("");
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(1);
  const [mediaMode, setMediaMode] = useState<MediaMode>("sound");
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(20);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
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
    setGameUrl(window.location.href);
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/accounts/login");
        return;
      }

      const { data } = await supabase
        .from("games")
        .select("id, title, questions")
        .eq("id", id)
        .maybeSingle();

      setGame(data);
      if (data) {
        const questions = (data as Game).questions;
        const uniqueLabels: string[] = Array.from(
          new Set(questions.map((q) => q.options[q.correctIndex]).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b));
        setLabels(uniqueLabels);
        setSelectedLabels(new Set(uniqueLabels));
        setQuestionCount(questions.length);
        setTimeLimitSeconds(questions[0]?.timeLimit || 20);
      }
      setStage(data ? "lobby" : "notfound");
    }

    load();
  }, [id, router]);

  const poolSize = game
    ? game.questions.filter((q) => selectedLabels.has(q.options[q.correctIndex])).length
    : 0;
  const hasImages = game ? game.questions.some((q) => q.imageContent) : false;

  useEffect(() => {
    setQuestionCount((prev) => Math.max(1, Math.min(prev, Math.max(poolSize, 1))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolSize]);

  function toggleLabel(label: string) {
    setSelectedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  useEffect(() => {
    if (stage !== "question" || !timerEnabled) return;
    if (timeLeft <= 0) {
      finishQuestion(null);
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, timeLeft, timerEnabled]);

  function startGame() {
    if (!game) return;
    const pool = game.questions.filter((q) => selectedLabels.has(q.options[q.correctIndex]));
    const picked = shuffle(pool).slice(0, Math.min(questionCount, pool.length));
    if (picked.length === 0) return;
    setActiveQuestions(picked);
    roundEndedRef.current = false;
    setCurrentIndex(0);
    setTimeLeft(timerEnabled ? timeLimitSeconds : 0);
    setSelected(null);
    setLocked(false);
    setStage("question");
  }

  function handleAnswer(i: number) {
    if (locked) return;
    setLocked(true);
    setSelected(i);
    const q = activeQuestions[currentIndex];
    playSound(i === q.correctIndex ? "correct" : "wrong");
    setTimeout(() => finishQuestion(i), 1400);
  }

  function finishQuestion(chosen: number | null) {
    if (!game || roundEndedRef.current) return;
    roundEndedRef.current = true;
    const q = activeQuestions[currentIndex];
    const timeUsed = timeLeftRef.current;
    const correct = chosen !== null && chosen === q.correctIndex;
    const playerPoints = correct
      ? timerEnabled
        ? Math.round(500 + 500 * (timeUsed / timeLimitSeconds))
        : 1000
      : 0;

    setPlayers((prev) =>
      prev.map((p, idx) => {
        if (idx === 0) return { ...p, score: p.score + playerPoints };
        const botCorrect = Math.random() < 0.65;
        const gain = botCorrect ? 300 + Math.floor(Math.random() * 650) : 0;
        return { ...p, score: p.score + gain };
      })
    );

    const next = currentIndex + 1;
    if (next >= activeQuestions.length) {
      setLocked(false);
      setStage("final");
      return;
    }
    roundEndedRef.current = false;
    setCurrentIndex(next);
    setTimeLeft(timerEnabled ? timeLimitSeconds : 0);
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
          background: colors.background,
          color: colors.textPrimary,
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>
          Game not found
        </h1>
        <Link
          href="/games/teacher/library"
          style={{ color: "inherit", textDecoration: "underline", fontWeight: 700 }}
        >
          ← Back to My Games
        </Link>
      </main>
    );
  }

  const q = activeQuestions[currentIndex];
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  const isLobby = stage === "lobby";

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
        background: isLobby ? colors.background : stageBg,
        color: isLobby ? colors.textPrimary : colors.white,
      }}
    >
      {stage !== "final" && (
        <Link
          href="/games/teacher/library"
          style={{
            position: "fixed",
            top: "1.25rem",
            left: "1.25rem",
            fontSize: "0.85rem",
            fontWeight: 700,
            padding: "0.4rem 0.8rem",
            borderRadius: radius.pill,
            background: isLobby ? colors.white : "rgba(255,255,255,0.15)",
            boxShadow: isLobby ? solidShadow(3, colors.gamesCardShadow) : "none",
            color: isLobby ? colors.textPrimary : colors.white,
            textDecoration: "none",
          }}
        >
          ✕ Exit
        </Link>
      )}

      {stage === "lobby" && (
        <>
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
          <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>
            {game!.title}
          </h1>
          <p style={{ fontSize: "1rem", fontWeight: 700, opacity: 0.7, margin: 0 }}>
            Game PIN
          </p>
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
              <QRCodeSVG value={gameUrl} size={128} />
            </div>
          )}

          <p style={{ opacity: 0.7, fontWeight: 600, maxWidth: "420px", margin: 0 }}>
            Scan the QR code or open this page on another device — this is a
            single-device demo, so you'll play alongside 3 simulated players.
          </p>

          {labels.length > 1 && (
            <div
              style={{
                width: "100%",
                maxWidth: "500px",
                background: colors.white,
                borderRadius: radius.card,
                boxShadow: solidShadow(4, colors.gamesCardShadow),
                padding: "1rem 1.25rem",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.6rem",
                }}
              >
                <span style={{ fontWeight: 800 }}>Include in this round</span>
                <span style={{ display: "flex", gap: "0.6rem" }}>
                  <button
                    onClick={() => setSelectedLabels(new Set(labels))}
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      background: "none",
                      border: "none",
                      color: colors.blueText,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSelectedLabels(new Set())}
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      background: "none",
                      border: "none",
                      color: colors.coralText,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    None
                  </button>
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.4rem",
                  marginBottom: "0.9rem",
                }}
              >
                {labels.map((label) => {
                  const on = selectedLabels.has(label);
                  return (
                    <button
                      key={label}
                      onClick={() => toggleLabel(label)}
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        padding: "0.35rem 0.7rem",
                        borderRadius: radius.pill,
                        border: "none",
                        background: on ? colors.greenButton : colors.background,
                        color: on ? colors.white : colors.textPrimary,
                        opacity: on ? 1 : 0.6,
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <label htmlFor="questionCount" style={{ fontWeight: 800, fontSize: "0.9rem" }}>
                  Number of questions
                </label>
                <input
                  id="questionCount"
                  type="number"
                  min={1}
                  max={Math.max(poolSize, 1)}
                  value={questionCount}
                  onChange={(e) =>
                    setQuestionCount(
                      Math.max(1, Math.min(Number(e.target.value) || 1, Math.max(poolSize, 1)))
                    )
                  }
                  style={{
                    width: "4rem",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    padding: "0.3rem 0.5rem",
                    borderRadius: "6px",
                    border: `1px solid ${colors.gamesCardShadow}`,
                    direction: "ltr",
                  }}
                />
                <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>of {poolSize} available</span>
              </div>
            </div>
          )}

          <div
            style={{
              width: "100%",
              maxWidth: "500px",
              background: colors.white,
              borderRadius: radius.card,
              boxShadow: solidShadow(4, colors.gamesCardShadow),
              padding: "1rem 1.25rem",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 800 }}>Time per question</span>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={!timerEnabled}
                  onChange={(e) => setTimerEnabled(!e.target.checked)}
                />
                No time limit
              </label>
            </div>

            {timerEnabled && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  marginTop: "0.75rem",
                }}
              >
                <input
                  id="timeLimit"
                  type="number"
                  min={5}
                  max={120}
                  value={timeLimitSeconds}
                  onChange={(e) =>
                    setTimeLimitSeconds(Math.max(5, Math.min(Number(e.target.value) || 5, 120)))
                  }
                  style={{
                    width: "4rem",
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    padding: "0.3rem 0.5rem",
                    borderRadius: "6px",
                    border: `1px solid ${colors.gamesCardShadow}`,
                    direction: "ltr",
                  }}
                />
                <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>seconds</span>
              </div>
            )}
          </div>

          {hasImages && (
            <div
              style={{
                width: "100%",
                maxWidth: "500px",
                background: colors.white,
                borderRadius: radius.card,
                boxShadow: solidShadow(4, colors.gamesCardShadow),
                padding: "1rem 1.25rem",
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: "0.6rem" }}>
                Recognise the answer from
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {(
                  [
                    { value: "sound", label: "🔊 Sound" },
                    { value: "photo", label: "🖼️ Photo" },
                    { value: "both", label: "🔊🖼️ Both" },
                  ] as { value: MediaMode; label: string }[]
                ).map((opt) => {
                  const on = mediaMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setMediaMode(opt.value)}
                      style={{
                        flex: 1,
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        padding: "0.5rem 0.4rem",
                        borderRadius: radius.button,
                        border: "none",
                        background: on ? colors.greenButton : colors.background,
                        color: on ? colors.white : colors.textPrimary,
                        cursor: "pointer",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={startGame}
            disabled={poolSize === 0}
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              padding: "0.85rem 2rem",
              borderRadius: radius.button,
              border: "none",
              background: colors.greenButton,
              boxShadow: solidShadow(5, colors.greenButtonShadow),
              color: colors.white,
              cursor: poolSize === 0 ? "default" : "pointer",
              opacity: poolSize === 0 ? 0.5 : 1,
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
              Question {currentIndex + 1} / {activeQuestions.length}
            </span>
            <span
              style={{
                fontSize: timerEnabled ? "1.5rem" : "1rem",
                fontWeight: 800,
                direction: "ltr",
                background: colors.white,
                boxShadow: solidShadow(3, whiteElementShadow),
                color: stageBg,
                padding: "0.25rem 1rem",
                borderRadius: radius.pill,
              }}
            >
              {timerEnabled ? `${timeLeft}s` : "No limit"}
            </span>
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
            <p style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
              {q.prompt || "Question"}
            </p>
            {(() => {
              const showImage = (mediaMode === "photo" || mediaMode === "both") && q.imageContent;
              const showAudio =
                (mediaMode === "sound" || mediaMode === "both") &&
                q.mediaType === "audio" &&
                q.mediaContent;

              if (showImage || showAudio) {
                return (
                  <>
                    {showImage && (
                      <img
                        src={q.imageContent}
                        alt="Instrument"
                        style={{
                          maxWidth: "100%",
                          maxHeight: "260px",
                          borderRadius: "8px",
                          marginBottom: showAudio ? "0.75rem" : 0,
                        }}
                      />
                    )}
                    {showAudio && (
                      <audio src={q.mediaContent} controls autoPlay style={{ width: "100%" }} />
                    )}
                  </>
                );
              }

              return (
                <>
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
                </>
              );
            })()}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
            }}
          >
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
                    border: highlight
                      ? `4px solid ${isCorrectTile ? "#1fbf4d" : "#ff3b3b"}`
                      : "none",
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
      )}

      {stage === "final" && (
        <div style={{ width: "100%", maxWidth: "500px" }}>
          <h2 style={{ fontSize: "2.25rem", fontWeight: 800, margin: "0 0 1rem" }}>
            Final Results
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {sortedPlayers.map((p, i) => {
              const isWinner = i === 0;
              return (
                <div
                  key={p.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    background: isWinner ? "#d89e00" : "rgba(255,255,255,0.15)",
                    boxShadow: isWinner ? solidShadow(4, "#a67800") : "none",
                    borderRadius: radius.iconSquare,
                    padding: "0.75rem 1rem",
                    fontWeight: p.name === "You" ? 800 : 600,
                  }}
                >
                  <span style={{ width: "1.5rem", direction: "ltr" }}>{i + 1}</span>
                  <span style={{ flex: 1, textAlign: "left" }}>{p.name}</span>
                  <span style={{ direction: "ltr" }}>{p.score}</span>
                </div>
              );
            })}
          </div>
          <Link
            href="/games/teacher/library"
            style={{
              display: "inline-block",
              marginTop: "1.5rem",
              fontSize: "0.9rem",
              fontWeight: 700,
              color: colors.white,
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
