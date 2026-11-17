"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { colors, radius } from "@/lib/theme";
import { playNote, unlockNoteAudio } from "@/lib/playNote";
import { configLabel } from "@/lib/noteReading";
import {
  GAP_SECONDS,
  GateSupply,
  NOTE_RUNNER_LIVES,
  WRONG_GAP_SECONDS,
  gateSeconds,
  pointsFor,
  runnerLanes,
  type NoteRunnerConfig,
  type RunnerGate,
} from "@/lib/noteRunner";
import { RunnerEngine } from "./RunnerEngine";
import { detectQuality } from "./quality";

// One Note Runner run: the 3D road (RunnerEngine), the note card, the HUD
// and the controls. The whole run happens in the browser; `onRunEnd` gets
// what a server would need to check it (stage 2).

export interface RunnerAnswer {
  note: RunnerGate["question"]["note"];
  // The staff position the runner was on.
  picked: number;
  correct: boolean;
}

export interface RunSummary {
  score: number;
  correct: number;
  total: number;
  bestStreak: number;
  answers: RunnerAnswer[];
}

type Phase = "ready" | "playing" | "paused" | "over";

function playSound(kind: "wrong") {
  const audio = new Audio(`/sounds/${kind}.mp3`);
  audio.volume = 0.6;
  audio.play().catch(() => {});
}

export default function NoteRunnerGame({
  config,
  autoStart = false,
  onChangeSettings,
  onRunEnd,
}: {
  config: NoteRunnerConfig;
  // Start running as soon as the scene is ready (the click that mounted
  // this component already unlocked audio).
  autoStart?: boolean;
  onChangeSettings: () => void;
  onRunEnd?: (summary: RunSummary) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RunnerEngine | null>(null);
  const supplyRef = useRef(new GateSupply(config));
  const gateRef = useRef<RunnerGate | null>(null);
  const statsRef = useRef({ score: 0, lives: NOTE_RUNNER_LIVES, streak: 0, bestStreak: 0, correct: 0, total: 0 });
  const answersRef = useRef<RunnerAnswer[]>([]);
  const phaseRef = useRef<Phase>("ready");

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [gate, setGate] = useState<RunnerGate | null>(null);
  const [stats, setStats] = useState(statsRef.current);
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string; points: number } | null>(null);
  const [webglError, setWebglError] = useState(false);
  // Lanes are fixed for the life of this component (settings change
  // remounts it).
  const [laneLayout] = useState(() => runnerLanes(config.level));

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const nextGate = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || phaseRef.current === "over") return;
    const g = supplyRef.current.next();
    gateRef.current = g;
    setGate(g);
    setFeedback(null);
    engine.setClef(g.clef);
    engine.spawnGate(g.options, g.accidental, gateSeconds(config.level, statsRef.current.correct));
  }, [config]);

  const handleGateReached = useCallback(
    (position: number) => {
      const engine = engineRef.current;
      const g = gateRef.current;
      if (!engine || !g) return;
      const s = { ...statsRef.current };
      const correct = position === g.answer;
      let points = 0;
      s.total++;
      if (correct) {
        points = pointsFor(s.streak);
        s.score += points;
        s.correct++;
        s.streak++;
        s.bestStreak = Math.max(s.bestStreak, s.streak);
        playNote(g.question.note);
      } else {
        s.lives--;
        s.streak = 0;
        playSound("wrong");
      }
      statsRef.current = s;
      setStats(s);
      answersRef.current.push({ note: g.question.note, picked: position, correct });
      setFeedback({ correct, answer: g.name, points });
      engine.showResult(g.answer, position, correct ? GAP_SECONDS : WRONG_GAP_SECONDS);

      if (s.lives <= 0) {
        // Let the red flash show, then stop.
        setPhase("over");
        window.setTimeout(() => engineRef.current?.pause(), 700);
        onRunEnd?.({
          score: s.score,
          correct: s.correct,
          total: s.total,
          bestStreak: s.bestStreak,
          answers: answersRef.current,
        });
      }
    },
    [onRunEnd]
  );

  // Create the 3D scene once per mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let engine: RunnerEngine;
    try {
      engine = new RunnerEngine(
        el,
        laneLayout,
        {
          onGateReached: (lane) => handleGateRef.current(lane),
          onNeedGate: () => nextGateRef.current(),
        },
        detectQuality()
      );
    } catch {
      setWebglError(true);
      return;
    }
    engineRef.current = engine;
    // ?debug in the URL exposes the engine and current gate to tests
    // (scripts/check-note-runner.mjs checks every note head's position).
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __noteRunner?: unknown }).__noteRunner = { engine, gate: () => gateRef.current };
    }
    if (autoStart) startRef.current();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Lane count is fixed for the life of this component (settings change
    // remounts it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the road's far end below the note card.
  useEffect(() => {
    const card = cardRef.current;
    const engine = engineRef.current;
    if (!card || !engine) return;
    const update = () => engine.setTopReserved(card.getBoundingClientRect().bottom);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(card);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [gate !== null]);

  // The engine calls the latest handlers through refs.
  const handleGateRef = useRef(handleGateReached);
  handleGateRef.current = handleGateReached;
  const nextGateRef = useRef(nextGate);
  nextGateRef.current = nextGate;

  const start = () => {
    unlockNoteAudio();
    const engine = engineRef.current;
    if (!engine) return;
    statsRef.current = { score: 0, lives: NOTE_RUNNER_LIVES, streak: 0, bestStreak: 0, correct: 0, total: 0 };
    setStats(statsRef.current);
    answersRef.current = [];
    supplyRef.current = new GateSupply(config);
    setFeedback(null);
    engine.reset();
    setPhase("playing");
    engine.start();
    nextGate();
  };

  const startRef = useRef(start);
  startRef.current = start;

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    engineRef.current?.pause();
    setPhase("paused");
  }, []);

  const resume = () => {
    if (phaseRef.current !== "paused") return;
    unlockNoteAudio();
    setPhase("playing");
    engineRef.current?.start();
  };

  // Keyboard: ↑ ↓ (and W / S) change lane; P or Esc pauses.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const p = phaseRef.current;
      if (p === "playing") {
        if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
          engineRef.current?.moveLane(-1);
          e.preventDefault();
        } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
          engineRef.current?.moveLane(1);
          e.preventDefault();
        } else if (e.key === "p" || e.key === "P" || e.key === "Escape") {
          pause();
        }
      } else if (p === "paused" && (e.key === "p" || e.key === "P" || e.key === "Escape" || e.key === " ")) {
        resume();
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pause]);

  // Pause by itself when the tab or app is hidden.
  useEffect(() => {
    // (Not with ?debug: automated tests run in a background tab.)
    const debug = new URLSearchParams(window.location.search).has("debug");
    const onVisibility = () => {
      if (document.hidden && !debug) pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause]);

  // Touch / mouse: swipe up/down moves one lane (a long swipe moves more,
  // one lane per 45 px), a tap moves to the lane under the finger.
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "playing") return;
    pointerStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const startPt = pointerStart.current;
    pointerStart.current = null;
    const engine = engineRef.current;
    if (!startPt || startPt.id !== e.pointerId || !engine || phaseRef.current !== "playing") return;
    const dx = e.clientX - startPt.x;
    const dy = e.clientY - startPt.y;
    if (Math.abs(dy) > 30 && Math.abs(dy) > Math.abs(dx)) {
      const steps = Math.max(1, Math.round(Math.abs(dy) / 45));
      for (let i = 0; i < steps; i++) engine.moveLane(dy < 0 ? -1 : 1);
    } else if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
      engine.setLane(engine.laneAtClientY(e.clientY));
    }
  };

  const hearts = Array.from({ length: NOTE_RUNNER_LIVES }, (_, i) => (i < stats.lives ? "❤️" : "🤍")).join(" ");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#BFE3F5",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
        fontFamily: "inherit",
      }}
    >
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (pointerStart.current = null)}
        style={{ position: "absolute", inset: 0 }}
        aria-label="Note Runner staff. Use the up and down arrow keys, swipe up or down, or tap a lane."
      />

      {/* HUD */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "max(10px, env(safe-area-inset-top)) 12px 0",
          pointerEvents: "none",
        }}
      >
        <div style={hudPill}>
          <span aria-label={`${stats.lives} lives left`}>{hearts}</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
          <div style={{ ...hudPill, flexDirection: "column", alignItems: "flex-end", gap: 0 }}>
            <span style={{ fontSize: "1.15rem", fontWeight: 900 }}>{stats.score}</span>
            {stats.streak >= 2 && (
              <span style={{ fontSize: "0.72rem", fontWeight: 800, color: colors.orangeShadow }}>
                🔥 {stats.streak} in a row
              </span>
            )}
          </div>
          {phase === "playing" && (
            <button
              type="button"
              onClick={pause}
              aria-label="Pause"
              style={{ ...hudPill, pointerEvents: "auto", cursor: "pointer", border: "none", fontSize: "1rem" }}
            >
              ❚❚
            </button>
          )}
        </div>
      </div>

      {/* The note to read */}
      {gate && phase !== "ready" && (
        <div
          ref={cardRef}
          style={{
            position: "absolute",
            top: "max(56px, calc(env(safe-area-inset-top) + 50px))",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(190px, 44vw)",
            background: colors.white,
            borderRadius: radius.card,
            padding: "6px 10px 4px",
            boxShadow: feedback
              ? `0 0 0 4px ${feedback.correct ? colors.greenCard : colors.coralText}, 0 6px 0 rgba(0,0,0,0.12)`
              : "0 6px 0 rgba(0,0,0,0.12)",
            pointerEvents: "none",
            textAlign: "center",
          }}
        >
          {/* Only the note's name: finding it on the staff is the game. */}
          <div style={{ fontSize: "3rem", fontWeight: 900, lineHeight: 1.15, color: colors.blueText, padding: "0.2rem 0 0" }}>
            {gate.name}
          </div>
          <div style={{ minHeight: "1.3rem", fontSize: "0.9rem", fontWeight: 800 }}>
            {feedback ? (
              feedback.correct ? (
                <span style={{ color: colors.greenCardShadow }}>✓ {feedback.answer} +{feedback.points}</span>
              ) : (
                <span style={{ color: colors.coralText }}>✗ It&apos;s the green note</span>
              )
            ) : (
              <span style={{ opacity: 0.55 }}>Run to its note</span>
            )}
          </div>
        </div>
      )}

      {/* Start / pause / game over */}
      {phase !== "playing" && (
        <div style={overlay}>
          <div style={panel}>
            {phase === "ready" && (
              <>
                <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900 }}>🏃 Note Runner</h1>
                <p style={{ margin: 0, fontWeight: 700, opacity: 0.7 }}>{configLabel(config)}</p>
                <p style={{ margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
                  Read the name, then run to the note head with that name before the notes reach you.
                  <br />
                  <strong>Computer:</strong> ↑ ↓ keys · <strong>Tablet:</strong> tap a note head or swipe up/down
                </p>
                <button type="button" onClick={start} style={primaryButton}>
                  Start
                </button>
                <button type="button" onClick={onChangeSettings} style={secondaryButton}>
                  Change settings
                </button>
              </>
            )}
            {phase === "paused" && (
              <>
                <h2 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 900 }}>Paused</h2>
                <button type="button" onClick={resume} style={primaryButton}>
                  Resume
                </button>
                <button type="button" onClick={onChangeSettings} style={secondaryButton}>
                  Quit
                </button>
              </>
            )}
            {phase === "over" && (
              <>
                <h2 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 900 }}>Game over</h2>
                <div style={{ fontSize: "2.6rem", fontWeight: 900, color: colors.blueText, lineHeight: 1 }}>
                  {stats.score}
                </div>
                <div style={{ fontWeight: 700, opacity: 0.75 }}>points</div>
                <div style={{ display: "flex", gap: "1.25rem", justifyContent: "center", fontWeight: 800 }}>
                  <span>
                    ✓ {stats.correct} / {stats.total} notes
                  </span>
                  <span>🔥 best streak {stats.bestStreak}</span>
                </div>
                <button type="button" onClick={start} style={primaryButton}>
                  Play again
                </button>
                <button type="button" onClick={onChangeSettings} style={secondaryButton}>
                  Change settings
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {webglError && (
        <div style={overlay}>
          <div style={panel}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              This device or browser can&apos;t show 3D graphics, so Note Runner can&apos;t run here. Try the
              Note Reading game instead.
            </p>
            <button type="button" onClick={onChangeSettings} style={secondaryButton}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const hudPill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  background: "rgba(255,255,255,0.92)",
  color: colors.textPrimary,
  borderRadius: "999px",
  padding: "0.4rem 0.8rem",
  fontWeight: 800,
  boxShadow: "0 3px 0 rgba(0,0,0,0.12)",
};

const overlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(43,43,43,0.35)",
  padding: "16px",
};

const panel: React.CSSProperties = {
  background: colors.background,
  color: colors.textPrimary,
  borderRadius: "20px",
  padding: "1.5rem 1.25rem",
  width: "min(400px, 100%)",
  display: "flex",
  flexDirection: "column",
  gap: "0.8rem",
  alignItems: "stretch",
  textAlign: "center",
  boxShadow: "0 8px 0 rgba(0,0,0,0.15)",
};

const primaryButton: React.CSSProperties = {
  fontSize: "1.15rem",
  fontWeight: 900,
  padding: "0.85rem",
  borderRadius: "14px",
  border: "none",
  background: colors.greenButton,
  boxShadow: `0 4px 0 ${colors.greenButtonShadow}`,
  color: colors.white,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 800,
  padding: "0.6rem",
  borderRadius: "14px",
  border: `1px solid ${colors.neutralGray}`,
  background: colors.white,
  color: colors.textPrimary,
  cursor: "pointer",
};
