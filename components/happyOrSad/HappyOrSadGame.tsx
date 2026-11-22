"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CHARACTER, type CharacterChoice } from "@/components/characters/choice";
import { colors, radius } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { RotateDeviceOverlay, usePhonePortrait, useShortLandscape } from "@/components/RotateDevice";
import { detectQuality } from "@/components/noteRunner/quality";
import type { HappyOrSadLevel, Mode, Piece } from "@/lib/happyOrSad/pieces";
import { ROUND_LENGTH, answerLabel, buildRound, starsFor, type Labels } from "@/lib/happyOrSad/round";
import { VillageEngine } from "./VillageEngine";
import { PiecePlayer } from "./player";
import { signImage } from "./icons";
import { usePianoSamples } from "@/lib/usePianoSamples";

// Happy or Sad ("Weather Village"): a short piece plays; the child taps
// ☀️ Sun (happy / major) or 🌧️ Cloud (sad / minor). Right: the village's
// weather turns to match while the piece finishes, and the village grows
// (a new house, tree, animal…). Wrong: no drama: the right weather shows
// for a moment, a soft "try the next one", nothing new is built. A round
// is 10 pieces, then the finished village with 1–3 stars. No hearts, no
// background music and no weather sounds (they'd confuse the ear).

type Phase = "ready" | "playing" | "paused" | "done";
type Step = "listening" | "waiting" | "answered";
type Result = { right: boolean; mode: Mode } | null;

// After an answer: how long the weather stays before the next piece (at
// least; the piece always plays to its end first).
const HOLD_RIGHT_MS = 1400;
const HOLD_WRONG_MS = 2200;
// Quiet between pieces.
const GAP_MS = 900;

export default function HappyOrSadGame({
  level,
  labels,
  character = DEFAULT_CHARACTER,
  autoStart = false,
  onChangeSettings,
}: {
  level: HappyOrSadLevel;
  labels: Labels;
  character?: CharacterChoice;
  autoStart?: boolean;
  onChangeSettings: () => void;
}) {
  // Real piano samples for the notes (synth tone until they load).
  usePianoSamples();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<VillageEngine | null>(null);
  const playerRef = useRef<PiecePlayer | null>(null);
  const roundRef = useRef<Piece[]>([]);
  const indexRef = useRef(0);
  const stepRef = useRef<Step>("listening");
  const playingRef = useRef(false); // the piece is still sounding
  const answeredAtRef = useRef(0);
  const correctRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  const timersRef = useRef<number[]>([]);
  const compact = useShortLandscape();

  const [phase, setPhaseState] = useState<Phase>("ready");
  const [index, setIndex] = useState(0);
  const [step, setStepState] = useState<Step>("listening");
  const [result, setResult] = useState<Result>(null);
  const [correct, setCorrect] = useState(0);
  const [icons, setIcons] = useState<{ sunny: string; rainy: string } | null>(null);
  const [webglError, setWebglError] = useState(false);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const setStep = (s: Step) => {
    stepRef.current = s;
    setStepState(s);
  };
  const later = (ms: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  // Starts piece `i` of the round.
  const playPiece = useCallback((i: number) => {
    const player = playerRef.current;
    const piece = roundRef.current[i];
    if (!player || !piece) return;
    indexRef.current = i;
    setIndex(i);
    setResult(null);
    setStep("listening");
    playingRef.current = true;
    engineRef.current?.setWeather("clear");
    player.play(piece, () => {
      playingRef.current = false;
      if (stepRef.current === "listening") setStep("waiting");
      else if (stepRef.current === "answered") moveOnRef.current();
    });
  }, []);

  // After an answer: once the piece has finished and the weather has had
  // its moment, go to the next piece (or the end of the round).
  const moveOn = () => {
    if (phaseRef.current !== "playing" || stepRef.current !== "answered" || playingRef.current) return;
    const r = resultRef.current;
    const hold = r?.right ? HOLD_RIGHT_MS : HOLD_WRONG_MS;
    const wait = Math.max(0, answeredAtRef.current + hold - Date.now());
    later(wait, () => {
      if (phaseRef.current !== "playing") return;
      engineRef.current?.setWeather("clear");
      const next = indexRef.current + 1;
      if (next >= ROUND_LENGTH) {
        later(500, finish);
        return;
      }
      later(GAP_MS, () => phaseRef.current === "playing" && playPiece(next));
    });
  };
  const moveOnRef = useRef(moveOn);
  moveOnRef.current = moveOn;
  const resultRef = useRef<Result>(null);
  resultRef.current = result;

  const finish = () => {
    setPhase("done");
    engineRef.current?.setWeather("sunny");
    engineRef.current?.cheer();
  };

  const answer = (mode: Mode) => {
    const engine = engineRef.current;
    const piece = roundRef.current[indexRef.current];
    if (!engine || !piece || phaseRef.current !== "playing" || stepRef.current === "answered") return;
    unlockNoteAudio();
    const right = mode === piece.mode;
    const r = { right, mode: piece.mode };
    resultRef.current = r;
    setResult(r);
    setStep("answered");
    answeredAtRef.current = Date.now();
    engine.setWeather(piece.mode === "major" ? "sunny" : "rainy");
    if (right) {
      correctRef.current++;
      setCorrect(correctRef.current);
      engine.setGrowth(engine.growth + 1, true);
      engine.cheer();
    } else {
      engine.shrug();
    }
    if (!playingRef.current) moveOn();
  };
  const answerRef = useRef(answer);
  answerRef.current = answer;

  const hearAgain = () => {
    unlockNoteAudio();
    // Only before answering (afterwards the round moves on by itself).
    if (phaseRef.current !== "playing" || stepRef.current === "answered") return;
    const piece = roundRef.current[indexRef.current];
    if (!piece || !playerRef.current) return;
    playingRef.current = true;
    if (stepRef.current === "waiting") setStep("listening");
    playerRef.current.play(piece, () => {
      playingRef.current = false;
      if (stepRef.current === "listening") setStep("waiting");
      else if (stepRef.current === "answered") moveOnRef.current();
    });
  };

  const start = () => {
    unlockNoteAudio();
    const engine = engineRef.current;
    if (!engine) return;
    clearTimers();
    playerRef.current?.stop();
    roundRef.current = buildRound(level);
    correctRef.current = 0;
    setCorrect(0);
    engine.setGrowth(0);
    engine.setWeather("clear", true);
    setPhase("playing");
    engine.start();
    later(600, () => playPiece(0));
  };
  const startRef = useRef(start);
  startRef.current = start;

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    clearTimers();
    playerRef.current?.stop();
    playingRef.current = false;
    engineRef.current?.pause();
    setPhase("paused");
  }, []);

  // Resuming replays the piece (if not answered yet) or moves on.
  const resume = () => {
    if (phaseRef.current !== "paused") return;
    unlockNoteAudio();
    setPhase("playing");
    engineRef.current?.start();
    if (stepRef.current === "answered") moveOnRef.current();
    else later(400, () => playPiece(indexRef.current));
  };
  const resumeRef = useRef(resume);
  resumeRef.current = resume;

  // Create the scene once per mount.
  useEffect(() => {
    setIcons({ sunny: signImage("sunny"), rainy: signImage("rainy") });
    const el = containerRef.current;
    if (!el) return;
    const quality = detectQuality();
    let engine: VillageEngine;
    try {
      engine = new VillageEngine(el, quality, character);
    } catch {
      setWebglError(true);
      return;
    }
    engineRef.current = engine;
    playerRef.current = new PiecePlayer(quality === "low");
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __happyOrSad?: unknown }).__happyOrSad = {
        engine,
        piece: () => roundRef.current[indexRef.current],
        index: () => indexRef.current,
        step: () => stepRef.current,
        correct: () => correctRef.current,
        phase: () => phaseRef.current,
        answer: (m: Mode) => answerRef.current(m),
      };
    }
    if (autoStart) startRef.current();
    return () => {
      clearTimers();
      playerRef.current?.stop();
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the village between the card and the buttons (the whole screen
  // at the end of a round).
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const update = () => {
      if (phaseRef.current === "done") {
        engine.setReserved(compact ? 8 : 60, compact ? 70 : 150);
        return;
      }
      const card = cardRef.current?.getBoundingClientRect();
      const buttons = buttonsRef.current?.getBoundingClientRect();
      engine.setReserved(card ? card.bottom : 0, compact || !buttons ? 0 : window.innerHeight - buttons.top);
    };
    update();
    const ro = new ResizeObserver(update);
    if (cardRef.current) ro.observe(cardRef.current);
    if (buttonsRef.current) ro.observe(buttonsRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [compact, icons, phase]);

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

  // Keyboard: ← or S = Sun, → or C = Cloud, H = hear again, P / Esc pause.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const p = phaseRef.current;
      if (p === "playing") {
        if (e.key === "ArrowLeft" || e.key === "s" || e.key === "S") answerRef.current("major");
        else if (e.key === "ArrowRight" || e.key === "c" || e.key === "C") answerRef.current("minor");
        else if (e.key === "h" || e.key === "H") hearAgainRef.current();
        else if (e.key === "p" || e.key === "P" || e.key === "Escape") pause();
      } else if (p === "paused" && (e.key === "p" || e.key === "P" || e.key === "Escape" || e.key === " ")) {
        e.preventDefault();
        resumeRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pause]);
  const hearAgainRef = useRef(hearAgain);
  hearAgainRef.current = hearAgain;

  const happy = answerLabel("major", labels);
  const sad = answerLabel("minor", labels);
  const listening = step === "listening" && phase === "playing";
  const message = result
    ? result.right
      ? result.mode === "major"
        ? `✓ ${happy}! The sun comes out`
        : `✓ ${sad}! A gentle rain`
      : `It was ${answerLabel(result.mode, labels)}. Try the next one!`
    : step === "waiting"
      ? labels === "mood"
        ? "Happy or sad?"
        : "Major or minor?"
      : labels === "mood"
        ? "Listen… happy or sad?"
        : "Listen… major or minor?";
  const stars = starsFor(correct);

  const Icon = ({ kind, size }: { kind: "sunny" | "rainy"; size: number }) =>
    icons ? <img src={icons[kind]} alt="" width={size} height={size} style={{ display: "block" }} /> : <span style={{ width: size, height: size }} />;

  const answerButton = (mode: Mode) => {
    const sunny = mode === "major";
    const picked = !!result && result.mode === mode;
    const dim = !!result && !picked;
    return (
      <button
        type="button"
        onClick={() => answer(mode)}
        disabled={phase !== "playing" || step === "answered"}
        aria-label={sunny ? `Sun: ${happy}` : `Cloud: ${sad}`}
        style={{
          display: "flex",
          flexDirection: compact ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: compact ? 8 : 4,
          minWidth: compact ? 132 : 180,
          minHeight: compact ? 56 : 104,
          padding: compact ? "8px 14px" : "12px 22px",
          borderRadius: 22,
          border: "none",
          background: sunny ? "#FFE08A" : "#BFD4F7",
          boxShadow: `0 5px 0 ${sunny ? "#E8B53A" : "#7E9CD6"}`,
          color: colors.textPrimary,
          fontWeight: 900,
          fontSize: compact ? "1.05rem" : "1.25rem",
          pointerEvents: "auto",
          cursor: phase === "playing" && step !== "answered" ? "pointer" : "default",
          opacity: dim ? 0.5 : 1,
          outline: picked ? `4px solid ${result!.right ? colors.greenCard : "#F2B84B"}` : "none",
          touchAction: "manipulation",
        }}
      >
        <Icon kind={sunny ? "sunny" : "rainy"} size={compact ? 40 : 64} />
        <span>
          {sunny ? "Sun" : "Cloud"} · {sunny ? happy : sad}
        </span>
      </button>
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#BFE3F5",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
        fontFamily: "inherit",
      }}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} aria-label="Your village" />

      {phase !== "done" && phase !== "ready" && (
        <>
          {/* HUD: where we are in the round, and pause */}
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
            <div style={hudPill} aria-label={`Piece ${index + 1} of ${ROUND_LENGTH}`}>
              <span style={{ fontSize: "0.95rem" }}>
                🎵 {index + 1}/{ROUND_LENGTH}
              </span>
              {!compact && (
                <span style={{ display: "flex", gap: 3 }} aria-hidden="true">
                  {Array.from({ length: ROUND_LENGTH }, (_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 99,
                        background: i < index ? colors.greenButton : i === index ? "#F28C28" : "#E3DCCD",
                      }}
                    />
                  ))}
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

          {/* The card */}
          <div
            ref={cardRef}
            aria-live="polite"
            style={{
              position: "absolute",
              top: compact ? "max(8px, env(safe-area-inset-top))" : "max(60px, calc(env(safe-area-inset-top) + 54px))",
              left: "50%",
              transform: "translateX(-50%)",
              height: compact ? 44 : undefined,
              boxSizing: "border-box",
              maxWidth: compact ? "calc(100vw - 230px)" : "calc(100vw - 24px)",
              background: colors.white,
              borderRadius: compact ? 999 : radius.card,
              padding: compact ? "0 4px 0 10px" : "8px 10px 8px 14px",
              boxShadow: result
                ? `0 0 0 ${compact ? 3 : 4}px ${result.right ? colors.greenCard : "#F2B84B"}, 0 4px 0 rgba(0,0,0,0.12)`
                : "0 4px 0 rgba(0,0,0,0.12)",
              display: "flex",
              alignItems: "center",
              gap: compact ? 8 : 14,
              whiteSpace: "nowrap",
              zIndex: 3,
            }}
          >
            {listening && <Playing small={compact} />}
            <span
              style={{
                fontSize: compact ? "1rem" : "1.3rem",
                fontWeight: 900,
                color: result ? (result.right ? colors.greenCardShadow : "#B7791F") : colors.blueText,
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {message}
            </span>
            <button
              type="button"
              onClick={hearAgain}
              disabled={phase !== "playing" || step === "answered"}
              aria-label="Hear again"
              style={{
                ...hearButton,
                opacity: step === "answered" ? 0.5 : 1,
                ...(compact ? { width: 36, height: 36, padding: 0, borderRadius: "50%", display: "grid", placeItems: "center" } : {}),
              }}
            >
              {compact ? "🔊" : "🔊 Hear again"}
            </button>
          </div>

          {/* The two answers: a row under the village (tablet), or the two
              bottom corners (phone in landscape), so the village stays big. */}
          <div
            ref={buttonsRef}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: "max(12px, env(safe-area-inset-bottom))",
              display: "flex",
              justifyContent: compact ? "space-between" : "center",
              gap: compact ? 0 : 28,
              padding: compact ? "0 12px" : 0,
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            {answerButton("major")}
            {answerButton("minor")}
          </div>
        </>
      )}

      {/* The end of a round: the whole village, the stars, play again. */}
      {phase === "done" && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "max(12px, env(safe-area-inset-bottom))",
            transform: "translateX(-50%)",
            width: compact ? "auto" : "min(460px, calc(100vw - 24px))",
            background: "rgba(255,248,236,0.96)",
            borderRadius: 20,
            padding: compact ? "6px 10px" : "14px 18px",
            boxShadow: "0 6px 0 rgba(0,0,0,0.14)",
            display: "flex",
            flexDirection: compact ? "row" : "column",
            alignItems: "center",
            gap: compact ? 12 : 8,
            zIndex: 4,
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: compact ? "1.6rem" : "2.2rem", lineHeight: 1 }} aria-label={`${stars} of 3 stars`}>
              {"⭐".repeat(stars)}
              <span style={{ opacity: 0.25 }}>{"⭐".repeat(3 - stars)}</span>
            </div>
            <div style={{ fontWeight: 900, fontSize: compact ? "0.95rem" : "1.15rem" }}>
              Your village! {correct} of {ROUND_LENGTH} right
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={start} style={{ ...primaryButton, padding: compact ? "0.55rem 1rem" : "0.85rem 1.4rem" }}>
              Play again
            </button>
            <button type="button" onClick={onChangeSettings} style={secondaryButton}>
              Change settings
            </button>
          </div>
        </div>
      )}

      {(phase === "ready" || phase === "paused") && (
        <div style={overlay}>
          <div style={panel}>
            {phase === "ready" ? (
              <>
                <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 900 }}>☀️ Happy or Sad 🌧️</h1>
                <p style={{ margin: 0, fontWeight: 600, lineHeight: 1.45 }}>
                  Listen to the music. {labels === "mood" ? "Happy" : "Major"}? Tap the sun. {labels === "mood" ? "Sad" : "Minor"}? Tap
                  the cloud. Every right answer builds your village!
                </p>
                <button type="button" onClick={start} style={primaryButton}>
                  Start
                </button>
                <button type="button" onClick={onChangeSettings} style={secondaryButton}>
                  Change settings
                </button>
              </>
            ) : (
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
          </div>
        </div>
      )}

      {phonePortrait && <RotateDeviceOverlay />}

      {webglError && (
        <div style={overlay}>
          <div style={panel}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              This device or browser can&apos;t show 3D graphics, so Happy or Sad can&apos;t run here.
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

// "Music is playing": a bubble with little level bars.
function Playing({ small = false }: { small?: boolean }) {
  const s = small ? 30 : 46;
  return (
    <div
      aria-hidden="true"
      style={{
        width: s,
        height: s,
        borderRadius: "50%",
        background: "#F28C28",
        boxShadow: `0 0 0 ${small ? 3 : 6}px rgba(242,140,40,0.3)`,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 2,
        paddingBottom: small ? 7 : 11,
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      {[0.5, 1, 0.7, 0.9].map((h, i) => (
        <span
          key={i}
          style={{
            width: small ? 3 : 4,
            height: (small ? 14 : 21) * h,
            background: "#fff",
            borderRadius: 2,
            animation: `hosBar 0.${5 + i}s ease-in-out infinite alternate`,
          }}
        />
      ))}
      <style>{"@keyframes hosBar{from{transform:scaleY(0.45)}to{transform:scaleY(1)}}"}</style>
    </div>
  );
}

const hudPill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  background: "rgba(255,255,255,0.92)",
  color: colors.textPrimary,
  borderRadius: "999px",
  padding: "0.4rem 0.8rem",
  fontWeight: 800,
  boxShadow: "0 3px 0 rgba(0,0,0,0.12)",
};

const hearButton: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 900,
  padding: "0.65rem 1rem",
  borderRadius: "14px",
  border: "none",
  background: colors.greenButton,
  boxShadow: `0 4px 0 ${colors.greenButtonShadow}`,
  color: colors.white,
  whiteSpace: "nowrap",
  cursor: "pointer",
  touchAction: "manipulation",
};

const overlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(43,43,43,0.35)",
  padding: "16px",
  zIndex: 5,
};

const panel: React.CSSProperties = {
  background: colors.background,
  color: colors.textPrimary,
  borderRadius: "20px",
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
