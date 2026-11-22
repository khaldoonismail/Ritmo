"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CHARACTER, type CharacterChoice } from "@/components/characters/choice";
import { colors, radius } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { NAMING_LABELS, type NamingSystem } from "@/lib/noteReading";
import {
  PIANO_HOP_LIVES,
  PIANO_LEVELS,
  PianoQuestionSupply,
  answerSeconds,
  isRight,
  pianoKeys,
  pointsFor,
  type PianoLevel,
  type PianoQuestion,
} from "@/lib/pianoHop";
import { detectQuality } from "@/components/noteRunner/quality";
import { RunnerMusic, loadMusicOn, saveMusicOn } from "@/components/noteRunner/music";
import { RotateDeviceOverlay, usePhonePortrait, useShortLandscape } from "@/components/RotateDevice";
import { PianoEngine } from "./PianoEngine";
import { playKey } from "./sound";
import { usePianoSamples } from "@/lib/usePianoSamples";

// One Piano Hop game: the 3D keyboard (PianoEngine), the name card with
// its countdown, the HUD and the controls. The card shows a note name;
// the child hops onto a key with that name (tap it, or ← → then Space /
// Enter). The key plays its own note. Right: points (with a streak bonus)
// and a happy hop. Wrong or too late: a heart is lost, the wrong key turns
// red, the right one glows green and plays. Three hearts.

type Phase = "ready" | "playing" | "paused" | "over";

const MUSIC_KEY = "ritmo.pianoHop.music";
// Pause after an answer before the next name (longer after a mistake, so
// the child can see and hear the right key).
const RIGHT_GAP_MS = 900;
const WRONG_GAP_MS = 2100;

type Result =
  | { kind: "right"; points: number }
  | { kind: "wrong" }
  | { kind: "late" };

export default function PianoHopGame({
  level,
  naming,
  character = DEFAULT_CHARACTER,
  autoStart = false,
  onChangeSettings,
}: {
  level: PianoLevel;
  naming: NamingSystem;
  character?: CharacterChoice;
  autoStart?: boolean;
  onChangeSettings: () => void;
}) {
  // Real piano samples for the notes (synth tone until they load).
  usePianoSamples();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PianoEngine | null>(null);
  const [keys] = useState(() => pianoKeys(level));
  const supplyRef = useRef(new PianoQuestionSupply(level, naming));
  const questionRef = useRef<PianoQuestion | null>(null);
  const awaitingRef = useRef(false); // a name is up and not answered yet
  const statsRef = useRef({ score: 0, lives: PIANO_HOP_LIVES, streak: 0, bestStreak: 0, correct: 0, total: 0 });
  const phaseRef = useRef<Phase>("ready");
  const timersRef = useRef<number[]>([]);
  // Countdown: when the current name runs out (ms since epoch), and how
  // long it had; while paused, how much was left.
  const deadlineRef = useRef(0);
  const allowedRef = useRef(1);
  const leftWhenPausedRef = useRef<number | null>(null);
  const nextPendingRef = useRef(false); // a "next name" fell due while paused
  const cursorRef = useRef(-1);
  const musicRef = useRef<RunnerMusic | null>(null);
  const musicOnRef = useRef(typeof window === "undefined" ? false : loadMusicOn(MUSIC_KEY));
  const compact = useShortLandscape();

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [question, setQuestion] = useState<PianoQuestion | null>(null);
  const [stats, setStats] = useState(statsRef.current);
  const [result, setResult] = useState<Result | null>(null);
  const [timeFrac, setTimeFrac] = useState(1);
  const [musicOn, setMusicOn] = useState(false);
  const [webglError, setWebglError] = useState(false);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const later = (ms: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  // Every key with the asked name (two of most notes on Medium and Hard).
  const rightKeys = (q: PianoQuestion) => keys.map((k, i) => (isRight(k, q) ? i : -1)).filter((i) => i >= 0);

  const sound = (midi: number, delay = 0) => {
    musicRef.current?.duck(1.4);
    playKey(midi, delay);
  };

  const nextQuestion = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || phaseRef.current === "over") return;
    if (phaseRef.current === "paused") {
      nextPendingRef.current = true;
      return;
    }
    engine.clearKeyStates();
    const q = supplyRef.current.next();
    questionRef.current = q;
    setQuestion(q);
    setResult(null);
    const seconds = answerSeconds(level, statsRef.current.correct);
    allowedRef.current = seconds * 1000;
    deadlineRef.current = Date.now() + seconds * 1000;
    setTimeFrac(1);
    awaitingRef.current = true;
    if (cursorRef.current >= 0) engine.setKeyState(cursorRef.current, "cursor");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // Shows the answer: the right key(s) green, the nearest one plays (after
  // the wrong key, if there was one).
  const showRight = (q: PianoQuestion, after: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const right = rightKeys(q);
    right.forEach((i) => engine.setKeyState(i, "correct"));
    const from = keys[engine.standingOn].x;
    const nearest = right.reduce((a, b) => (Math.abs(keys[b].x - from) < Math.abs(keys[a].x - from) ? b : a));
    later(after, () => {
      engine.press(nearest);
      sound(keys[nearest].midi);
    });
  };

  const endAnswer = (right: boolean) => {
    const gap = right ? RIGHT_GAP_MS : WRONG_GAP_MS;
    if (statsRef.current.lives <= 0) {
      later(gap, () => {
        setPhase("over");
        musicRef.current?.stop();
        engineRef.current?.pause();
      });
    } else later(gap, nextQuestion);
  };

  const loseHeart = () => {
    const s = { ...statsRef.current };
    s.total++;
    s.lives--;
    s.streak = 0;
    statsRef.current = s;
    setStats(s);
  };

  // The child picked key `index`: hop there, then judge on landing.
  const answer = (index: number) => {
    const engine = engineRef.current;
    const q = questionRef.current;
    if (!engine || !q || !awaitingRef.current || phaseRef.current !== "playing" || index < 0) return;
    awaitingRef.current = false;
    if (cursorRef.current >= 0) {
      engine.setKeyState(cursorRef.current, "normal");
      cursorRef.current = index;
      engine.setCursor(index);
    }
    engine.hopTo(index, () => {
      const key = keys[index];
      sound(key.midi);
      if (isRight(key, q)) {
        const s = { ...statsRef.current };
        const points = pointsFor(s.streak);
        s.total++;
        s.correct++;
        s.score += points;
        s.streak++;
        s.bestStreak = Math.max(s.bestStreak, s.streak);
        statsRef.current = s;
        setStats(s);
        engine.setKeyState(index, "correct");
        engine.react("happy");
        setResult({ kind: "right", points });
        endAnswer(true);
      } else {
        loseHeart();
        engine.setKeyState(index, "wrong");
        engine.react("sad");
        setResult({ kind: "wrong" });
        showRight(q, 550);
        endAnswer(false);
      }
    });
  };
  const answerRef = useRef(answer);
  answerRef.current = answer;

  const timeOut = () => {
    const engine = engineRef.current;
    const q = questionRef.current;
    if (!engine || !q || !awaitingRef.current) return;
    awaitingRef.current = false;
    loseHeart();
    engine.react("sad");
    setResult({ kind: "late" });
    showRight(q, 150);
    endAnswer(false);
  };
  const timeOutRef = useRef(timeOut);
  timeOutRef.current = timeOut;

  // The countdown (100 ms steps; stopped while paused).
  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      if (!awaitingRef.current) return;
      const left = deadlineRef.current - Date.now();
      setTimeFrac(Math.max(0, left / allowedRef.current));
      if (left <= 0) timeOutRef.current();
    }, 100);
    return () => window.clearInterval(id);
  }, [phase]);

  // Create the 3D scene once per mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let engine: PianoEngine;
    try {
      engine = new PianoEngine(el, keys, detectQuality(), character, PIANO_LEVELS[level].markers ? (naming === "solfege" ? "Do" : "C") : null);
    } catch {
      setWebglError(true);
      return;
    }
    engineRef.current = engine;
    // Start on the first C.
    engine.placeOn(0);
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __pianoHop?: unknown }).__pianoHop = {
        engine,
        keys,
        question: () => questionRef.current,
        awaiting: () => awaitingRef.current,
        answer: (i: number) => answerRef.current(i),
        stats: () => statsRef.current,
      };
    }
    if (autoStart) startRef.current();
    return () => {
      clearTimers();
      musicRef.current?.dispose();
      musicRef.current = null;
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the keyboard below the card.
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
  }, [phase !== "ready", compact]);

  const start = () => {
    unlockNoteAudio();
    const engine = engineRef.current;
    if (!engine) return;
    clearTimers();
    statsRef.current = { score: 0, lives: PIANO_HOP_LIVES, streak: 0, bestStreak: 0, correct: 0, total: 0 };
    setStats(statsRef.current);
    supplyRef.current = new PianoQuestionSupply(level, naming);
    nextPendingRef.current = false;
    leftWhenPausedRef.current = null;
    engine.clearKeyStates();
    engine.placeOn(0);
    // A new game starts on the first C with the cursor hidden (it shows
    // again on the first ← / → press, on the character's key).
    cursorRef.current = -1;
    engine.setCursor(-1);
    setPhase("playing");
    engine.start();
    syncMusic();
    later(500, nextQuestion);
  };
  const startRef = useRef(start);
  startRef.current = start;

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    if (awaitingRef.current) leftWhenPausedRef.current = Math.max(0, deadlineRef.current - Date.now());
    engineRef.current?.pause();
    musicRef.current?.pause();
    setPhase("paused");
  }, []);

  const resume = () => {
    if (phaseRef.current !== "paused") return;
    unlockNoteAudio();
    if (leftWhenPausedRef.current !== null) {
      deadlineRef.current = Date.now() + leftWhenPausedRef.current;
      leftWhenPausedRef.current = null;
    }
    setPhase("playing");
    engineRef.current?.start();
    syncMusic();
    if (nextPendingRef.current) {
      nextPendingRef.current = false;
      nextQuestion();
    }
  };
  const resumeRef = useRef(resume);
  resumeRef.current = resume;

  // Music only while playing, and only when switched on (off by default).
  function syncMusic() {
    if (musicOnRef.current) {
      if (!musicRef.current) musicRef.current = new RunnerMusic();
      musicRef.current.play();
    } else musicRef.current?.pause();
  }
  useEffect(() => setMusicOn(musicOnRef.current), []);
  const toggleMusic = () => {
    unlockNoteAudio();
    const on = !musicOnRef.current;
    musicOnRef.current = on;
    setMusicOn(on);
    saveMusicOn(on, MUSIC_KEY);
    if (phaseRef.current === "playing") syncMusic();
  };

  // Phones: landscape only (pause while upright, carry on when turned).
  const phonePortrait = usePhonePortrait();
  const rotatePausedRef = useRef(false);
  useEffect(() => {
    if (phonePortrait) {
      if (phaseRef.current === "playing") {
        pause();
        rotatePausedRef.current = true;
      }
    } else if (rotatePausedRef.current) {
      rotatePausedRef.current = false;
      resumeRef.current();
    }
  }, [phonePortrait, pause]);

  // Pause when the tab or app is hidden (not with ?debug).
  useEffect(() => {
    const debug = new URLSearchParams(window.location.search).has("debug");
    const onVisibility = () => {
      if (document.hidden && !debug) pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause]);

  // Keyboard: ← → (A / D) move the cursor, Space / Enter hops, P / Esc
  // pauses. The cursor appears with the first arrow press.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const p = phaseRef.current;
      const engine = engineRef.current;
      if (p === "playing" && engine) {
        const move = e.key === "ArrowLeft" || e.key === "a" || e.key === "A" ? -1 : e.key === "ArrowRight" || e.key === "d" || e.key === "D" ? 1 : 0;
        if (move) {
          e.preventDefault();
          const from = cursorRef.current >= 0 ? cursorRef.current : engine.standingOn;
          const next = Math.max(0, Math.min(keys.length - 1, cursorRef.current >= 0 ? from + move : from));
          if (cursorRef.current >= 0 && awaitingRef.current) engine.setKeyState(cursorRef.current, "normal");
          cursorRef.current = next;
          engine.setCursor(next);
          if (awaitingRef.current) engine.setKeyState(next, "cursor");
        } else if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (cursorRef.current >= 0) answerRef.current(cursorRef.current);
        } else if (e.key === "p" || e.key === "P" || e.key === "Escape") {
          pause();
        }
      } else if (p === "paused" && (e.key === "p" || e.key === "P" || e.key === "Escape" || e.key === " ")) {
        e.preventDefault();
        resumeRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pause, keys.length]);

  // Touch / mouse: tap a key to hop onto it.
  const onPointerDown = (e: React.PointerEvent) => {
    unlockNoteAudio();
    const engine = engineRef.current;
    if (!engine || phaseRef.current !== "playing" || !awaitingRef.current) return;
    answer(engine.keyAtClient(e.clientX, e.clientY));
  };

  const hearts = Array.from({ length: PIANO_HOP_LIVES }, (_, i) => (i < stats.lives ? "❤️" : "🤍")).join(" ");
  const status =
    result?.kind === "right"
      ? { text: `✓ ${question?.name} +${result.points}`, color: colors.greenCardShadow }
      : result?.kind === "wrong"
        ? { text: compact ? "✗ the green key" : "✗ It's the green key", color: colors.coralText }
        : result?.kind === "late"
          ? { text: compact ? "⏰ Too late!" : "⏰ Too late! It's the green key", color: colors.coralText }
          : { text: "Hop on it!", color: undefined };
  const ringColor = result ? (result.kind === "right" ? colors.greenCard : colors.coralText) : null;
  const timerColor = timeFrac < 0.3 ? "#F28C28" : colors.greenButton;

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
        style={{ position: "absolute", inset: 0 }}
        aria-label="Piano keyboard. Tap the key with the name on the card, or use the left and right arrow keys and press Space."
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
          zIndex: 2,
        }}
      >
        <div style={hudPill}>
          <span aria-label={`${stats.lives} lives left`}>{hearts}</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
          <div style={{ ...hudPill, flexDirection: "column", alignItems: "flex-end", gap: 0 }}>
            <span style={{ fontSize: "1.15rem", fontWeight: 900 }}>{stats.score}</span>
            {stats.streak >= 2 && (
              <span style={{ fontSize: "0.72rem", fontWeight: 800, color: colors.orangeShadow }}>🔥 {stats.streak} in a row</span>
            )}
          </div>
          <button
            type="button"
            onClick={toggleMusic}
            aria-pressed={musicOn}
            aria-label={musicOn ? "Music on. Tap to turn the music off" : "Music off. Tap to turn the music on"}
            style={{ ...hudPill, pointerEvents: "auto", cursor: "pointer", border: "none", fontSize: "0.95rem", opacity: musicOn ? 1 : 0.75 }}
          >
            <span aria-hidden="true">{musicOn ? "🎵" : "🔇"}</span>
            {!compact && <span style={{ fontSize: "0.8rem" }}>{musicOn ? "Music on" : "Music off"}</span>}
          </button>
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

      {/* The name card (compact: one line in the top bar on short screens) */}
      {phase !== "ready" &&
        (compact ? (
          <div
            ref={cardRef}
            style={{
              position: "absolute",
              top: "max(8px, env(safe-area-inset-top))",
              left: "50%",
              transform: "translateX(-50%)",
              maxWidth: "calc(100vw - 300px)",
              height: 44,
              boxSizing: "border-box",
              background: colors.white,
              borderRadius: 999,
              padding: "0 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              zIndex: 3,
              boxShadow: ringColor ? `0 0 0 3px ${ringColor}, 0 3px 0 rgba(0,0,0,0.12)` : "0 3px 0 rgba(0,0,0,0.12)",
            }}
          >
            <span style={{ fontSize: "1.7rem", fontWeight: 900, lineHeight: 1, color: colors.blueText }}>{question?.name ?? "…"}</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: status.color, opacity: status.color ? 1 : 0.55, overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              {status.text}
            </span>
            {!result && question && <TimerBar frac={timeFrac} color={timerColor} width={64} />}
          </div>
        ) : (
          <div
            ref={cardRef}
            style={{
              position: "absolute",
              top: "max(56px, calc(env(safe-area-inset-top) + 50px))",
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(230px, 46vw)",
              background: colors.white,
              borderRadius: radius.card,
              padding: "6px 10px 8px",
              textAlign: "center",
              pointerEvents: "none",
              zIndex: 3,
              boxShadow: ringColor ? `0 0 0 4px ${ringColor}, 0 6px 0 rgba(0,0,0,0.12)` : "0 6px 0 rgba(0,0,0,0.12)",
            }}
          >
            <div style={{ fontSize: "3rem", fontWeight: 900, lineHeight: 1.15, color: colors.blueText }}>{question?.name ?? "…"}</div>
            <div style={{ minHeight: "1.3rem", fontSize: "0.9rem", fontWeight: 800, color: status.color, opacity: status.color ? 1 : 0.55 }}>
              {status.text}
            </div>
            <div style={{ marginTop: 4, visibility: !result && question ? "visible" : "hidden" }}>
              <TimerBar frac={timeFrac} color={timerColor} />
            </div>
          </div>
        ))}

      {phase !== "playing" && (
        <div style={overlay}>
          <div style={panel}>
            {phase === "ready" && (
              <>
                <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900 }}>🎹 Piano Hop</h1>
                <p style={{ margin: 0, fontWeight: 700, opacity: 0.7 }}>
                  {PIANO_LEVELS[level].label} · {NAMING_LABELS[naming]}
                </p>
                <p style={{ margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
                  Read the name, then hop onto a key with that name before time runs out.
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
                <div style={{ fontSize: "2.6rem", fontWeight: 900, color: colors.blueText, lineHeight: 1 }}>{stats.score}</div>
                <div style={{ fontWeight: 700, opacity: 0.75 }}>points</div>
                <div style={{ display: "flex", gap: "1.25rem", justifyContent: "center", fontWeight: 800, flexWrap: "wrap" }}>
                  <span>
                    ✓ {stats.correct} / {stats.total} keys
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

      {phonePortrait && <RotateDeviceOverlay />}

      {webglError && (
        <div style={overlay}>
          <div style={panel}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              This device or browser can&apos;t show 3D graphics, so Piano Hop can&apos;t run here.
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

function TimerBar({ frac, color, width }: { frac: number; color: string; width?: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Time left"
      aria-valuenow={Math.round(frac * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ height: width ? 6 : 8, width: width ?? "100%", borderRadius: 99, background: "#EFE7D8", overflow: "hidden", flexShrink: 0 }}
    >
      <div style={{ width: `${frac * 100}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.1s linear" }} />
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
  zIndex: 4,
};

const panel: React.CSSProperties = {
  background: colors.background,
  color: colors.textPrimary,
  borderRadius: "20px",
  // Tighter on short screens (a phone in landscape is ~390 px tall).
  padding: "min(1.5rem, 4vh) 1.25rem",
  width: "min(400px, 100%)",
  maxHeight: "100%",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "min(0.8rem, 2.4vh)",
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
