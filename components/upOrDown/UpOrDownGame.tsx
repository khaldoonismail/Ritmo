"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { colors, radius } from "@/lib/theme";
import { playPianoMidi, unlockNoteAudio } from "@/lib/playNote";
import {
  LEAD_IN,
  LEVELS,
  NOTE_GAP,
  NOTE_SECONDS,
  PAIR_SECONDS,
  QuestionSupply,
  UP_OR_DOWN_LIVES,
  hasSamePath,
  listenSeconds,
  pointsFor,
  runSpeed,
  type Direction,
  type UpOrDownLevel,
  type UpOrDownQuestion,
} from "@/lib/upOrDown";
import { detectQuality } from "@/components/noteRunner/quality";
import { RunnerMusic, loadMusicOn, saveMusicOn } from "@/components/noteRunner/music";
import { ForkEngine } from "./ForkEngine";

// One run of Up or Down: the 3D road (ForkEngine), the listening card, the
// HUD and the controls. Ear only: no staff and no note names.
//
// Each fork: the background music stops completely, the two notes play
// (the card lights bubble ♪1, then ♪2), the music comes back, and the kid
// reaches the fork after both notes plus thinking time (the engine slows
// the runner if needed). After the answer, bubble ♪2 moves up, down or
// stays level, so the child sees what they heard. A wrong answer costs a
// heart and plays both notes again.

type Phase = "ready" | "playing" | "paused" | "over";

const ARROW: Record<Direction, string> = { up: "⬆️", down: "⬇️", same: "➡️" };
const SAID: Record<Direction, string> = { up: "Higher!", down: "Lower!", same: "Same!" };

function playWrong() {
  const audio = new Audio("/sounds/wrong.mp3");
  audio.volume = 0.5;
  audio.play().catch(() => {});
}

export default function UpOrDownGame({
  level,
  autoStart = false,
  onChangeSettings,
}: {
  level: UpOrDownLevel;
  autoStart?: boolean;
  onChangeSettings: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ForkEngine | null>(null);
  const supplyRef = useRef(new QuestionSupply(level));
  const questionRef = useRef<UpOrDownQuestion | null>(null);
  const answeredRef = useRef(false);
  const statsRef = useRef({ score: 0, lives: UP_OR_DOWN_LIVES, streak: 0, bestStreak: 0, correct: 0, total: 0 });
  const phaseRef = useRef<Phase>("ready");
  const timersRef = useRef<number[]>([]);
  const listeningRef = useRef(false);
  const busyUntilRef = useRef(0); // wall-clock ms until the current notes end
  const musicRef = useRef<RunnerMusic | null>(null);
  const musicOnRef = useRef(typeof window === "undefined" ? true : loadMusicOn());
  const same = hasSamePath(level);

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [question, setQuestion] = useState<UpOrDownQuestion | null>(null);
  const [stats, setStats] = useState(statsRef.current);
  const [lit, setLit] = useState<0 | 1 | 2>(0);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; answer: Direction; picked: Direction | null; points: number } | null>(null);
  const [musicOn, setMusicOn] = useState(true);
  const [webglError, setWebglError] = useState(false);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  // Music plays only while running, switched on, and not during the notes.
  const syncMusic = useCallback(() => {
    const want = phaseRef.current === "playing" && musicOnRef.current && !listeningRef.current;
    if (want) {
      if (!musicRef.current) musicRef.current = new RunnerMusic();
      musicRef.current.play();
    } else if (phaseRef.current === "over") {
      musicRef.current?.stop();
    } else {
      musicRef.current?.pause();
    }
  }, []);

  const later = (ms: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  // Plays the two notes (after `delay` seconds), lighting the bubbles, with
  // the music stopped from just before until just after. `then` runs when
  // the notes are over.
  const playPair = useCallback(
    (q: UpOrDownQuestion, delay = 0, then?: () => void) => {
      const ms = (s: number) => Math.round((delay + s) * 1000);
      later(Math.max(0, ms(0) - 10), () => {
        listeningRef.current = true;
        setListening(true);
        syncMusic(); // stops the music before the first note
        playPianoMidi(q.first, LEAD_IN, NOTE_SECONDS);
        playPianoMidi(q.second, LEAD_IN + NOTE_SECONDS + NOTE_GAP, NOTE_SECONDS);
      });
      later(ms(LEAD_IN), () => setLit(1));
      later(ms(LEAD_IN + NOTE_SECONDS + NOTE_GAP), () => setLit(2));
      later(ms(PAIR_SECONDS), () => setLit(0));
      later(ms(PAIR_SECONDS + 0.3), () => {
        listeningRef.current = false;
        setListening(false);
        syncMusic();
        then?.();
      });
      busyUntilRef.current = Date.now() + ms(PAIR_SECONDS + 0.3);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [syncMusic]
  );

  // The kid left a fork: here comes the next question.
  const handleApproach = useCallback(() => {
    const engine = engineRef.current;
    // (No new question once the last heart is gone and its replay plays.)
    if (!engine || phaseRef.current === "over" || statsRef.current.lives <= 0) return;
    const q = supplyRef.current.next();
    questionRef.current = q;
    answeredRef.current = false;
    setQuestion(q);
    setResult(null);
    engine.setSpeed(runSpeed(statsRef.current.correct));
    // Wait for a wrong answer's replay to finish first.
    const delay = Math.max(0, (busyUntilRef.current - Date.now()) / 1000);
    playPair(q, delay);
    engine.setArrival(delay + listenSeconds(level, statsRef.current.correct));
  }, [level, playPair]);

  const handleFork = useCallback(
    (choice: Direction | null) => {
      const engine = engineRef.current;
      const q = questionRef.current;
      if (!engine || !q || answeredRef.current) return;
      answeredRef.current = true;
      const s = { ...statsRef.current };
      const correct = choice === q.answer;
      let points = 0;
      s.total++;
      if (correct) {
        points = pointsFor(s.streak);
        s.score += points;
        s.correct++;
        s.streak++;
        s.bestStreak = Math.max(s.bestStreak, s.streak);
      } else {
        s.lives--;
        s.streak = 0;
      }
      statsRef.current = s;
      setStats(s);
      setResult({ correct, answer: q.answer, picked: choice, points });
      engine.showResult(q.answer, choice);
      if (!correct) {
        playWrong();
        // Both notes again, so the child hears the difference.
        playPair(q, 0.45, () => {
          if (statsRef.current.lives <= 0) {
            setPhase("over");
            syncMusic();
            engineRef.current?.pause();
          }
        });
      }
    },
    [playPair, syncMusic]
  );

  const approachRef = useRef(handleApproach);
  approachRef.current = handleApproach;
  const forkRef = useRef(handleFork);
  forkRef.current = handleFork;

  const start = () => {
    unlockNoteAudio();
    const engine = engineRef.current;
    if (!engine) return;
    clearTimers();
    listeningRef.current = false;
    setListening(false);
    setLit(0);
    busyUntilRef.current = 0;
    statsRef.current = { score: 0, lives: UP_OR_DOWN_LIVES, streak: 0, bestStreak: 0, correct: 0, total: 0 };
    setStats(statsRef.current);
    supplyRef.current = new QuestionSupply(level);
    questionRef.current = null;
    setQuestion(null);
    setResult(null);
    engine.reset();
    engine.setSpeed(runSpeed(0));
    setPhase("playing");
    engine.start();
    syncMusic();
  };
  const startRef = useRef(start);
  startRef.current = start;

  // Create the 3D scene once per mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let engine: ForkEngine;
    try {
      engine = new ForkEngine(
        el,
        same,
        {
          onApproach: () => approachRef.current(),
          onFork: (c) => forkRef.current(c),
        },
        detectQuality()
      );
    } catch {
      setWebglError(true);
      return;
    }
    engineRef.current = engine;
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __upOrDown?: unknown }).__upOrDown = {
        engine,
        question: () => questionRef.current,
        music: () => musicRef.current,
        listening: () => listeningRef.current,
      };
    }
    setMusicOn(musicOnRef.current);
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

  // Keep the road below the card.
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
  }, [phase !== "ready"]);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    engineRef.current?.pause();
    setPhase("paused");
    syncMusic();
  }, [syncMusic]);

  const resume = () => {
    if (phaseRef.current !== "paused") return;
    unlockNoteAudio();
    setPhase("playing");
    engineRef.current?.start();
    syncMusic();
  };

  const hearAgain = () => {
    unlockNoteAudio();
    const q = questionRef.current;
    const engine = engineRef.current;
    if (!q || !engine || answeredRef.current || listeningRef.current || phaseRef.current !== "playing") return;
    playPair(q);
    // Costs a little time: the runner slows so the fork waits for the notes.
    engine.setArrival(PAIR_SECONDS + 1.8);
  };

  const toggleMusic = () => {
    unlockNoteAudio();
    const on = !musicOnRef.current;
    musicOnRef.current = on;
    setMusicOn(on);
    saveMusicOn(on);
    syncMusic();
  };

  // Keyboard: ↑ ↓ (W / S) pick a path, → (D) "Same" on Hard, H hears
  // again, P or Esc pauses.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const p = phaseRef.current;
      const engine = engineRef.current;
      if (p === "playing" && engine) {
        if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
          engine.moveChoice(-1);
          e.preventDefault();
        } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
          engine.moveChoice(1);
          e.preventDefault();
        } else if (same && (e.key === "ArrowRight" || e.key === "d" || e.key === "D")) {
          engine.setChoice("same");
          e.preventDefault();
        } else if (e.key === "h" || e.key === "H") {
          hearAgainRef.current();
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
  const hearAgainRef = useRef(hearAgain);
  hearAgainRef.current = hearAgain;

  // Pause by itself when the tab or app is hidden (not with ?debug).
  useEffect(() => {
    const debug = new URLSearchParams(window.location.search).has("debug");
    const onVisibility = () => {
      if (document.hidden && !debug) pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause]);

  // Touch / mouse: swipe up/down picks ⬆️ / ⬇️ (from ⬆️, a swipe down
  // goes to ➡️ on Hard); a tap picks the path at that height.
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    unlockNoteAudio();
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
      engine.moveChoice(dy < 0 ? -1 : 1);
    } else if (same && dx > 40 && Math.abs(dx) > Math.abs(dy)) {
      engine.setChoice("same");
    } else if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
      engine.setChoice(engine.choiceAtClientY(e.clientY));
    }
  };

  const hearts = Array.from({ length: UP_OR_DOWN_LIVES }, (_, i) => (i < stats.lives ? "❤️" : "🤍")).join(" ");
  const moved = result?.answer ?? null;
  const questionText = same ? "Higher, lower or same?" : "Higher or lower?";

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
        aria-label="Up or Down road. Use the up and down arrow keys, swipe up or down, or tap a path."
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
              <span style={{ fontSize: "0.72rem", fontWeight: 800, color: colors.orangeShadow }}>
                🔥 {stats.streak} in a row
              </span>
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
            <span style={{ fontSize: "0.8rem" }}>{musicOn ? "Music on" : "Music off"}</span>
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

      {/* The listening card */}
      {phase !== "ready" && (
        <div
          ref={cardRef}
          style={{
            position: "absolute",
            top: "max(64px, calc(env(safe-area-inset-top) + 58px))",
            left: "50%",
            transform: "translateX(-50%)",
            width: "max-content",
            maxWidth: "calc(100vw - 24px)",
            background: colors.white,
            borderRadius: radius.card,
            padding: "8px 14px",
            boxShadow: result
              ? `0 0 0 4px ${result.correct ? colors.greenCard : colors.coralText}, 0 6px 0 rgba(0,0,0,0.12)`
              : "0 6px 0 rgba(0,0,0,0.12)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: "6px 16px",
            zIndex: 1,
          }}
        >
          {/* Two note bubbles; after the answer ♪2 moves to show the jump. */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, height: 92 }} aria-hidden="true">
            <NoteBubble n={1} lit={lit === 1} />
            <span style={{ fontSize: "1.3rem", fontWeight: 900, opacity: 0.3 }}>→</span>
            <NoteBubble n={2} lit={lit === 2} move={moved} />
          </div>
          <div style={{ textAlign: "left", minWidth: 170 }} aria-live="polite">
            {result ? (
              <>
                <div style={{ fontSize: "1.35rem", fontWeight: 900, lineHeight: 1.15, whiteSpace: "nowrap", color: result.correct ? colors.greenCardShadow : colors.coralText }}>
                  {result.correct ? `✓ ${ARROW[result.answer]} ${SAID[result.answer]} +${result.points}` : `✗ It was ${ARROW[result.answer]} ${SAID[result.answer]}`}
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 800, opacity: 0.6 }}>
                  {result.correct ? "Great ears!" : result.picked ? "Listen again…" : `Pick a path: ${same ? "⬆️ ➡️ ⬇️" : "⬆️ or ⬇️"}`}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "1.35rem", fontWeight: 900, color: colors.blueText, lineHeight: 1.15, whiteSpace: "nowrap" }}>
                  {question ? questionText : "Get ready…"}
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 800, opacity: 0.55 }}>
                  {lit === 1 ? "Note 1…" : lit === 2 ? "Note 2…" : question ? "Is note 2 higher or lower?" : "Listen to two notes"}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={hearAgain}
            disabled={!question || !!result || listening || phase !== "playing"}
            style={{
              ...hearButton,
              opacity: !question || result ? 0.45 : 1,
              cursor: !question || result || listening ? "default" : "pointer",
            }}
          >
            {listening ? "🔊 Listening…" : "🔊 Hear again"}
          </button>
        </div>
      )}

      {phase !== "playing" && (
        <div style={overlay}>
          <div style={panel}>
            {phase === "ready" && (
              <>
                <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900 }}>⬆️ Up or Down ⬇️</h1>
                <p style={{ margin: 0, fontWeight: 700, opacity: 0.7 }}>{LEVELS[level].label}</p>
                <p style={{ margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
                  Listen to two notes. Is the second one higher? Take the bridge ⬆️. Lower? Take the tunnel ⬇️.
                  {same && " The same? Go straight ➡️."}
                </p>
                <button type="button" onClick={start} style={primaryButton}>
                  Start
                </button>
                <button type="button" onClick={onChangeSettings} style={secondaryButton}>
                  Change level
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
                    ✓ {stats.correct} / {stats.total} right
                  </span>
                  <span>🔥 best streak {stats.bestStreak}</span>
                </div>
                <button type="button" onClick={start} style={primaryButton}>
                  Play again
                </button>
                <button type="button" onClick={onChangeSettings} style={secondaryButton}>
                  Change level
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
              This device or browser can&apos;t show 3D graphics, so Up or Down can&apos;t run here.
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

// A note bubble (no staff, no name). The one sounding glows; after the
// answer, ♪2 glides up, down, or stays level with a little pulse.
function NoteBubble({ n, lit, move = null }: { n: 1 | 2; lit: boolean; move?: Direction | null }) {
  const shift = move === "up" ? -24 : move === "down" ? 24 : 0;
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontSize: "1.45rem",
        fontWeight: 900,
        color: lit || move ? colors.white : colors.textPrimary,
        background: lit ? "#F28C28" : move ? MOVE_COLOR[move] : "#EFE7D8",
        boxShadow: lit ? "0 0 0 6px rgba(242,140,40,0.3)" : "none",
        position: "relative",
        transform: `translateY(${shift}px) scale(${lit ? 1.12 : 1})`,
        transition: "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s, box-shadow 0.2s",
        animation: move === "same" ? "uodPulse 0.5s ease-in-out 2" : undefined,
      }}
    >
      ♪
      <span
        style={{
          position: "absolute",
          bottom: -4,
          right: -4,
          fontSize: "0.7rem",
          background: colors.white,
          color: colors.textPrimary,
          borderRadius: 999,
          padding: "0 5px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }}
      >
        {n}
      </span>
      {n === 2 && <style>{"@keyframes uodPulse{0%,100%{scale:1}50%{scale:1.18}}"}</style>}
    </div>
  );
}

const MOVE_COLOR: Record<Direction, string> = { up: "#F28C28", down: "#7B5CD6", same: "#2F8FD8" };

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
  zIndex: 1,
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

const hearButton: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 900,
  padding: "0.7rem 1rem",
  borderRadius: "14px",
  border: "none",
  background: colors.greenButton,
  boxShadow: `0 4px 0 ${colors.greenButtonShadow}`,
  color: colors.white,
  whiteSpace: "nowrap",
  touchAction: "manipulation",
};
