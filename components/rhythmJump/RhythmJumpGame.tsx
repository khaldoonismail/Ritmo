"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SvgPuppet from "@/components/characters/SvgPuppet";
import { DEFAULT_CHARACTER, type CharacterChoice } from "@/components/characters/choice";
import type { State as PuppetState } from "@/components/characters/pose";
import { ExitButton, LeaveConfirm, PauseButton, useGameExit } from "@/components/GameExit";
import { RotateDeviceOverlay, usePhonePortrait, useShortLandscape } from "@/components/RotateDevice";
import { getAudioContext, unlockNoteAudio } from "@/lib/playNote";
import { colors } from "@/lib/theme";
import {
  BETWEEN_SECONDS,
  END_TAIL_SECONDS,
  LEVELS,
  MODE_LABELS,
  PATTERNS_PER_ROUND,
  accuracy,
  bpmFor,
  layoutPattern,
  makeCustomRound,
  makeRound,
  judgeTap,
  padsAhead,
  padsFor,
  START_LEAD_SECONDS,
  starsFor,
  windowsFor,
  type Layout,
  type Pad,
  type Pattern,
  type Rating,
  type RhythmChoice,
  type RhythmLevel,
  type RhythmMode,
  type Tempo,
} from "@/lib/rhythmJump";
import { BeatBus, playTapSound, tapTime } from "./beat";
import { Notation } from "./Notation";
import { LilyPad, PondScenery, Ripple, Splash } from "./Pond";

// One round of Rhythm Jump: 8 rhythm patterns. Each pattern gets a bar of
// count-in on the metronome (Read & Tap shows the notation then, to read it
// before starting), then the child taps each note (screen or Space). The
// pond doesn't give the rhythm away: a lily pad only pops up under the
// character when a note is tapped on time (a missed note's pad floats by
// grey); a tap on a rest or a wrong tap is a splash. In Read & Tap the
// playing note is orange in the notation. In Listen & Echo the rhythm is
// played first with no notation, then tapped back, and the notation is
// shown afterwards. Listen & Echo patterns are one bar (two are too much to
// remember), and "🔊 Hear again" (once per pattern, before the child's
// turn) plays it a second time: the pattern restarts from its count-in. Practice (Easy only) shows the pads coming in
// advance, reaching a dashed ring, for absolute beginners.
//
// Timing: every sound is scheduled on the audio clock when the pattern
// starts (./beat.ts), and taps are judged against that same clock using
// the touch's own timestamp, minus this device's measured delay
// (calibration, lib/rhythmJump.ts). No server, no timers in the judging.

type Phase = "ready" | "playing" | "paused" | "over";
type Step = "listen" | "countin" | "tap" | "between";
type PadState = "upcoming" | "hit" | "miss";

interface Run {
  index: number;
  pattern: Pattern;
  layout: Layout;
  pads: Pad[];
  wins: { perfect: number; good: number }[];
  spb: number;
  first: number; // audio time of the first click
  countStart: number; // the tap phase's count-in bar
  t0: number; // the pattern's first beat (tap phase)
  end: number;
  echo: boolean;
  results: (Rating | null)[];
  splashes: number;
  // Every judged tap's time from t0 (device delay taken off), in order.
  taps: number[];
  bus: BeatBus;
  finished: boolean;
}

// One finished pattern, as the server checks it (lib/sharedGameCheck.ts):
// the rhythm, and the taps the server judges again.
export interface RhythmJumpAnswer {
  meter: number;
  bars: Pattern["bars"];
  taps: number[];
}

interface Totals {
  ratings: Rating[];
  splashes: number;
}

const RATING_TEXT: Record<Rating, { text: string; color: string }> = {
  perfect: { text: "Perfect!", color: "#2E9E5B" },
  good: { text: "Good", color: colors.blueText },
  miss: { text: "Miss", color: colors.coralText },
};

export default function RhythmJumpGame({
  level,
  custom = null,
  mode,
  tempo,
  syllables,
  practice = false,
  delayMs,
  character = DEFAULT_CHARACTER,
  autoStart = false,
  onChangeSettings,
  onRunStart,
  onRunEnd,
  exitLabel = "Change settings",
  endNote,
}: {
  // How fast and forgiving it plays (a custom choice's nearest level).
  level: RhythmLevel;
  // The teacher's own rhythm choice; null = the level's own patterns.
  custom?: RhythmChoice | null;
  mode: RhythmMode;
  tempo: Tempo;
  syllables: boolean;
  // Practice: lily pads shown in advance (Easy only).
  practice?: boolean;
  // This device's measured delay (calibration), in ms.
  delayMs: number;
  character?: CharacterChoice;
  autoStart?: boolean;
  onChangeSettings: () => void;
  // Called as each round starts (an assigned game asks the server for a
  // run id here) and when all 8 rhythms are done (only whole rounds count).
  onRunStart?: () => void;
  onRunEnd?: (answers: RhythmJumpAnswer[]) => void;
  // The button that leaves the game ("Change settings"; "Back" when the
  // teacher chose the settings).
  exitLabel?: string;
  // Shown on the round-complete panel (e.g. "Saved! Your best: 92%").
  endNote?: React.ReactNode;
}) {
  const compact = useShortLandscape();
  const phonePortrait = usePhonePortrait();
  const bpm = bpmFor(level, tempo);
  const echo = mode === "echo";
  const ahead = padsAhead(level, practice);
  const levelLabel = custom ? "Custom" : LEVELS[level].label;
  const barCount = echo ? 1 : 2;
  const newRound = () => (custom ? makeCustomRound(custom, Math.random, barCount) : makeRound(level, Math.random, barCount));
  // The pattern whose "Hear again" has been used (it stays used if the
  // pattern restarts after a pause).
  const heardAgainRef = useRef(-1);
  const [heardAgain, setHeardAgain] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1024, h: 768 });

  const [phase, setPhaseState] = useState<Phase>("ready");
  const phaseRef = useRef<Phase>("ready");
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const [round, setRound] = useState<Pattern[]>(newRound);
  const roundRef = useRef(round);
  roundRef.current = round;
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const runRef = useRef<Run | null>(null);
  const totalsRef = useRef<Totals>({ ratings: [], splashes: 0 });
  const answersRef = useRef<RhythmJumpAnswer[]>([]);
  const onRunEndRef = useRef(onRunEnd);
  onRunEndRef.current = onRunEnd;
  const onRunStartRef = useRef(onRunStart);
  onRunStartRef.current = onRunStart;
  const endRound = () => {
    runRef.current = null;
    setPhase("over");
    onRunEndRef.current?.([...answersRef.current]);
  };
  const endRoundRef = useRef(endRound);
  endRoundRef.current = endRound;
  const [totals, setTotals] = useState<Totals>({ ratings: [], splashes: 0 });
  const nextTimer = useRef<number | null>(null);
  const [noAudio, setNoAudio] = useState(false);

  // What the screen shows (changed only when it changes, from the frame loop).
  const [step, setStep] = useState<Step>("countin");
  const [beatInBar, setBeatInBar] = useState(-1);
  const [current, setCurrent] = useState(-1);
  const [padStates, setPadStates] = useState<PadState[]>([]);
  const [pinned, setPinned] = useState(-1); // the pad the character stands on (-1 = the start pad)
  const [splashAt, setSplashAt] = useState<{ element: number; key: number } | null>(null);
  const [bubble, setBubble] = useState<{ text: string; color: string; key: number } | null>(null);
  const [reaction, setReaction] = useState<{ state: PuppetState; key: number } | undefined>(undefined);
  const [wobble, setWobble] = useState(0);
  const keyRef = useRef(0);
  const nextKey = () => ++keyRef.current;

  const layout = useMemo(() => layoutPattern(round[index] ?? round[0]), [round, index]);

  // --- size ----------------------------------------------------------------
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const beatPx = size.w * (compact ? 0.125 : 0.15) * (level === "hard" ? 1.25 : 1);
  const targetPx = size.w * 0.24;
  const waterTop = compact ? 44 : 46;
  const padLine = 72; // % of the height
  const geom = useRef({ beatPx, targetPx });
  geom.current = { beatPx, targetPx };

  // --- running a pattern -----------------------------------------------------
  const clearNext = () => {
    if (nextTimer.current !== null) window.clearTimeout(nextTimer.current);
    nextTimer.current = null;
  };

  const startPattern = useCallback(
    (i: number) => {
      clearNext();
      const c = getAudioContext();
      if (!c) {
        setNoAudio(true);
        return;
      }
      if (c.state !== "running") c.resume().catch(() => {});
      const pattern = roundRef.current[i];
      const lay = layoutPattern(pattern);
      const pads = padsFor(lay, bpm);
      const spb = 60 / bpm;
      const bar = pattern.meter * spb;
      const first = c.currentTime + START_LEAD_SECONDS;
      const listenT0 = echo ? first + bar : null;
      const countStart = echo ? (listenT0 as number) + lay.totalBeats * spb : first;
      const t0 = countStart + bar;
      const end = t0 + lay.totalBeats * spb;
      const bus = new BeatBus(c);
      // The steady beat: every beat from the first count-in to the end,
      // the first beat of each bar a soft drum.
      const beats = Math.round((end - first) / spb);
      for (let k = 0; k < beats; k++) bus.click(first + k * spb, k % pattern.meter === 0);
      if (listenT0 !== null) for (const p of pads) bus.note(listenT0 + p.time, p.beats * spb);
      runRef.current?.bus.cancel();
      runRef.current = {
        index: i,
        pattern,
        layout: lay,
        pads,
        wins: windowsFor(pads, level),
        spb,
        first,
        countStart,
        t0,
        end,
        echo,
        results: pads.map(() => null),
        splashes: 0,
        taps: [],
        bus,
        finished: false,
      };
      indexRef.current = i;
      setIndex(i);
      setHeardAgain(heardAgainRef.current === i);
      setPadStates(pads.map(() => "upcoming"));
      setPinned(-1);
      setSplashAt(null);
      setCurrent(-1);
      setStep(echo ? "listen" : "countin");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bpm, echo, level]
  );

  const finishPattern = useCallback(() => {
    const r = runRef.current;
    if (!r || r.finished) return;
    r.finished = true;
    const results = r.results.map((x) => x ?? "miss");
    const t = { ratings: [...totalsRef.current.ratings, ...results], splashes: totalsRef.current.splashes + r.splashes };
    answersRef.current = [...answersRef.current, { meter: r.pattern.meter, bars: r.pattern.bars, taps: r.taps }];
    totalsRef.current = t;
    setTotals(t);
    setStep("between");
    const allGood = results.every((x) => x !== "miss");
    if (allGood) setReaction({ state: "happy", key: nextKey() });
    const last = r.index >= PATTERNS_PER_ROUND - 1;
    // Listen & Echo shows the notation it just played, so a little longer.
    nextTimer.current = window.setTimeout(
      () => {
        nextTimer.current = null;
        if (phaseRef.current !== "playing") return;
        if (last) endRoundRef.current();
        else startPattern(r.index + 1);
      },
      BETWEEN_SECONDS[r.echo ? "echo" : "read"] * 1000
    );
  }, [startPattern]);

  // The frame loop: scrolls the pond, follows the beat, marks misses.
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    let lastStep: Step | null = null;
    let lastBeat = -2;
    let lastCurrent = -2;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const r = runRef.current;
      const c = getAudioContext();
      if (!r || !c) return;
      const now = c.currentTime;
      const b = (now - r.t0) / r.spb;
      const { beatPx: bp, targetPx: tp } = geom.current;
      if (scrollRef.current) scrollRef.current.style.transform = `translate3d(${(tp - b * bp).toFixed(1)}px,0,0)`;
      if (r.finished) return;

      const s: Step = r.echo && now < r.countStart ? "listen" : now < r.t0 ? "countin" : "tap";
      if (s !== lastStep) {
        lastStep = s;
        setStep(s);
      }
      const beatNo = now < r.first ? -1 : Math.floor((now - r.first) / r.spb + 1e-6) % r.pattern.meter;
      if (beatNo !== lastBeat) {
        lastBeat = beatNo;
        setBeatInBar(beatNo);
      }
      let cur = -1;
      if (s === "tap") cur = r.layout.elements.findIndex((e) => b >= e.start && b < e.start + e.beats);
      if (cur !== lastCurrent) {
        lastCurrent = cur;
        setCurrent(cur);
      }
      // A note whose window has passed with no tap: missed.
      const heard = now - delayMs / 1000 - r.t0;
      r.pads.forEach((p, i) => {
        if (r.results[i] === null && heard > p.time + r.wins[i].good) {
          r.results[i] = "miss";
          setPadStates((ps) => ps.map((x, j) => (j === i ? "miss" : x)));
          setBubble({ ...RATING_TEXT.miss, key: nextKey() });
          setWobble(nextKey());
          playTapSound("wobble");
        }
      });
      if (heard > r.end - r.t0 + END_TAIL_SECONDS && r.results.every((x) => x !== null)) finishPattern();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, delayMs, finishPattern]);

  // --- taps ------------------------------------------------------------------
  const onTap = useCallback(
    (timeStamp: number) => {
      if (phaseRef.current !== "playing" || exitRef.current?.askingRef.current) return;
      const r = runRef.current;
      const c = getAudioContext();
      if (!r || !c || r.finished) return;
      const t = tapTime(c, timeStamp, delayMs);
      const res = judgeTap(t - r.t0, r.layout, r.pads, r.wins, r.results, r.spb);
      if (res.kind === "ignore") return; // count-in, listening, or after the end
      r.taps.push(t - r.t0);
      if (res.kind === "note") {
        const { pad: i, rating, offset } = res;
        r.results[i] = rating;
        setPadStates((ps) => ps.map((x, j) => (j === i ? "hit" : x)));
        setPinned(i);
        setReaction({ state: "hop", key: nextKey() });
        const label = rating === "good" ? `Good · a bit ${offset < 0 ? "early" : "late"}` : RATING_TEXT[rating].text;
        setBubble({ text: label, color: RATING_TEXT[rating].color, key: nextKey() });
        playTapSound(rating === "perfect" ? "perfect" : "good");
        return;
      }
      // A tap on a rest, or where no note is: splash!
      r.splashes++;
      setSplashAt({ element: res.rest ?? -1, key: nextKey() });
      setReaction({ state: "shrug", key: nextKey() });
      setBubble({ text: res.rest !== null ? "Splash! That's a rest" : "Splash! No note there", color: "#3E95C6", key: nextKey() });
      playTapSound("splash");
    },
    [delayMs]
  );

  // --- start / pause / resume ------------------------------------------------
  const startRound = useCallback(() => {
    unlockNoteAudio();
    const fresh = newRound();
    roundRef.current = fresh;
    setRound(fresh);
    totalsRef.current = { ratings: [], splashes: 0 };
    setTotals(totalsRef.current);
    answersRef.current = [];
    onRunStartRef.current?.();
    heardAgainRef.current = -1;
    setPhase("playing");
    startPattern(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, custom, startPattern]);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    clearNext();
    runRef.current?.bus.cancel();
    setPhase("paused");
  }, []);

  // Resuming starts the pattern again from its count-in (its taps so far
  // don't count: half a rhythm can't be judged fairly).
  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    unlockNoteAudio();
    setPhase("playing");
    const r = runRef.current;
    if (r && r.finished && r.index >= PATTERNS_PER_ROUND - 1) endRoundRef.current();
    else startPattern(r ? (r.finished ? r.index + 1 : r.index) : indexRef.current);
  }, [startPattern]);

  // "🔊 Hear again": once per pattern, any time before the child's turn
  // starts. Replays it from a fresh count-in, so the beat stays steady.
  const hearAgain = useCallback(() => {
    const r = runRef.current;
    const c = getAudioContext();
    if (phaseRef.current !== "playing" || !r || !c || !r.echo || r.finished) return;
    if (heardAgainRef.current === r.index || c.currentTime >= r.t0 - 0.05) return;
    unlockNoteAudio();
    heardAgainRef.current = r.index;
    startPattern(r.index);
  }, [startPattern]);

  const exit = useGameExit({
    pause: () => pause(),
    resume: () => resume(),
    inRun: () => phaseRef.current === "playing" || phaseRef.current === "paused",
  });
  const exitRef = useRef(exit);
  exitRef.current = exit;

  useEffect(() => {
    // ?debug exposes the current pattern's timing to automated tests.
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __rhythmJump?: unknown }).__rhythmJump = {
        run: () => runRef.current,
        totals: () => totalsRef.current,
        phase: () => phaseRef.current,
      };
    }
    if (autoStart) startRound();
    return () => {
      clearNext();
      runRef.current?.bus.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phones: landscape only (pause while held upright).
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

  // Pause when the tab or app is hidden.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [pause]);

  // Keyboard: Space taps; P or Esc pauses / resumes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (exit.askingRef.current) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        if (phaseRef.current === "playing") onTap(e.timeStamp);
        else if (phaseRef.current === "paused") resume();
      } else if (e.key === "h" || e.key === "H") {
        hearAgain();
      } else if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        if (phaseRef.current === "playing") pause();
        else if (phaseRef.current === "paused") resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTap, pause, resume, hearAgain, exit.askingRef]);

  // --- drawing ------------------------------------------------------------------
  const run = runRef.current;
  const pads = run && run.index === index ? run.pads : padsFor(layout, bpm);
  const padW = (beats: number) => beatPx * Math.min(beats <= 0.25 ? 0.2 : beats <= 0.5 ? 0.44 : beats < 1.5 ? 0.72 : beats < 2 ? 0.86 : 1.0, 0.9 * beats + 0.1);
  const charW = Math.min(size.h * (compact ? 0.24 : 0.21), size.w * 0.28);
  // Pads in advance only in Practice; otherwise once the pattern is over.
  const showPads = ahead || step === "between";
  const notationVisible = !echo || step === "between";
  const counted = step === "countin" ? beatInBar + 1 : 0;

  const acc = accuracy(totals.ratings, totals.splashes);
  const stars = starsFor(acc);
  const count = (r: Rating) => totals.ratings.filter((x) => x === r).length;

  return (
    <div
      ref={rootRef}
      onPointerDown={(e) => {
        if ((e.target as Element).closest("button, [data-no-tap]")) return;
        if (phase === "playing") {
          e.preventDefault();
          onTap(e.timeStamp);
        }
      }}
      style={{ position: "fixed", inset: 0, overflow: "hidden", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", fontFamily: "inherit" }}
    >
      <style>{`
        @keyframes rj-bubble { 0% { transform: translate(-50%, 6px) scale(.8); opacity: 0 } 15% { transform: translate(-50%, 0) scale(1.05); opacity: 1 } 70% { opacity: 1 } 100% { transform: translate(-50%, -10px); opacity: 0 } }
        @keyframes rj-wobble { 0%,100% { transform: translate(-50%, -92%) rotate(0) } 25% { transform: translate(-50%, -92%) rotate(-9deg) } 50% { transform: translate(-50%, -92%) rotate(7deg) } 75% { transform: translate(-50%, -92%) rotate(-4deg) } }
        @keyframes rj-splash { 0% { transform: translate(-50%, -60%) scale(.4); opacity: 0 } 20% { opacity: 1 } 100% { transform: translate(-50%, -60%) scale(1.1); opacity: 0 } }
        @keyframes rj-pop { 0% { transform: translate(-50%, -50%) scale(.3) } 70% { transform: translate(-50%, -50%) scale(1.08) } 100% { transform: translate(-50%, -50%) scale(1) } }
      `}</style>
      <PondScenery waterTop={waterTop} />

      {/* Practice: the dashed ring (tap when a pad reaches it). */}
      {ahead && <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: targetPx,
          top: `${padLine}%`,
          width: beatPx * 0.8,
          height: beatPx * 0.42,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          border: "3px dashed rgba(255,255,255,0.8)",
        }}
      />}

      {/* Pads and rests, moving with the beat. */}
      <div ref={scrollRef} style={{ position: "absolute", left: 0, top: `${padLine}%`, width: 0, height: 0, willChange: "transform" }}>
        {layout.elements.map((e) => {
          const padIndex = e.rest ? -1 : pads.findIndex((p) => p.element === e.index);
          const st = padIndex >= 0 ? padStates[padIndex] ?? "upcoming" : "upcoming";
          const left = e.start * beatPx;
          if (e.rest) {
            const splashed = splashAt?.element === e.index;
            return (
              <div key={e.index} style={{ position: "absolute", left, top: 0, width: beatPx * 0.6, transform: "translate(-50%, -50%)", opacity: showPads || splashed ? 1 : 0 }}>
                <Ripple />
              </div>
            );
          }
          if (padIndex === pinned) return null;
          const visible = showPads || st === "miss";
          return (
            <div
              key={e.index}
              style={{
                position: "absolute",
                left,
                top: 0,
                width: padW(e.beats),
                transform: "translate(-50%, -50%)",
                opacity: visible ? (st === "hit" ? 0 : 1) : 0,
                transition: "opacity 0.25s",
              }}
            >
              <LilyPad flower={e.beats >= 2} grey={st === "miss"} />
            </div>
          );
        })}
      </div>

      {/* The pad under the character (the start pad before the first hop). */}
      <div
        key={`pin${pinned}-${index}`}
        style={{
          position: "absolute",
          left: targetPx,
          top: `${padLine}%`,
          width: pinned >= 0 ? padW(pads[pinned]?.beats ?? 1) : beatPx * 0.72,
          transform: "translate(-50%, -50%)",
          animation: pinned >= 0 && !ahead ? "rj-pop 0.25s ease-out" : undefined,
        }}
      >
        <LilyPad glow={pinned >= 0} flower={pinned >= 0 && (pads[pinned]?.beats ?? 0) >= 2} />
      </div>

      {/* A splash on a rest. */}
      {splashAt && (
        <div
          key={splashAt.key}
          style={{
            position: "absolute",
            left: targetPx + beatPx * 0.2,
            top: `${padLine}%`,
            width: beatPx * 0.9,
            animation: "rj-splash 0.8s ease-out forwards",
            pointerEvents: "none",
          }}
        >
          <Splash />
        </div>
      )}

      {/* The character. */}
      <div
        key={`w${wobble}`}
        style={{
          position: "absolute",
          left: targetPx,
          top: `${padLine - 1}%`,
          width: charW,
          transform: "translate(-50%, -92%)",
          animation: wobble ? "rj-wobble 0.5s ease-in-out" : undefined,
          pointerEvents: "none",
        }}
      >
        <SvgPuppet choice={character} state="idle" reaction={reaction} style={{ width: "100%", height: "auto", display: "block" }} />
        {bubble && (
          <div
            key={bubble.key}
            aria-live="polite"
            style={{
              position: "absolute",
              left: "50%",
              top: compact ? "-16%" : "-10%",
              background: colors.white,
              color: bubble.color,
              fontWeight: 900,
              fontSize: compact ? 15 : 21,
              padding: "0.2em 0.7em",
              borderRadius: 999,
              boxShadow: `0 0 0 3px ${bubble.color}, 0 4px 0 rgba(0,0,0,0.12)`,
              whiteSpace: "nowrap",
              animation: "rj-bubble 0.9s ease-out forwards",
            }}
          >
            {bubble.text}
          </div>
        )}
      </div>

      {/* Top bar */}
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
          zIndex: 3,
        }}
      >
        <div style={{ ...hudPill, flexDirection: "column", alignItems: "flex-start", gap: 0 }} aria-label={`Pattern ${index + 1} of ${PATTERNS_PER_ROUND}`}>
          <span style={{ fontSize: compact ? "0.95rem" : "1.05rem" }}>
            🐸 {Math.min(index + 1, PATTERNS_PER_ROUND)} / {PATTERNS_PER_ROUND}
          </span>
          {!compact && (
            <span style={{ fontSize: "0.72rem", fontWeight: 800, opacity: 0.6 }}>
              {MODE_LABELS[mode]} · {levelLabel}
              {ahead ? " · Practice" : ""}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
          {phase === "playing" && <PauseButton onClick={pause} compact={compact} />}
          <ExitButton onClick={exit.ask} compact={compact} />
        </div>
      </div>

      {/* The card: the notation (Read & Tap), or what to do (Listen & Echo). */}
      {phase !== "over" && (
        <div
          data-no-tap=""
          style={{
            position: "absolute",
            top: compact ? "max(8px, env(safe-area-inset-top))" : "max(14px, env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            background: colors.white,
            borderRadius: compact ? 18 : 22,
            padding: compact ? "4px 12px" : "10px 18px 8px",
            boxShadow: "0 4px 0 rgba(0,0,0,0.12)",
            display: "flex",
            flexDirection: compact ? "row" : "column",
            alignItems: "center",
            gap: compact ? 10 : 6,
            zIndex: 2,
            boxSizing: "border-box",
            // max-content: centred with left 50%, the card would otherwise
            // be squeezed into half the screen.
            width: "max-content",
            maxWidth: compact ? "calc(100vw - 250px)" : size.w < 900 ? "calc(100vw - 24px)" : "calc(100vw - 320px)",
            marginTop: !compact && size.w < 900 ? 58 : 0,
            pointerEvents: "none",
          }}
        >
          {notationVisible ? (
            <Notation layout={layout} current={current} syllables={syllables} height={compact ? (syllables ? 80 : 62) : syllables ? 112 : 92} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: compact ? "6px 0" : "6px 4px" }}>
              <span style={{ fontSize: compact ? "1.4rem" : "2rem" }} aria-hidden="true">
                👂
              </span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 900, fontSize: compact ? "1rem" : "1.35rem", color: colors.blueText }}>
                  {step === "listen" ? (heardAgain ? "Listen again…" : "Listen…") : "Your turn: tap it back!"}
                </div>
                {!compact && (
                  <div style={{ fontWeight: 700, fontSize: "0.85rem", opacity: 0.6 }}>
                    {step === "listen" ? "Hear the rhythm. Don't tap yet!" : "No notes to read this time."}
                  </div>
                )}
              </div>
              {phase === "playing" && !heardAgain && (step === "listen" || step === "countin") && (
                <button
                  type="button"
                  onClick={hearAgain}
                  style={{
                    pointerEvents: "auto",
                    fontWeight: 900,
                    fontSize: compact ? "0.9rem" : "1.05rem",
                    padding: compact ? "0.35rem 0.75rem" : "0.55rem 1rem",
                    borderRadius: 999,
                    border: `2px solid ${colors.blueText}`,
                    background: colors.blueBackground,
                    color: colors.blueText,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    minHeight: 44,
                  }}
                >
                  🔊 Hear again
                </button>
              )}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {counted > 0 && !echo && !compact && <span style={{ fontWeight: 800, fontSize: "0.9rem", opacity: 0.65 }}>Read it… get ready</span>}
            {counted > 0 && <span style={{ fontWeight: 900, color: "#F28C28", fontSize: compact ? "0.95rem" : "1.05rem", minWidth: "1.2em" }}>{counted}</span>}
            {/* Phones: no dots beside the notation (it needs the width). */}
            {!(compact && notationVisible) && <BeatDots beat={step === "between" ? -1 : beatInBar} total={layout.meter} size={compact ? 9 : 12} />}
          </div>
          {echo && step === "between" && !compact && <div style={{ fontWeight: 800, fontSize: "0.8rem", opacity: 0.6 }}>That was the rhythm!</div>}
        </div>
      )}

      {/* First pattern: how to play. */}
      {phase === "playing" && index === 0 && (
        <div
          style={{
            ...hudPill,
            position: "absolute",
            bottom: "max(12px, env(safe-area-inset-bottom))",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: compact ? "0.8rem" : "0.95rem",
            background: "rgba(255,255,255,0.82)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          👆 {step === "listen" ? "Listen first, then tap it back" : echo ? "Tap anywhere on each note · Space on a keyboard" : "Read the notes and tap each one · Space on a keyboard"}
        </div>
      )}

      {/* Ready / paused / round complete */}
      {phase !== "playing" && !exit.asking && (
        <div style={overlay} data-no-tap="">
          <div style={panel(compact)}>
            {phase === "ready" && (
              <>
                <h1 style={{ margin: 0, fontSize: "1.7rem", fontWeight: 900 }}>🐸 Rhythm Jump</h1>
                <p style={{ margin: 0, fontWeight: 700, opacity: 0.7 }}>
                  {MODE_LABELS[mode]} · {levelLabel}{ahead ? " · Practice" : ""} · {bpm} BPM
                </p>
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
                <p style={{ margin: 0, fontWeight: 600, opacity: 0.7 }}>This rhythm starts again from its count-in.</p>
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
                <h2 style={{ margin: 0, fontSize: compact ? "1.3rem" : "1.7rem", fontWeight: 900 }}>Round complete!</h2>
                <div style={{ fontSize: compact ? "2.3rem" : "3.1rem", letterSpacing: "0.1em", lineHeight: 1 }} aria-label={`${stars} of 3 stars`}>
                  {[1, 2, 3].map((n) => (
                    <span key={n} style={n > stars ? { filter: "grayscale(1)", opacity: 0.3 } : undefined}>
                      ⭐
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 14, justifyContent: "center", fontWeight: 800, flexWrap: "wrap" }}>
                  <span style={{ color: "#2E9E5B" }}>Perfect {count("perfect")}</span>
                  <span style={{ color: colors.blueText }}>Good {count("good")}</span>
                  <span style={{ color: colors.coralText }}>Miss {count("miss")}</span>
                  {totals.splashes > 0 && <span style={{ color: "#3E95C6" }}>Splashes {totals.splashes}</span>}
                </div>
                <div style={{ fontWeight: 700, opacity: 0.7, fontSize: "0.9rem" }}>
                  Timing: {Math.round(acc * 100)}% · {PATTERNS_PER_ROUND} / {PATTERNS_PER_ROUND} patterns
                </div>
                {endNote}
                <button type="button" onClick={startRound} style={primaryButton}>
                  Play again
                </button>
                <button type="button" onClick={onChangeSettings} style={secondaryButton}>
                  {exitLabel}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {noAudio && (
        <div style={overlay} data-no-tap="">
          <div style={panel(compact)}>
            <p style={{ margin: 0, fontWeight: 700 }}>This browser can&apos;t play the beat, so Rhythm Jump can&apos;t run here.</p>
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

export function BeatDots({ beat, total, size = 12 }: { beat: number; total: number; size?: number }) {
  return (
    <div style={{ display: "flex", gap: size * 0.6, alignItems: "center" }} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: 99,
            background: i === beat ? "#F28C28" : "#E3DCCD",
            transform: i === beat ? "scale(1.35)" : "none",
            transition: "transform 0.08s",
          }}
        />
      ))}
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
  zIndex: 10,
};

const panel = (compact: boolean): React.CSSProperties => ({
  background: colors.background,
  color: colors.textPrimary,
  borderRadius: "20px",
  padding: compact ? "0.9rem 1.25rem" : "1.5rem 1.25rem",
  width: "min(400px, 100%)",
  maxHeight: "100%",
  overflowY: "auto",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: compact ? "0.5rem" : "0.8rem",
  textAlign: "center",
});

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
  fontSize: "1rem",
  fontWeight: 800,
  padding: "0.7rem",
  borderRadius: "14px",
  border: "2px solid #E3DCCD",
  background: colors.white,
  color: colors.textPrimary,
  cursor: "pointer",
};
