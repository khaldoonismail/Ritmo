"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { RunnerCard, RunnerPickerScreen, useRunnerChoice } from "@/components/characters/RunnerChoice";
import { usePianoSamples } from "@/lib/usePianoSamples";
import { loadCalibration, starsFor as rhythmStars } from "@/lib/rhythmJump";
import { rhythmPlayLevel, type SharedGameSettings } from "@/lib/sharedGames";
import { starsFor as roundStars } from "@/lib/happyOrSad/round";
import { SaveNote, useRunSave, type Best } from "./useRunSave";

// An assigned Piano Hop, Happy or Sad, Rhythm Jump or Music Train game.
// The teacher chose the settings; the student plays as often as they like
// and the best result counts (runs are started, checked and saved by
// ./useRunSave). Piano Hop is an endless run (best = most points); the
// other three are rounds (best = highest accuracy, whole rounds only).

const loading = () => (
  <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#BFE3F5" }}>
    <p style={{ fontWeight: 800 }}>Loading…</p>
  </main>
);
const loaders = {
  piano_hop: () => import("@/components/pianoHop/PianoHopGame"),
  happy_or_sad: () => import("@/components/happyOrSad/HappyOrSadGame"),
  rhythm_jump: () => import("@/components/rhythmJump/RhythmJumpGame"),
  music_train: () => import("@/components/musicTrain/MusicTrainGame"),
};
const PianoHopGame = dynamic(loaders.piano_hop, { ssr: false, loading });
const HappyOrSadGame = dynamic(loaders.happy_or_sad, { ssr: false, loading });
const RhythmJumpGame = dynamic(loaders.rhythm_jump, { ssr: false, loading });
const MusicTrainGame = dynamic(loaders.music_train, { ssr: false, loading });
const Calibration = dynamic(() => import("@/components/rhythmJump/Calibration"), { ssr: false, loading });

const INTRO: Record<SharedGameSettings["game"], { icon: string; text: string; controls: string }> = {
  piano_hop: {
    icon: "🎹🐇",
    text: "A note name appears at the top. Hop onto a piano key with that name before time runs out. 3 hearts. Play as often as you like — your best run counts.",
    controls: "Computer: ← → keys, then Space · Tablet or phone: tap a key · Sound on 🔊",
  },
  happy_or_sad: {
    icon: "☀️🌧️",
    text: "Listen to each piece and tap the sun or the cloud. 10 pieces a round. Play as often as you like — your best round counts.",
    controls: "Computer: ← sun, → cloud, H hear again · Tablet or phone: tap · Sound on 🔊",
  },
  rhythm_jump: {
    icon: "🐸🥁",
    text: "Tap on every note to hop across the pond; rests are water, so don't tap there. 8 rhythms a round. Play as often as you like — your best round counts.",
    controls: "Computer: Space · Tablet or phone: tap the screen · Sound on 🔊",
  },
  music_train: {
    icon: "🐢🚂🐇",
    text: "Listen to the music and pick the driver who keeps its speed. 10 pieces a round. Play as often as you like — your best round counts.",
    controls: "Tablet or phone: tap · Sound on 🔊",
  },
};

type Screen = "intro" | "calibrate" | "game";

export default function SharedGamePlayer({
  assignmentId,
  title,
  settings,
  initialBest,
}: {
  assignmentId: string;
  title: string;
  settings: SharedGameSettings;
  initialBest: Best | null;
}) {
  usePianoSamples();
  const byAccuracy = settings.game !== "piano_hop";
  const [screen, setScreen] = useState<Screen>("intro");
  const [runKey, setRunKey] = useState(0);
  const [delayMs, setDelayMs] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const { best, save, onRunStart, onRunEnd } = useRunSave(assignmentId, initialBest);
  const { runner, chosen, picking, setPicking, save: saveRunner } = useRunnerChoice();

  useEffect(() => {
    loaders[settings.game]().catch(() => {});
    if (settings.game === "rhythm_jump") setDelayMs(loadCalibration());
  }, [settings.game]);

  const endNote = <SaveNote save={save} byAccuracy={byAccuracy} />;
  const back = () => setScreen("intro");
  const play = () => {
    // Rhythm Jump measures this device's delay once, before the first game.
    if (settings.game === "rhythm_jump" && delayMs === null && !skipped) {
      setScreen("calibrate");
      return;
    }
    setRunKey(Date.now());
    setScreen("game");
  };
  const common = { character: runner, autoStart: true, exitLabel: "Back", onChangeSettings: back, onRunStart, endNote };

  if (screen === "calibrate") {
    return (
      <Calibration
        previousMs={delayMs}
        onDone={(ms: number) => {
          setDelayMs(Math.round(ms));
          setRunKey(Date.now());
          setScreen("game");
        }}
        onCancel={() => {
          setSkipped(true);
          setRunKey(Date.now());
          setScreen("game");
        }}
      />
    );
  }

  if (screen === "game") {
    switch (settings.game) {
      case "piano_hop":
        return <PianoHopGame key={runKey} {...common} level={settings.level} naming={settings.naming} onRunEnd={onRunEnd} />;
      case "happy_or_sad":
        return <HappyOrSadGame key={runKey} {...common} level={settings.level} labels={settings.labels} onRunEnd={onRunEnd} />;
      case "music_train":
        return <MusicTrainGame key={runKey} {...common} level={settings.level} italian={settings.italian} onRunEnd={onRunEnd} />;
      case "rhythm_jump":
        return (
          <RhythmJumpGame
            key={runKey}
            {...common}
            level={rhythmPlayLevel(settings)}
            custom={settings.custom}
            mode={settings.mode}
            tempo={settings.tempo}
            syllables={settings.syllables}
            delayMs={delayMs ?? 0}
            onRunEnd={onRunEnd}
          />
        );
    }
  }

  if (picking) {
    return (
      <RunnerPickerScreen
        initial={runner}
        mode={picking}
        onDone={(c) => {
          unlockNoteAudio();
          saveRunner(c);
          setPicking(null);
          if (picking === "start") play();
        }}
      />
    );
  }

  const intro = INTRO[settings.game];
  const stars = best ? (settings.game === "rhythm_jump" ? rhythmStars(best.accuracy / 100) : roundStars(Math.round(best.accuracy / 10))) : 0;
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: colors.background,
        color: colors.textPrimary,
        padding: "1.25rem 16px 2.5rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "min(520px, 100%)", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Link href="/student/dashboard" style={{ color: "inherit", fontWeight: 800, textDecoration: "none", opacity: 0.7 }}>
          ← Back to Dashboard
        </Link>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", lineHeight: 1 }}>{intro.icon}</div>
          <h1 style={{ margin: "0.4rem 0 0.2rem", fontSize: "1.8rem", fontWeight: 900 }}>{title}</h1>
          <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.45 }}>{intro.text}</p>
        </div>
        <section
          style={{
            background: colors.white,
            borderRadius: radius.card,
            padding: "0.9rem 1rem",
            boxShadow: solidShadow(4, colors.rosterCardShadow),
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 800, opacity: 0.6, fontSize: "0.85rem" }}>Your best</div>
          <div style={{ fontWeight: 900, fontSize: "1.8rem", color: colors.blueText }}>
            {best === null
              ? "—"
              : byAccuracy
                ? `${Math.round(best.accuracy)}% ${"⭐".repeat(stars)}`
                : `${best.points.toLocaleString()} pts`}
          </div>
        </section>
        <RunnerCard runner={runner} onChange={() => setPicking("change")} />
        <button
          type="button"
          onClick={() => {
            unlockNoteAudio();
            if (!chosen) setPicking("start");
            else play();
          }}
          style={{
            fontSize: "1.25rem",
            fontWeight: 900,
            padding: "0.95rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.greenButton,
            boxShadow: solidShadow(4, colors.greenButtonShadow),
            color: colors.white,
            cursor: "pointer",
          }}
        >
          {best === null ? "Play!" : "Play again!"}
        </button>
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.85rem", fontWeight: 700, opacity: 0.6 }}>{intro.controls}</p>
      </div>
    </main>
  );
}
