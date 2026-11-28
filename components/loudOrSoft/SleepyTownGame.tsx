"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SvgPuppet from "@/components/characters/SvgPuppet";
import { DEFAULT_CHARACTER, type CharacterChoice } from "@/components/characters/choice";
import type { State as PuppetState } from "@/components/characters/pose";
import { ExitButton, LeaveConfirm, PauseButton, useGameExit } from "@/components/GameExit";
import { RotateDeviceOverlay, usePhonePortrait, useShortLandscape } from "@/components/RotateDevice";
import { getAudioContext, playFeedback, unlockNoteAudio } from "@/lib/playNote";
import { colors } from "@/lib/theme";
import {
  ANSWER_INFO,
  LEVELS,
  LOUDNESS_RANK,
  QUESTION_TEXT,
  REACT_SECONDS,
  REFERENCE_GAP,
  ROUND_LENGTH,
  SETTLE_SECONDS,
  SHOW_LEAD_SECONDS,
  answersFor,
  buildRound,
  dbAt,
  render,
  starsFor,
  wakeAt,
  type Answer,
  type DynLevel,
  type Question,
  type Rendered,
} from "@/lib/loudOrSoft/music";
import { AnswerIcon, Hairpin } from "./icons";
import { TownPlayer } from "./player";
import { DECORATION_COUNT, PARTY_AT, SIDEWALK_Y, TOWN_CSS, Town, VH, VW, type CatMood } from "./Town";

// One round of Sleepy Town (Loud or Soft): 10 pieces. For each, a short
// "normal tune" (the piece's opening at mezzo-forte) plays, then the piece;
// the town stays asleep while the child listens (nothing gives the answer
// away). The child chooses: Tiptoe (soft), Drum (loud), and so on. Then the
// piece plays again and the town follows the music: soft, the character
// tiptoes past the sleeping houses; loud, a drum, lights on, fireworks and
// dancing; a crescendo wakes the houses one by one. Right: a new bulb on
// the garland and a new decoration. Wrong: a gentle funny reaction (the
// grumpy cat wakes up, or the party fizzles), then the right version.

type Phase = "ready" | "playing" | "paused" | "over";
type Step = "listen" | "ask" | "react" | "show" | "settle";
type Hearing = "reference" | "gap" | "piece" | null;
type Mode = "idle" | "tiptoe" | "walk" | "drum";

// One answered piece, as the server checks it (lib/sharedGameCheck.ts):
// the piece as it was played, and the child's answer.
export interface LoudOrSoftAnswer {
  melody: string;
  dynamic: Answer;
  bpm: number;
  transpose: number;
  repeats: number;
  picked: Answer;
}

const START_X = 380; // where the character starts (town units)
const END_X = 1380;
const SPEED: Record<Mode, number> = { idle: 0, tiptoe: 95, walk: 170, drum: 0 }; // town units a second

export default function SleepyTownGame({
  level,
  markings,
  character = DEFAULT_CHARACTER,
  autoStart = false,
  onChangeSettings,
  onRunStart,
  onRunEnd,
  exitLabel = "Change settings",
  endNote,
}: {
  level: DynLevel;
  markings: boolean;
  character?: CharacterChoice;
  autoStart?: boolean;
  onChangeSettings: () => void;
  // Called as each round starts (an assigned game asks the server for a
  // run id here) and when all 10 pieces are done (only whole rounds count).
  onRunStart?: () => void;
  onRunEnd?: (answers: LoudOrSoftAnswer[]) => void;
  // The button that leaves the game ("Change settings"; "Back" when the
  // teacher chose the settings).
  exitLabel?: string;
  // Shown on the round-complete panel (e.g. "Saved! Your best: 90%").
  endNote?: React.ReactNode;
}) {
  const compact = useShortLandscape();
  const phonePortrait = usePhonePortrait();
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1024, h: 768 });

  const [phase, setPhaseState] = useState<Phase>("ready");
  const phaseRef = useRef<Phase>("ready");
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [step, setStepState] = useState<Step>("listen");
  const stepRef = useRef<Step>("listen");
  const setStep = (s: Step) => {
    stepRef.current = s;
    setStepState(s);
  };

  const [round, setRound] = useState<Question[]>(() => buildRound(level));
  const roundRef = useRef(round);
  roundRef.current = round;
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const resultsRef = useRef<boolean[]>([]);
  const answersRef = useRef<LoudOrSoftAnswer[]>([]);
  const onRunEndRef = useRef(onRunEnd);
  onRunEndRef.current = onRunEnd;
  const onRunStartRef = useRef(onRunStart);
  onRunStartRef.current = onRunStart;
  const [correct, setCorrect] = useState(0);
  const [choice, setChoice] = useState<Answer | null>(null);
  const choiceRef = useRef<Answer | null>(null);
  const [hearing, setHearing] = useState<Hearing>(null);
  const [heardOnce, setHeardOnce] = useState(false);
  const [wake, setWakeState] = useState(0);
  const wakeRef = useRef(0);
  const setWake = (v: number) => {
    const q = Math.round(v * 20) / 20;
    if (q !== wakeRef.current) {
      wakeRef.current = q;
      setWakeState(q);
    }
  };
  const [cat, setCat] = useState<CatMood | undefined>();
  const [fizzle, setFizzle] = useState(0);
  const [mode, setModeState] = useState<Mode>("idle");
  const modeRef = useRef<Mode>("idle");
  const setMode = (m: Mode) => {
    if (m !== modeRef.current) {
      modeRef.current = m;
      setModeState(m);
    }
  };
  const [reaction, setReaction] = useState<{ state: PuppetState; key: number } | undefined>();
  const keyRef = useRef(0);
  const react = (state: PuppetState) => setReaction({ state, key: ++keyRef.current });
  const [noAudio, setNoAudio] = useState(false);

  const player = useRef<TownPlayer | null>(null);
  if (!player.current) player.current = new TownPlayer();
  const rendered = useRef<Rendered | null>(null);
  // The piece playing in the show step: its start on the audio clock.
  const show = useRef<{ pieceStart: number; end: number } | null>(null);
  const timers = useRef<number[]>([]);
  const later = (seconds: number, f: () => void) => {
    timers.current.push(window.setTimeout(f, seconds * 1000));
  };
  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  const charX = useRef(START_X);
  const charRef = useRef<HTMLDivElement>(null);

  // --- layout ------------------------------------------------------------------
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w, h } = size;
  const portrait = h > w;
  // Upright tablets: the whole town fits across, with the street running
  // on below it under the answers.
  const groundPad = portrait ? Math.min(220, h * 0.2) : 0;
  const sceneH = h - groundPad;
  // Upright: the middle 1150 units across (the far edges of the outer
  // houses are cut), the sky running on above.
  const s = portrait ? Math.min(w / 1150, sceneH / VH) : Math.max(w / VW, h / VH);
  const toX = (x: number) => w / 2 + (x - VW / 2) * s;
  const toY = (y: number) => sceneH - (VH - y) * s;
  const charW = Math.max(70, Math.min(compact ? 92 : 170, 165 * s));
  const geom = useRef({ toX, toY });
  geom.current = { toX, toY };
  const placeChar = useCallback(() => {
    const el = charRef.current;
    if (el) el.style.left = `${geom.current.toX(charX.current)}px`;
  }, []);
  useEffect(() => placeChar(), [placeChar, w, h, s]);

  // --- questions -----------------------------------------------------------------
  // Plays the normal tune, then the piece. The town stays asleep.
  const listen = useCallback((i: number, again = false) => {
    clearTimers();
    const q = roundRef.current[i];
    const r = rendered.current && again ? rendered.current : render(q);
    rendered.current = r;
    if (!again) {
      indexRef.current = i;
      setIndex(i);
      choiceRef.current = null;
      setChoice(null);
      setHeardOnce(false);
      setCat(undefined);
      setWake(0);
      setMode("idle");
      if (charX.current > END_X - 300) {
        charX.current = START_X;
        placeChar();
      }
    }
    setStep(again ? "ask" : "listen");
    setHearing("reference");
    const playing = player.current!.play(r, {
      withReference: true,
      gap: REFERENCE_GAP,
      onPiece: () => setHearing("piece"),
      onEnd: () => {
        setHearing(null);
        setHeardOnce(true);
        if (stepRef.current === "listen") setStep("ask");
      },
    });
    if (!playing) {
      setNoAudio(true);
      return;
    }
    const c = getAudioContext();
    if (c && playing.referenceStart !== null) later(playing.referenceStart + r.reference.seconds - c.currentTime, () => setHearing((x) => (x === "reference" ? "gap" : x)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hearAgain = () => {
    if (phaseRef.current !== "playing" || stepRef.current !== "ask" || hearing) return;
    unlockNoteAudio();
    listen(indexRef.current, true);
  };

  // The piece again, with the town following it.
  const startShow = useCallback(() => {
    const r = rendered.current;
    if (!r) return;
    clearTimers();
    setCat(undefined);
    setStep("show");
    const playing = player.current!.play(r, {
      withReference: false,
      gap: 0,
      lead: SHOW_LEAD_SECONDS,
      onEnd: () => {
        show.current = null;
        setStep("settle");
        setMode("idle");
        later(0.5, () => {
          setWake(0);
          setCat(undefined);
        });
        later(SETTLE_SECONDS, () => {
          const next = indexRef.current + 1;
          if (next >= ROUND_LENGTH) {
            setPhase("over");
            setWake(1.3);
            react("happy");
            onRunEndRef.current?.([...answersRef.current]);
          } else listen(next);
        });
      },
    });
    if (!playing) {
      setNoAudio(true);
      return;
    }
    show.current = { pieceStart: playing.pieceStart, end: playing.end };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listen]);

  const answer = (a: Answer) => {
    if (phaseRef.current !== "playing" || stepRef.current !== "ask" || exitRef.current?.askingRef.current) return;
    unlockNoteAudio();
    player.current!.stop();
    clearTimers();
    setHearing(null);
    const q = roundRef.current[indexRef.current];
    const right = a === q.answer;
    choiceRef.current = a;
    setChoice(a);
    resultsRef.current = [...resultsRef.current, right];
    answersRef.current = [
      ...answersRef.current,
      { melody: q.melody.id, dynamic: q.answer, bpm: q.bpm, transpose: q.transpose, repeats: q.repeats, picked: a },
    ];
    const n = resultsRef.current.filter(Boolean).length;
    setCorrect(n);
    playFeedback(right ? "correct" : "wrong");
    if (right) {
      react("happy");
      startShow();
      return;
    }
    // Wrong: a gentle funny moment first, then the right version.
    react("shrug");
    setStep("react");
    if (LOUDNESS_RANK[a] > LOUDNESS_RANK[q.answer]) setCat("grumpy");
    else setFizzle((k) => k + 1);
    later(REACT_SECONDS, () => startShow());
  };

  // --- the frame loop: the town and the character follow the music -------------------
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    let last = performance.now();
    let nextCheer = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const c = getAudioContext();
      const sh = show.current;
      if (stepRef.current === "show" && sh && c && rendered.current) {
        const t = c.currentTime - sh.pieceStart;
        const level = wakeAt(dbAt(rendered.current.piece.envelope, Math.max(0, t)));
        setWake(level);
        const m: Mode = level >= PARTY_AT ? "drum" : level >= 0.35 ? "walk" : "tiptoe";
        setMode(m);
        if (m === "drum" && now > nextCheer) {
          nextCheer = now + 950;
          react("happy");
        }
        if (t > 0 && SPEED[m] > 0 && charX.current < END_X) {
          charX.current = Math.min(END_X, charX.current + SPEED[m] * dt);
          placeChar();
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, placeChar]);

  // --- start / pause / resume ----------------------------------------------------------
  const startRound = useCallback(() => {
    unlockNoteAudio();
    const fresh = buildRound(level);
    roundRef.current = fresh;
    setRound(fresh);
    resultsRef.current = [];
    answersRef.current = [];
    onRunStartRef.current?.();
    setCorrect(0);
    charX.current = START_X;
    placeChar();
    setPhase("playing");
    listen(0);
  }, [level, listen, placeChar]);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    player.current!.stop();
    clearTimers();
    show.current = null;
    setPhase("paused");
  }, []);

  // Resuming replays what was interrupted: the question (from the normal
  // tune), or the right version, or moves on to the next piece.
  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    unlockNoteAudio();
    setPhase("playing");
    const st = stepRef.current;
    if (st === "react" || st === "show") startShow();
    else if (st === "settle") {
      setWake(0);
      const next = indexRef.current + 1;
      if (next >= ROUND_LENGTH) {
        setPhase("over");
        setWake(1.3);
        onRunEndRef.current?.([...answersRef.current]);
      } else listen(next);
    } else listen(indexRef.current);
  }, [listen, startShow]);

  const exit = useGameExit({
    pause: () => pause(),
    resume: () => resume(),
    inRun: () => phaseRef.current === "playing" || phaseRef.current === "paused",
  });
  const exitRef = useRef(exit);
  exitRef.current = exit;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __sleepyTown?: unknown }).__sleepyTown = {
        question: () => roundRef.current[indexRef.current],
        index: () => indexRef.current,
        step: () => stepRef.current,
        phase: () => phaseRef.current,
        results: () => resultsRef.current,
        wake: () => wakeRef.current,
        mode: () => modeRef.current,
        rendered: () => rendered.current,
        go: (i: number) => listen(i),
      };
    }
    if (autoStart) startRound();
    return () => {
      player.current?.stop();
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phones: landscape only (pause while held upright). Hidden tab: pause.
  const rotatePaused = useRef(false);
  useEffect(() => {
    if (phonePortrait) {
      if (phaseRef.current === "playing") {
        pause();
        rotatePaused.current = true;
      }
    } else if (rotatePaused.current) {
      rotatePaused.current = false;
      resume();
    }
  }, [phonePortrait, pause, resume]);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [pause]);

  // Keyboard: P / Esc pause and resume.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (exit.askingRef.current) return;
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        if (phaseRef.current === "playing") pause();
        else if (phaseRef.current === "paused") resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pause, resume, exit.askingRef]);

  // --- drawing ------------------------------------------------------------------------------
  const q = round[index];
  const over = phase === "over";
  const right = choice !== null && q && choice === q.answer;
  const stars = starsFor(correct);
  const options = q ? answersFor(level, q.kind) : [];
  const decorations = Math.min(DECORATION_COUNT, correct);
  const markOf = (a: Answer) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={markStyle}>{ANSWER_INFO[a].mark}</span>
      {ANSWER_INFO[a].hairpin && <Hairpin dir={ANSWER_INFO[a].hairpin!} height={compact ? 10 : 13} />}
    </span>
  );
  // Under each answer: phones always show the short marking; tablets show
  // the word, and the marking too when markings are on.
  const subOf = (a: Answer) =>
    compact ? (
      markOf(a)
    ) : (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span>{ANSWER_INFO[a].word}</span>
        {markings && markOf(a)}
      </span>
    );
  const wordOf = (a: Answer) => (markings ? `${ANSWER_INFO[a].word} (${ANSWER_INFO[a].mark})` : ANSWER_INFO[a].word);
  const louderGuess = choice !== null && q && LOUDNESS_RANK[choice] > LOUDNESS_RANK[q.answer];
  const btnH = compact ? 56 : 86;
  const answersBottom = compact ? 8 : portrait ? Math.max(16, groundPad / 2 - btnH / 2) : 22;
  const charY = toY(SIDEWALK_Y);
  const busy = phase === "playing" && (step === "listen" || step === "ask");

  return (
    <div ref={rootRef} style={{ position: "fixed", inset: 0, overflow: "hidden", userSelect: "none", WebkitUserSelect: "none", fontFamily: "inherit", background: "#262A5C" }}>
      <style>{`
        ${TOWN_CSS}
        @keyframes st-tiptoe { 0%,100% { transform: translate(-50%, -100%) rotate(0) } 50% { transform: translate(-50%, calc(-100% - 6px)) rotate(-3deg) } }
        @keyframes st-walk { 0%,100% { transform: translate(-50%, -100%) } 50% { transform: translate(-50%, calc(-100% - 10px)) } }
        @keyframes st-stick { 0%,100% { transform: rotate(0) } 50% { transform: rotate(-24deg) } }
        @keyframes st-in { 0% { opacity: 0; transform: translateY(6px) } 100% { opacity: 1; transform: none } }
      `}</style>

      <div style={portrait ? { position: "absolute", left: w / 2 - (VW / 2) * s, width: VW * s, top: sceneH - VH * s, height: VH * s } : { position: "absolute", left: 0, right: 0, top: 0, height: sceneH }}>
        <Town wake={wake} decorations={decorations} cat={cat} fizzle={fizzle} compact={compact} portrait={portrait} />
      </div>
      {groundPad > 0 && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: groundPad + 2, background: "#4C4A6E" }} />}

      {/* the character on the sidewalk */}
      <div
        ref={charRef}
        style={{
          position: "absolute",
          left: toX(charX.current),
          top: charY,
          width: charW,
          transform: "translate(-50%, -100%)",
          animation: mode === "tiptoe" ? "st-tiptoe 0.7s ease-in-out infinite" : mode === "walk" ? "st-walk 0.42s ease-in-out infinite" : undefined,
          zIndex: 1,
          pointerEvents: "none",
        }}
      >
        <SvgPuppet choice={character} state="idle" reaction={reaction} style={{ width: "100%", height: "auto", display: "block" }} />
        {(mode === "drum" || (over && wake >= PARTY_AT)) && (
          <div style={{ position: "absolute", left: "64%", bottom: "0%", width: "62%" }}>
            <Drum />
          </div>
        )}
        {phase === "playing" && step === "react" && (
          <Bubble key={`b${index}`} text={louderGuess ? "Oops… shhh!" : "Oh no… pfft!"} color={colors.coralText} compact={compact} />
        )}
      </div>

      {/* top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "max(10px, env(safe-area-inset-top)) 12px 0", zIndex: 3, pointerEvents: "none" }}>
        <div style={{ display: "flex", flexDirection: compact ? "row" : "column", gap: 6, alignItems: "flex-start" }}>
          <div style={{ ...pill, flexDirection: "column", alignItems: "flex-start", gap: 0 }} aria-label={`Piece ${Math.min(index + 1, ROUND_LENGTH)} of ${ROUND_LENGTH}`}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: compact ? "0.95rem" : "1.05rem" }}>
              <MoonIcon size={compact ? 18 : 22} /> {Math.min(index + 1, ROUND_LENGTH)} / {ROUND_LENGTH}
            </span>
            {!compact && <span style={{ fontSize: "0.72rem", fontWeight: 800, opacity: 0.6 }}>Loud or Soft · {LEVELS[level].label}</span>}
          </div>
          {!compact && (
            <div style={{ ...pill, fontSize: "1.05rem" }} aria-label={`${correct} lights`}>
              <BulbIcon size={22} /> × {correct}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", pointerEvents: "auto" }}>
          {phase === "playing" && <PauseButton onClick={pause} compact={compact} />}
          <ExitButton onClick={exit.ask} compact={compact} />
        </div>
      </div>

      {/* the card: listen, then what happened */}
      {phase === "playing" && q && (
        <div
          style={{
            position: "absolute",
            top: compact ? "max(8px, env(safe-area-inset-top))" : "max(14px, env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            width: "max-content",
            maxWidth: compact ? "calc(100vw - 250px)" : w < 760 ? "calc(100vw - 24px)" : "calc(100vw - 320px)",
            marginTop: !compact && w < 760 ? 110 : 0,
            background: colors.white,
            color: colors.textPrimary,
            borderRadius: compact ? 18 : 22,
            padding: compact ? "6px 12px" : "10px 18px",
            boxShadow: "0 4px 0 rgba(0,0,0,0.25)",
            display: "flex",
            alignItems: "center",
            gap: compact ? 10 : 14,
            zIndex: 2,
            boxSizing: "border-box",
          }}
        >
          {busy ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                <div style={{ fontWeight: 900, fontSize: compact ? "1rem" : "1.3rem", color: colors.blueText }}>
                  {step === "listen" ? "Listen…" : ""} {QUESTION_TEXT[q.kind][level]}
                </div>
                <Steps compact={compact} hearing={hearing} heard={heardOnce} />
              </div>
              {step === "ask" && (
                <button type="button" onClick={hearAgain} disabled={!!hearing} style={{ ...hearButton(compact), opacity: hearing ? 0.55 : 1 }}>
                  🔊 Hear again
                </button>
              )}
            </>
          ) : choice !== null ? (
            <div key={`r${index}${step === "react"}`} style={{ display: "flex", alignItems: "center", gap: 10, animation: "st-in 0.3s ease-out" }}>
              <AnswerIcon answer={q.answer} size={compact ? 34 : 48} />
              <div>
                <div style={{ fontWeight: 900, fontSize: compact ? "1rem" : "1.3rem", color: right ? "#2E9E5B" : colors.coralText }}>
                  {right
                    ? `Yes! ${RIGHT_LINE[q.answer]}`
                    : `Oops! The music was ${wordOf(q.answer)}. ${louderGuess ? "You woke the grumpy cat!" : "The party fizzled!"}`}
                </div>
                <div style={{ fontWeight: 700, fontSize: compact ? "0.78rem" : "0.9rem", opacity: 0.65 }}>
                  {right ? (markings ? `${ANSWER_INFO[q.answer].mark} = ${ANSWER_INFO[q.answer].word}. A new light for the town!` : "A new light for the town!") : step === "react" ? "Listen to it once more…" : `This is ${ANSWER_INFO[q.answer].word}: listen to the town.`}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* the answers */}
      {phase === "playing" && q && (step === "listen" || step === "ask" || choice !== null) && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: `max(${answersBottom}px, env(safe-area-inset-bottom))`, display: "flex", justifyContent: "center", gap: compact ? 10 : 20, zIndex: 2, padding: "0 12px" }}>
          {options.map((a) => (
            <AnswerButton
              key={a}
              answer={a}
              title={ANSWER_INFO[a].title}
              sub={subOf(a)}
              compact={compact}
              count={options.length}
              disabled={step !== "ask"}
              dim={step === "listen" || (choice !== null && a !== choice && a !== q.answer)}
              state={choice === null ? null : a === q.answer ? "right" : a === choice ? "wrong" : null}
              onClick={() => answer(a)}
            />
          ))}
        </div>
      )}

      {/* ready / paused / round complete */}
      {phase !== "playing" && !exit.asking && (
        <div style={over ? endWrap(compact) : overlay}>
          <div style={panel(compact)}>
            {phase === "ready" && (
              <>
                <h1 style={{ margin: 0, fontSize: "1.7rem", fontWeight: 900 }}>Sleepy Town</h1>
                <p style={{ margin: 0, fontWeight: 700, opacity: 0.7 }}>Loud or Soft · {LEVELS[level].label}</p>
                <button type="button" onClick={startRound} style={primaryButton}>
                  Start
                </button>
                <button type="button" onClick={onChangeSettings} style={secondaryButton}>
                  {exitLabel}
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
            {over && (
              <>
                <h2 style={{ margin: 0, fontSize: compact ? "1.25rem" : "1.7rem", fontWeight: 900 }}>{correct >= 6 ? "What a party!" : "Sleepy Town says thank you!"}</h2>
                <div style={{ fontSize: compact ? "1.8rem" : "2.6rem", letterSpacing: "0.1em", lineHeight: 1 }} aria-label={`${stars} of 3 stars`}>
                  {[1, 2, 3].map((n) => (
                    <span key={n} style={n > stars ? { filter: "grayscale(1)", opacity: 0.3 } : undefined}>
                      ⭐
                    </span>
                  ))}
                </div>
                <div style={{ fontWeight: 800 }}>
                  {correct} {correct === 1 ? "light" : "lights"} for the town · {correct} of {ROUND_LENGTH} right
                </div>
                {endNote}
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button type="button" onClick={startRound} style={{ ...primaryButton, flex: 1 }}>
                    Play again
                  </button>
                  <button type="button" onClick={onChangeSettings} style={{ ...secondaryButton, flex: 1 }}>
                    {exitLabel}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {noAudio && (
        <div style={overlay}>
          <div style={panel(compact)}>
            <p style={{ margin: 0, fontWeight: 700 }}>This browser can&apos;t play the music, so Sleepy Town can&apos;t run here.</p>
            <button type="button" onClick={onChangeSettings} style={secondaryButton}>
              Back
            </button>
          </div>
        </div>
      )}

      {exit.asking && <LeaveConfirm onStay={exit.stay} onLeave={exit.leave} />}
      {phonePortrait && <RotateDeviceOverlay />}
    </div>
  );
}

const RIGHT_LINE: Record<Answer, string> = {
  pp: "Very soft: not a whisker moved.",
  p: "Soft: nobody woke up.",
  mf: "Medium: a few lights come on.",
  f: "Loud: everyone wakes up to dance!",
  ff: "Very loud: fireworks everywhere!",
  cresc: "Getting louder: the town wakes up!",
  dim: "Getting softer: the town falls asleep.",
  "subito-f": "Suddenly loud: surprise!",
  "subito-p": "Suddenly soft: hush!",
};

// "Normal tune → Now this one": the two parts of each question.
function Steps({ compact, hearing, heard }: { compact: boolean; hearing: Hearing; heard: boolean }) {
  const refDone = heard || hearing === "gap" || hearing === "piece";
  const pieceDone = heard && hearing === null;
  const pillStyle = (on: boolean, done: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: compact ? "1px 8px" : "3px 10px",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: compact ? 12 : 14,
    background: on ? "#FFE9A8" : done ? "#E3F5DA" : "#F0EEF6",
    color: colors.textPrimary,
    opacity: on || done ? 1 : 0.6,
    whiteSpace: "nowrap",
  });
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={pillStyle(hearing === "reference", refDone && hearing !== "reference")}>{refDone && hearing !== "reference" ? "✓" : "♪"} Normal tune</span>
      <span style={{ fontWeight: 900, opacity: 0.45 }}>→</span>
      <span style={pillStyle(hearing === "piece", pieceDone)}>{pieceDone ? "✓" : "♪"} Now this one</span>
    </div>
  );
}

function AnswerButton({
  answer,
  title,
  sub,
  compact,
  count,
  disabled,
  dim,
  state,
  onClick,
}: {
  answer: Answer;
  title: string;
  sub: React.ReactNode;
  compact: boolean;
  count: number;
  disabled: boolean;
  dim: boolean;
  state: "right" | "wrong" | null;
  onClick: () => void;
}) {
  const ring = state === "right" ? "#2E9E5B" : state === "wrong" ? colors.coralText : "#2B2745";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${title}: ${ANSWER_INFO[answer].word}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? 8 : 12,
        flex: count > 3 ? "1 1 0" : "0 1 auto",
        minWidth: 0,
        maxWidth: compact ? 200 : 270,
        minHeight: compact ? 56 : 86,
        padding: compact ? "4px 12px 4px 6px" : "10px 22px 10px 12px",
        borderRadius: 22,
        border: `${state ? 5 : 4}px solid ${ring}`,
        background: "#FFFFFF",
        boxShadow: `0 ${compact ? 4 : 6}px 0 rgba(0,0,0,0.3)`,
        color: "#2B2745",
        cursor: disabled ? "default" : "pointer",
        justifyContent: "flex-start",
        opacity: dim ? 0.5 : 1,
        fontFamily: "inherit",
        transition: "opacity .2s",
      }}
    >
      <AnswerIcon answer={answer} size={compact ? 42 : 60} />
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1, minWidth: 0 }}>
        <span style={{ fontWeight: 900, fontSize: compact ? 17 : 24, whiteSpace: "nowrap" }}>{title}</span>
        <span style={{ fontWeight: 800, fontSize: compact ? 15 : 17, opacity: 0.7, whiteSpace: "nowrap" }}>{sub}</span>
      </span>
    </button>
  );
}

function Bubble({ text, color, compact }: { text: string; color: string; compact: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: compact ? "-26%" : "-18%",
        transform: "translateX(-50%)",
        background: "#FFFFFF",
        color,
        fontWeight: 900,
        fontSize: compact ? 14 : 20,
        padding: "0.2em 0.7em",
        borderRadius: 999,
        boxShadow: `0 0 0 3px ${color}, 0 4px 0 rgba(0,0,0,0.12)`,
        whiteSpace: "nowrap",
        animation: "st-in 0.3s ease-out",
      }}
    >
      {text}
    </div>
  );
}

function Drum() {
  return (
    <svg viewBox="0 -24 130 124" style={{ width: "100%", display: "block", overflow: "visible" }} aria-hidden="true">
      <g stroke="#2B2745" strokeWidth={5} strokeLinejoin="round">
        <path d="M14,30 L14,80 Q60,98 106,80 L106,30 Z" fill="#E2504C" />
        <path d="M14,40 L36,78 L60,40 L84,78 L106,40" fill="none" stroke="#FFE27A" strokeWidth={5} />
        <ellipse cx={60} cy={30} rx={46} ry={14} fill="#F7EEDC" />
        <g style={{ transformOrigin: "112px -10px", animation: "st-stick 0.32s ease-in-out infinite" }}>
          <line x1={74} y1={24} x2={112} y2={-10} strokeWidth={6} strokeLinecap="round" />
          <circle cx={74} cy={24} r={7} fill="#FFFFFF" />
        </g>
      </g>
    </svg>
  );
}

function MoonIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M15,3 A9,9 0 1 0 21,15 A7.5,7.5 0 1 1 15,3 Z" fill="#FFD24A" stroke="#2B2745" strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}

function BulbIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx={12} cy={13} r={10} fill="#FFD24A" opacity={0.35} />
      <rect x={9} y={3} width={6} height={4} fill="#2B2745" />
      <ellipse cx={12} cy={13.5} rx={5.5} ry={7} fill="#FFD24A" stroke="#2B2745" strokeWidth={1.8} />
    </svg>
  );
}

const markStyle: React.CSSProperties = { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontWeight: 900 };

const pill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  background: "rgba(255,255,255,0.92)",
  color: colors.textPrimary,
  borderRadius: "16px",
  padding: "0.35rem 0.75rem",
  fontWeight: 800,
  boxShadow: "0 3px 0 rgba(0,0,0,0.2)",
};

const hearButton = (compact: boolean): React.CSSProperties => ({
  fontWeight: 900,
  fontSize: compact ? "0.9rem" : "1rem",
  padding: compact ? "0.35rem 0.75rem" : "0.5rem 0.95rem",
  minHeight: 44,
  borderRadius: 999,
  border: `2px solid ${colors.blueText}`,
  background: colors.blueBackground,
  color: colors.blueText,
  whiteSpace: "nowrap",
  cursor: "pointer",
  fontFamily: "inherit",
});

const overlay: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(20,22,60,0.45)",
  padding: "16px",
  zIndex: 10,
};

// The end screen: the party town stays in view; the card sits in the sky.
const endWrap = (compact: boolean): React.CSSProperties => ({
  position: "absolute",
  left: 0,
  right: 0,
  top: compact ? 54 : "12%",
  display: "flex",
  justifyContent: "center",
  padding: "0 16px",
  zIndex: 10,
});

const panel = (compact: boolean): React.CSSProperties => ({
  background: colors.background,
  color: colors.textPrimary,
  borderRadius: "20px",
  padding: compact ? "0.6rem 1.1rem" : "1.4rem 1.5rem",
  width: "min(400px, 100%)",
  maxHeight: "100%",
  overflowY: "auto",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: compact ? "0.35rem" : "0.75rem",
  textAlign: "center",
  boxShadow: "0 6px 0 rgba(0,0,0,0.2)",
});

const primaryButton: React.CSSProperties = {
  fontSize: "1.1rem",
  fontWeight: 900,
  padding: "0.8rem",
  borderRadius: "14px",
  border: "none",
  background: colors.greenButton,
  boxShadow: `0 4px 0 ${colors.greenButtonShadow}`,
  color: colors.white,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 800,
  padding: "0.7rem",
  borderRadius: "14px",
  border: "2px solid #E3DCCD",
  background: colors.white,
  color: colors.textPrimary,
  cursor: "pointer",
};

