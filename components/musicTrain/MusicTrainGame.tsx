"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_CHARACTER, type CharacterChoice } from "@/components/characters/choice";
import type { State as PuppetState } from "@/components/characters/pose";
import { ExitButton, LeaveConfirm, PauseButton, useGameExit } from "@/components/GameExit";
import { RotateDeviceOverlay, usePhonePortrait, useShortLandscape } from "@/components/RotateDevice";
import { getAudioContext, unlockNoteAudio } from "@/lib/playNote";
import { colors } from "@/lib/theme";
import {
  CHANGE_ITALIAN,
  DRIVER_FOR,
  DRIVER_NAME,
  ITALIAN,
  LEVELS,
  ROUND_LENGTH,
  SPEED_WORD,
  WHEEL_DEGREES_PER_BEAT,
  answersFor,
  beatAtTime,
  buildRound,
  driversFor,
  render,
  rideFor,
  starsFor,
  type Answer,
  type Change,
  type Driver,
  type Question,
  type Rendered,
  type Ride,
  type Speed,
  type TrainLevel,
} from "@/lib/fastOrSlow/music";
import { AnimalChange, AnimalIcon } from "./Animals";
import { TrainPlayer } from "./player";
import { Scenery, type SceneryHandle } from "./Scenery";
import { CAR_W, Carriage, LOCO_W, Locomotive, turnWheels } from "./Train";

// One round of Music Train (Fast or Slow): 10 pieces. For each, the train
// waits at a station while the piece plays (nothing moves with the beat:
// the answer has to come from listening). The child picks the driver:
// 🐢 slow, 🐕 medium, 🐇 fast (Hard: getting faster or slower). Then the
// piece plays again and the train runs: wheels, steam and the passing
// trees all on the beat (the train stays put; the world scrolls by).
// Right: a new carriage joins behind the engine. Wrong: the chosen driver
// can't keep the beat (a gentle, funny stop-go wobble), then the right one
// takes over. After the ride the train pulls into the next station.

type Phase = "ready" | "playing" | "paused" | "over";
type Step = "listen" | "ask" | "ride" | "arrive";

interface Car {
  id: number;
  passenger: CharacterChoice;
  color: number;
}

const PASSENGERS: CharacterChoice[] = [
  { kind: "cat", skin: 0, outfit: 0 },
  { kind: "fox", skin: 0, outfit: 0 },
  { kind: "boy", skin: 1, outfit: 2 },
  { kind: "note", skin: 0, outfit: 0 },
  { kind: "girl", skin: 3, outfit: 4 },
  { kind: "boy", skin: 4, outfit: 3 },
  { kind: "girl", skin: 0, outfit: 1 },
];

const ARRIVE_SECONDS = 1.8;

export default function MusicTrainGame({
  level,
  italian,
  character = DEFAULT_CHARACTER,
  autoStart = false,
  onChangeSettings,
}: {
  level: TrainLevel;
  italian: boolean;
  character?: CharacterChoice;
  autoStart?: boolean;
  onChangeSettings: () => void;
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
  const [results, setResults] = useState<boolean[]>([]);
  const resultsRef = useRef<boolean[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const carId = useRef(0);
  const [heard, setHeard] = useState(false); // the piece has played once
  const [hearing, setHearing] = useState(false);
  const [choice, setChoice] = useState<Answer | null>(null);
  const [driver, setDriverState] = useState<Driver | null>(null);
  const driverRef = useRef<Driver | null>(null);
  const setDriver = (d: Driver | null) => {
    driverRef.current = d;
    setDriverState(d);
  };
  const [wobble, setWobble] = useState(false);
  const [noAudio, setNoAudio] = useState(false);
  const [reaction, setReaction] = useState<{ state: PuppetState; key: number } | undefined>();
  const keyRef = useRef(0);

  const player = useRef<TrainPlayer | null>(null);
  if (!player.current) player.current = new TrainPlayer();
  const scenery = useRef<SceneryHandle>(null);
  const trainRef = useRef<HTMLDivElement>(null);
  const puffRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nextPuff = useRef(0);

  // Where the world is: how far it has scrolled, in BEATS (one near tree
  // apart), and the distance at which the current station sits in place.
  // Kept in beats, not px, so a resize (a tablet turned) never puts the
  // trees off the beat.
  const offset = useRef(0);
  const stationStop = useRef(0);
  // The running ride, or the arrival at the next station.
  const ride = useRef<{ r: Rendered; ride: Ride; t0: number; start: number; puff: number; drivers: [Driver, Driver]; right: boolean; swapped: boolean } | null>(null);
  const arrive = useRef<{ start: number; from: number; to: number } | null>(null);
  const rendered = useRef<Rendered | null>(null);
  const carAdded = useRef(-1);

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
  const over = phase === "over";
  // Upright tablets: a bigger train (older carriages trail off the left).
  const baseH = Math.min(h * (compact ? 0.39 : 0.29), w * (compact ? 0.18 : portrait ? 0.27 : 0.205));
  // The end screen: the whole train (shrunk to fit), high up but below the
  // top bar; the stars card goes underneath.
  const trainH = over ? Math.min(baseH * 0.8, (w * 0.94) / (LOCO_W + Math.max(1, cars.length) * CAR_W)) : baseH;
  const railY = over ? Math.max(compact ? 44 : 42, ((compact ? 62 : 84) + trainH) / h * 100) : compact ? 75 : portrait ? 52 : 64;
  const railPx = (h * railY) / 100;
  const locoW = trainH * LOCO_W;
  const locoRight = over ? w / 2 + (locoW + cars.length * trainH * CAR_W) / 2 : w * 0.965;
  const chimneyX = locoRight - locoW + (134 / 190) * locoW;
  const spacing = Math.max(170, w * 0.3);
  const geom = useRef({ spacing, chimneyX });
  geom.current = { spacing, chimneyX };

  // Puts the world where `offset` says (and the wheels with it).
  const place = useCallback(() => {
    const S = geom.current.spacing;
    scenery.current?.set(offset.current * S, stationStop.current * S);
  }, []);
  useEffect(() => {
    place();
  }, [place, w, h, railY, trainH]);

  // A puff of steam that came out `late` seconds ago.
  const puff = (late: number) => {
    const el = puffRefs.current[nextPuff.current++ % puffRefs.current.length];
    if (!el) return;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = `mt-puff 1.1s ease-out ${(-Math.max(0, late)).toFixed(3)}s forwards`;
  };

  // --- questions -----------------------------------------------------------------
  const listen = useCallback(
    (i: number) => {
      const q = roundRef.current[i];
      const r = render(q);
      rendered.current = r;
      indexRef.current = i;
      setIndex(i);
      setChoice(null);
      setDriver(null);
      setWobble(false);
      setHeard(false);
      setHearing(true);
      setStep("listen");
      const t0 = player.current!.play(r, () => {
        setHeard(true);
        setHearing(false);
        if (stepRef.current === "listen") setStep("ask");
      });
      if (t0 === null) setNoAudio(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const hearAgain = () => {
    if (phaseRef.current !== "playing" || stepRef.current !== "ask" || !rendered.current) return;
    unlockNoteAudio();
    setHearing(true);
    player.current!.play(rendered.current, () => setHearing(false));
  };

  const startRide = useCallback(() => {
    const q = roundRef.current[indexRef.current];
    const r = rendered.current;
    if (!q || !r) return;
    const right = choiceRef.current === q.answer;
    const drivers = driversFor(q.answer);
    const wrongDriver = choiceRef.current && !right ? driversFor(choiceRef.current)[0] : drivers[0];
    const rd = rideFor(r, right, wrongDriver);
    setDriver(right ? drivers[0] : wrongDriver);
    setWobble(!right);
    const t0 = player.current!.play(r, undefined, 0.15);
    if (t0 === null) {
      setNoAudio(true);
      return;
    }
    ride.current = { r, ride: rd, t0, start: offset.current, puff: 0, drivers, right, swapped: right };
    setStep("ride");
  }, []);

  const choiceRef = useRef<Answer | null>(null);
  const answer = (a: Answer) => {
    if (phaseRef.current !== "playing" || stepRef.current !== "ask" || exitRef.current?.askingRef.current) return;
    unlockNoteAudio();
    player.current!.stop();
    setHearing(false);
    const q = roundRef.current[indexRef.current];
    const right = a === q.answer;
    choiceRef.current = a;
    setChoice(a);
    resultsRef.current = [...resultsRef.current, right];
    setResults(resultsRef.current);
    if (right && carAdded.current !== indexRef.current) {
      carAdded.current = indexRef.current;
      const n = carId.current++;
      setCars((cs) => [...cs, { id: n, passenger: PASSENGERS[n % PASSENGERS.length], color: n }]);
    }
    setReaction({ state: right ? "happy" : "shrug", key: ++keyRef.current });
    startRide();
  };

  // --- the frame loop: the ride and the arrival ---------------------------------------
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = getAudioContext();
      const { spacing: S } = geom.current;
      const rd = ride.current;
      if (stepRef.current === "ride" && rd && c) {
        const t = c.currentTime - rd.t0;
        const beatsGone = rd.ride.distance(t);
        offset.current = rd.start + beatsGone;
        place();
        turnWheels(trainRef.current, beatsGone * WHEEL_DEGREES_PER_BEAT);
        while (rd.puff < rd.ride.puffs.length && t >= rd.ride.puffs[rd.puff]) {
          puff(t - rd.ride.puffs[rd.puff]);
          rd.puff++;
        }
        if (!rd.swapped && t >= rd.ride.swapTime) {
          rd.swapped = true;
          setWobble(false);
          setDriver(rd.drivers[0]);
        }
        // Getting faster / slower: the second driver takes over half-way.
        if (rd.swapped && rd.drivers[0] !== rd.drivers[1]) {
          const d = beatAtTime(rd.r.beats, t) >= rd.r.totalBeats / 2 ? rd.drivers[1] : rd.drivers[0];
          if (d !== driverRef.current) setDriver(d);
        }
        if (t > rd.r.seconds + 0.3) {
          // Into the next station: it arrives from the right and the train
          // stops with the station in place (a whole number of beats on).
          ride.current = null;
          const from = offset.current;
          const to = Math.ceil(from + (w * 1.3) / S);
          stationStop.current = to;
          arrive.current = { start: c.currentTime, from, to };
          setStep("arrive");
        }
      } else if (stepRef.current === "arrive" && arrive.current && c) {
        const a = arrive.current;
        const k = Math.min(1, (c.currentTime - a.start) / ARRIVE_SECONDS);
        const ease = 1 - Math.pow(1 - k, 3);
        offset.current = a.from + (a.to - a.from) * ease;
        place();
        turnWheels(trainRef.current, offset.current * WHEEL_DEGREES_PER_BEAT);
        if (k >= 1) {
          arrive.current = null;
          const next = indexRef.current + 1;
          if (next >= ROUND_LENGTH) {
            setPhase("over");
            setReaction({ state: "happy", key: ++keyRef.current });
          } else listen(next);
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, place, listen, w]);

  // --- start / pause / resume --------------------------------------------------------------
  const startRound = useCallback(() => {
    unlockNoteAudio();
    const fresh = buildRound(level);
    roundRef.current = fresh;
    setRound(fresh);
    resultsRef.current = [];
    setResults([]);
    setCars([]);
    carAdded.current = -1;
    offset.current = 0;
    stationStop.current = 0;
    place();
    turnWheels(trainRef.current, 0);
    setPhase("playing");
    listen(0);
  }, [level, listen, place]);

  const pause = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    player.current!.stop();
    setPhase("paused");
  }, []);

  // Resuming replays what was interrupted: the piece (from the start), or
  // the ride (from where it began), or the rest of the arrival.
  const resume = useCallback(() => {
    if (phaseRef.current !== "paused") return;
    unlockNoteAudio();
    setPhase("playing");
    const s = stepRef.current;
    if (s === "ride" && ride.current) {
      offset.current = ride.current.start;
      startRide();
    } else if (s === "arrive" && arrive.current) {
      const c = getAudioContext();
      if (c) arrive.current = { start: c.currentTime, from: offset.current, to: arrive.current.to };
    } else listen(indexRef.current);
  }, [listen, startRide]);

  const exit = useGameExit({
    pause: () => pause(),
    resume: () => resume(),
    inRun: () => phaseRef.current === "playing" || phaseRef.current === "paused",
  });
  const exitRef = useRef(exit);
  exitRef.current = exit;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __musicTrain?: unknown }).__musicTrain = {
        question: () => roundRef.current[indexRef.current],
        index: () => indexRef.current,
        step: () => stepRef.current,
        phase: () => phaseRef.current,
        results: () => resultsRef.current,
        ride: () => ride.current,
        offset: () => offset.current,
        spacing: () => geom.current.spacing,
        chimneyX: () => geom.current.chimneyX,
        round: () => roundRef.current,
        go: (i: number) => {
          ride.current = null;
          arrive.current = null;
          listen(i);
        },
      };
    }
    if (autoStart) startRound();
    return () => player.current?.stop();
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
  const isChange = q?.bpmTo !== undefined;
  const right = choice !== null && q && choice === q.answer;
  const correct = results.filter(Boolean).length;
  const stars = starsFor(correct);
  const trainTop = railPx - trainH * 0.99;
  const puffSize = trainH * 0.42;
  const speedLabel = (s: Speed) => (italian ? `${SPEED_WORD[s]} · ${ITALIAN[level][s]}` : SPEED_WORD[s]);
  const answerWord = (a: Answer) =>
    a === "faster" || a === "slower" ? `getting ${a}${italian ? ` (${CHANGE_ITALIAN[a as Change]})` : ""}` : `${SPEED_WORD[a as Speed].toLowerCase()}${italian ? ` (${ITALIAN[level][a as Speed]})` : ""}`;

  return (
    <div ref={rootRef} style={{ position: "fixed", inset: 0, overflow: "hidden", userSelect: "none", WebkitUserSelect: "none", fontFamily: "inherit" }}>
      <style>{`
        @keyframes mt-puff { 0% { transform: translate(-50%, -50%) scale(.45); opacity: .95 } 100% { transform: translate(calc(-50% - ${(trainH * 1.1).toFixed(0)}px), calc(-50% - ${(trainH * 0.75).toFixed(0)}px)) scale(1.7); opacity: 0 } }
        @keyframes mt-wobble { 0%,100% { transform: rotate(0) translateY(0) } 20% { transform: rotate(-2.2deg) translateY(-5px) } 45% { transform: rotate(1.4deg) translateY(1px) } 70% { transform: rotate(-1deg) translateY(-3px) } }
        @keyframes mt-pop { 0% { transform: scale(.2); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1) } }
        @keyframes mt-in { 0% { opacity: 0; transform: translateY(6px) } 100% { opacity: 1; transform: none } }
      `}</style>

      <Scenery
        ref={scenery}
        w={w}
        h={h}
        railY={railY}
        spacing={spacing}
        engineX={chimneyX}
        trainH={trainH}
        conductor={character}
        conductorReaction={reaction}
        flag={choice !== null && !right && step === "ride" ? "red" : "green"}
        compact={compact}
        endScreen={over}
      />

      {/* the train: newest carriages right behind the engine */}
      <div
        ref={trainRef}
        style={{
          position: "absolute",
          right: w - locoRight,
          top: trainTop,
          display: "flex",
          alignItems: "flex-end",
          transformOrigin: "85% 100%",
          animation: wobble && step === "ride" ? "mt-wobble 0.45s ease-in-out infinite" : undefined,
        }}
      >
        {cars.map((car, i) => (
          <div key={car.id} style={{ animation: i === cars.length - 1 && !over ? "mt-pop 0.5s ease-out" : undefined, transformOrigin: "50% 100%" }}>
            <Carriage h={trainH} passenger={car.passenger} color={car.color} />
          </div>
        ))}
        <Locomotive h={trainH} driver={driver} />
      </div>

      {/* steam (a pool of puffs, started on the beat) */}
      {Array.from({ length: 7 }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            puffRefs.current[i] = el;
          }}
          aria-hidden="true"
          style={{ position: "absolute", left: chimneyX, top: trainTop + trainH * 0.05, width: puffSize, height: puffSize * 0.75, opacity: 0, pointerEvents: "none" }}
        >
          <svg viewBox="-30 -20 60 40" style={{ width: "100%", height: "100%", overflow: "visible" }}>
            <g fill="white" stroke="#C9D6E2" strokeWidth={2.5}>
              <circle cx={-12} cy={4} r={10} />
              <circle cx={11} cy={5} r={9} />
              <circle cx={0} cy={0} r={14} />
            </g>
            <circle cx={-3} cy={-4} r={6} fill="#F4F8FB" />
          </svg>
        </div>
      ))}

      {/* top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "max(10px, env(safe-area-inset-top)) 12px 0", zIndex: 3, pointerEvents: "none" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
          <div style={{ ...pill, flexDirection: "column", alignItems: "flex-start", gap: 0 }} aria-label={`Piece ${Math.min(index + 1, ROUND_LENGTH)} of ${ROUND_LENGTH}`}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: compact ? "0.95rem" : "1.05rem" }}>
              <LocoIcon size={compact ? 22 : 26} /> {Math.min(index + 1, ROUND_LENGTH)} / {ROUND_LENGTH}
            </span>
            {!compact && <span style={{ fontSize: "0.72rem", fontWeight: 800, opacity: 0.6 }}>Fast or Slow · {LEVELS[level].label}</span>}
          </div>
          <div style={{ ...pill, fontSize: compact ? "0.95rem" : "1.05rem" }} aria-label={`${cars.length} carriages`}>
            <CarriageIcon size={compact ? 24 : 28} /> × {cars.length}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", pointerEvents: "auto" }}>
          {phase === "playing" && <PauseButton onClick={pause} compact={compact} />}
          <ExitButton onClick={exit.ask} compact={compact} />
        </div>
      </div>

      {/* the card: listen, choose, and what happened */}
      {phase === "playing" && q && (
        <div
          style={{
            position: "absolute",
            top: compact ? "max(8px, env(safe-area-inset-top))" : "max(14px, env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            width: "max-content",
            maxWidth: compact ? "calc(100vw - 250px)" : w < 620 ? "calc(100vw - 24px)" : "calc(100vw - 320px)",
            marginTop: !compact && w < 620 ? 112 : 0,
            background: colors.white,
            borderRadius: compact ? 18 : 22,
            padding: compact ? "8px 14px" : "14px 20px",
            boxShadow: "0 4px 0 rgba(0,0,0,0.12)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: compact ? 6 : 10,
            zIndex: 2,
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          {(step === "listen" || step === "ask") && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                <div style={{ fontWeight: 900, fontSize: compact ? "1.05rem" : "1.35rem", color: step === "listen" ? colors.blueText : colors.textPrimary }}>
                  {step === "listen" ? "🎵 Listen to the music…" : isChange ? "Is the music getting faster or slower?" : "Who should drive the train?"}
                </div>
                {step === "ask" && (
                  <button type="button" onClick={hearAgain} disabled={hearing} style={{ ...hearButton(compact), opacity: hearing ? 0.55 : 1 }}>
                    🔊 Hear again
                  </button>
                )}
              </div>
              {step === "listen" && !compact && (
                <div style={{ fontWeight: 700, fontSize: "0.9rem", opacity: 0.6 }}>
                  {isChange ? "Does it speed up or slow down?" : level === "medium" ? "Is it slow, medium or fast?" : "Is it fast or slow?"} Then choose who drives the train.
                </div>
              )}
              <div style={{ display: "flex", gap: compact ? 8 : 12, opacity: step === "listen" ? 0.45 : 1 }}>
                {isChange
                  ? (["faster", "slower"] as Change[]).map((c) => (
                      <AnswerButton
                        key={c}
                        icon={<AnimalChange from={c === "faster" ? "turtle" : "rabbit"} to={c === "faster" ? "rabbit" : "turtle"} size={compact ? 30 : 44} />}
                        title={c === "faster" ? "Getting faster" : "Getting slower"}
                        sub={italian ? CHANGE_ITALIAN[c] : undefined}
                        compact={compact}
                        disabled={step !== "ask"}
                        onClick={() => answer(c)}
                      />
                    ))
                  : answersFor(level).map((s) => (
                      <AnswerButton
                        key={s}
                        icon={<AnimalIcon kind={DRIVER_FOR[s]} size={compact ? 44 : 72} />}
                        title={DRIVER_NAME[DRIVER_FOR[s]]}
                        sub={speedLabel(s)}
                        compact={compact}
                        disabled={step !== "ask"}
                        onClick={() => answer(s)}
                      />
                    ))}
              </div>
            </>
          )}
          {(step === "ride" || step === "arrive") && choice !== null && (
            <div key={`r${index}`} style={{ display: "flex", alignItems: "center", gap: 10, animation: "mt-in 0.3s ease-out" }}>
              {right ? (
                isChange ? (
                  <AnimalChange from={driversFor(q.answer)[0]} to={driversFor(q.answer)[1]} size={compact ? 30 : 42} />
                ) : (
                  <AnimalIcon kind={DRIVER_FOR[q.answer as Speed]} size={compact ? 34 : 48} />
                )
              ) : (
                <AnimalChange from={driversFor(choice)[0]} to={driversFor(q.answer)[0]} size={compact ? 30 : 42} />
              )}
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 900, fontSize: compact ? "1.05rem" : "1.4rem", color: right ? "#2E9E5B" : colors.coralText }}>
                  {right ? `Yes! The music was ${answerWord(q.answer)}` : `Oops! The music was ${answerWord(q.answer)}`}
                </div>
                <div style={{ fontWeight: 700, fontSize: compact ? "0.8rem" : "0.92rem", opacity: 0.65 }}>
                  {right
                    ? "The wheels, the steam and the trees go with the beat."
                    : wrongLine(choice, q.answer)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ready / paused / round complete */}
      {phase !== "playing" && !exit.asking && (
        <div style={over ? endWrap(compact) : overlay}>
          <div style={panel(compact)}>
            {phase === "ready" && (
              <>
                <h1 style={{ margin: 0, fontSize: "1.7rem", fontWeight: 900 }}>Music Train</h1>
                <p style={{ margin: 0, fontWeight: 700, opacity: 0.7 }}>Fast or Slow · {LEVELS[level].label}</p>
                <button type="button" onClick={startRound} style={primaryButton}>
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
            {over && (
              <>
                <h2 style={{ margin: 0, fontSize: compact ? "1.3rem" : "1.7rem", fontWeight: 900 }}>{cars.length >= 6 ? "What a long train!" : "All aboard!"}</h2>
                <div style={{ fontSize: compact ? "2rem" : "2.8rem", letterSpacing: "0.1em", lineHeight: 1 }} aria-label={`${stars} of 3 stars`}>
                  {[1, 2, 3].map((n) => (
                    <span key={n} style={n > stars ? { filter: "grayscale(1)", opacity: 0.3 } : undefined}>
                      ⭐
                    </span>
                  ))}
                </div>
                <div style={{ fontWeight: 800 }}>
                  {cars.length} {cars.length === 1 ? "carriage" : "carriages"} · {correct} of {ROUND_LENGTH} right
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <button type="button" onClick={startRound} style={{ ...primaryButton, flex: 1 }}>
                    Play again
                  </button>
                  <button type="button" onClick={onChangeSettings} style={{ ...secondaryButton, flex: 1 }}>
                    Change settings
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
            <p style={{ margin: 0, fontWeight: 700 }}>This browser can&apos;t play the music, so Music Train can&apos;t run here.</p>
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

// "The rabbit is too fast for this music… Turtle takes over!"
const PACE: Record<Driver, number> = { turtle: 0, dog: 1, rabbit: 2 };
function wrongLine(chosen: Answer, right: Answer): string {
  const [c] = driversFor(chosen);
  const [r1, r2] = driversFor(right);
  if (r1 !== r2) return `That's the other way round… ${DRIVER_NAME[r1]} starts, then ${DRIVER_NAME[r2]} takes over!`;
  return `The ${DRIVER_NAME[c].toLowerCase()} is too ${PACE[c] > PACE[r1] ? "fast" : "slow"} for this music… ${DRIVER_NAME[r1]} takes over!`;
}

function AnswerButton({
  icon,
  title,
  sub,
  compact,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  compact: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        flexDirection: compact ? "row" : "column",
        alignItems: "center",
        gap: compact ? 8 : 2,
        minWidth: compact ? 120 : 150,
        minHeight: 48,
        padding: compact ? "0.3rem 0.75rem" : "0.6rem 1rem",
        borderRadius: 18,
        border: "3px solid #E3DCCD",
        background: "white",
        boxShadow: "0 4px 0 #E3DCCD",
        color: colors.textPrimary,
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
      }}
    >
      {icon}
      <span style={{ display: "flex", flexDirection: "column", alignItems: compact ? "flex-start" : "center" }}>
        <span style={{ fontWeight: 900, fontSize: compact ? "1rem" : "1.15rem" }}>{title}</span>
        {sub && <span style={{ fontWeight: 800, fontSize: compact ? "0.78rem" : "0.88rem", opacity: 0.6 }}>{sub}</span>}
      </span>
    </button>
  );
}

// The small drawn engine and carriage of the top bar.
function LocoIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 40 30" width={size} height={size * 0.75} aria-hidden="true">
      <rect x={2} y={6} width={13} height={17} rx={2} fill="#E8524A" />
      <rect x={1} y={4} width={15} height={3} rx={1} fill="#3D3A4F" />
      <rect x={14} y={12} width={20} height={11} rx={5} fill="#E8524A" />
      <rect x={26} y={5} width={5} height={8} fill="#3D3A4F" />
      <circle cx={9} cy={25} r={4} fill="#3D3A4F" />
      <circle cx={24} cy={25} r={4} fill="#3D3A4F" />
      <circle cx={33} cy={26} r={3} fill="#3D3A4F" />
    </svg>
  );
}

function CarriageIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 34 26" width={size} height={size * 0.76} aria-hidden="true">
      <rect x={2} y={3} width={30} height={3} rx={1.5} fill="#1F7FC4" />
      <rect x={3} y={5} width={28} height={14} rx={3} fill="#2EA8FF" />
      <rect x={7} y={8} width={20} height={7} rx={2} fill="#FFF3D6" />
      <circle cx={9} cy={21} r={3.5} fill="#3D3A4F" />
      <circle cx={25} cy={21} r={3.5} fill="#3D3A4F" />
    </svg>
  );
}

const pill: React.CSSProperties = {
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
  background: "rgba(43,43,43,0.35)",
  padding: "16px",
  zIndex: 10,
};

// The end screen: the whole train stays in view above; the card sits below it.
const endWrap = (compact: boolean): React.CSSProperties => ({
  position: "absolute",
  left: 0,
  right: 0,
  top: compact ? "52%" : "55%",
  display: "flex",
  justifyContent: "center",
  padding: "0 16px",
  zIndex: 10,
});

const panel = (compact: boolean): React.CSSProperties => ({
  background: colors.background,
  color: colors.textPrimary,
  borderRadius: "20px",
  padding: compact ? "0.7rem 1.25rem" : "1.4rem 1.5rem",
  width: "min(400px, 100%)",
  maxHeight: "100%",
  overflowY: "auto",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: compact ? "0.4rem" : "0.75rem",
  textAlign: "center",
  boxShadow: "0 6px 0 rgba(0,0,0,0.12)",
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
