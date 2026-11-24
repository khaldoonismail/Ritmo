"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { RunnerCard, RunnerPickerScreen, useRunnerChoice } from "@/components/characters/RunnerChoice";
import { usePianoSamples } from "@/lib/usePianoSamples";
import Calibration from "@/components/rhythmJump/Calibration";
import {
  LEVELS,
  MODE_LABELS,
  TEMPOS,
  TEMPO_LABELS,
  bpmFor,
  loadCalibration,
  type RhythmLevel,
  type RhythmMode,
  type Tempo,
} from "@/lib/rhythmJump";

// Rhythm Jump, stage 1: rhythm reading on a pond. An unlisted page (not in
// the library, no database). The game itself is 2D (SVG and CSS, no 3D),
// light enough for old tablets.

const loadGame = () => import("@/components/rhythmJump/RhythmJumpGame");
const RhythmJumpGame = dynamic(loadGame, {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#BFE3F5" }}>
      <p style={{ fontWeight: 800 }}>Loading Rhythm Jump…</p>
    </main>
  ),
});

const LEVEL_KEYS: RhythmLevel[] = ["easy", "medium", "hard"];
const MODES: { key: RhythmMode; detail: string }[] = [
  { key: "read", detail: "See the rhythm and tap it" },
  { key: "echo", detail: "Hear it once, then tap it back" },
];

type Screen = "settings" | "calibrate" | "game";

export default function RhythmJumpPage() {
  // The piano samples play the rhythm in Listen & Echo.
  usePianoSamples();
  const [level, setLevel] = useState<RhythmLevel>("easy");
  const [mode, setMode] = useState<RhythmMode>("read");
  const [tempo, setTempo] = useState<Tempo>("normal");
  const [syllables, setSyllables] = useState(true);
  // Practice (Easy only, off by default): lily pads shown in advance.
  const [practice, setPractice] = useState(false);
  const [screen, setScreen] = useState<Screen>("settings");
  // After calibrating: play, or back to the settings (Re-calibrate).
  const [afterCalibrate, setAfterCalibrate] = useState<"game" | "settings">("game");
  const [delayMs, setDelayMs] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const { runner, chosen, picking, setPicking, save } = useRunnerChoice();

  useEffect(() => {
    setDelayMs(loadCalibration());
    loadGame().catch(() => {});
  }, []);

  const play = () => {
    unlockNoteAudio();
    if (!chosen) {
      setPicking("start");
      return;
    }
    goPlay();
  };
  const goPlay = () => {
    if (delayMs === null && !skipped) {
      setAfterCalibrate("game");
      setScreen("calibrate");
    } else {
      setRunKey(Date.now());
      setScreen("game");
    }
  };

  if (screen === "game") {
    return (
      <RhythmJumpGame
        key={runKey}
        level={level}
        mode={mode}
        tempo={tempo}
        syllables={syllables}
        practice={practice && level === "easy"}
        delayMs={delayMs ?? 0}
        character={runner}
        autoStart
        onChangeSettings={() => setScreen("settings")}
      />
    );
  }

  if (screen === "calibrate") {
    return (
      <Calibration
        previousMs={delayMs}
        onDone={(ms) => {
          setDelayMs(Math.round(ms));
          if (afterCalibrate === "game") {
            setRunKey(Date.now());
            setScreen("game");
          } else setScreen("settings");
        }}
        onCancel={() => {
          if (afterCalibrate === "game") {
            // Skipped: play with no correction this visit; ask again next time.
            setSkipped(true);
            setRunKey(Date.now());
            setScreen("game");
          } else setScreen("settings");
        }}
      />
    );
  }

  if (picking) {
    return (
      <RunnerPickerScreen
        initial={runner}
        mode={picking}
        onDone={(c) => {
          unlockNoteAudio();
          save(c);
          setPicking(null);
          if (picking === "start") goPlay();
        }}
      />
    );
  }

  const tempoIndex = TEMPOS.indexOf(tempo);

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
        <Link href="/" style={{ color: "inherit", fontWeight: 800, textDecoration: "none", opacity: 0.7 }}>
          ✕ Exit
        </Link>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", lineHeight: 1 }}>🐸🥁</div>
          <h1 style={{ margin: "0.4rem 0 0.2rem", fontSize: "2rem", fontWeight: 900 }}>Rhythm Jump</h1>
          <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.45 }}>
            Hop across the pond in time! Read the rhythm and tap on every note: a lily pad pops up under you
            when you&apos;re on time. Rests are water, so don&apos;t tap there. 8 rhythms a round, up to 3 stars.
          </p>
        </div>

        <section style={card} role="radiogroup" aria-label="Level">
          <div style={{ fontWeight: 900 }}>Level</div>
          {LEVEL_KEYS.map((key) => (
            <button key={key} type="button" role="radio" aria-checked={key === level} onClick={() => setLevel(key)} style={choice(key === level)}>
              <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{LEVELS[key].label}</div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", opacity: 0.75 }}>{LEVELS[key].detail}</div>
            </button>
          ))}
        </section>

        <section style={card} role="radiogroup" aria-label="Mode">
          <div style={{ fontWeight: 900 }}>Mode</div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={m.key === mode}
                onClick={() => setMode(m.key)}
                style={{ ...choice(m.key === mode), flex: 1 }}
              >
                <div style={{ fontWeight: 900 }}>{m.key === "read" ? "👀 " : "👂 "}{MODE_LABELS[m.key]}</div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", opacity: 0.75 }}>{m.detail}</div>
              </button>
            ))}
          </div>
        </section>

        <section style={card}>
          <label htmlFor="rj-tempo" style={{ fontWeight: 900, display: "flex", justifyContent: "space-between" }}>
            <span>Tempo</span>
            <span style={{ fontWeight: 700, opacity: 0.65 }}>
              {TEMPO_LABELS[tempo]} · {bpmFor(level, tempo)} beats a minute
            </span>
          </label>
          <input
            id="rj-tempo"
            type="range"
            min={0}
            max={2}
            step={1}
            value={tempoIndex}
            onChange={(e) => setTempo(TEMPOS[Number(e.target.value)] ?? "normal")}
            aria-valuetext={TEMPO_LABELS[tempo]}
            style={{ width: "100%", accentColor: colors.blueText, height: 28 }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "0.85rem", opacity: 0.7 }}>
            {TEMPOS.map((t) => (
              <span key={t}>{t === "slow" ? "🐢 " : t === "fast" ? "🐇 " : ""}{TEMPO_LABELS[t]}</span>
            ))}
          </div>
        </section>

        <section style={card}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
            <input type="checkbox" checked={syllables} onChange={(e) => setSyllables(e.target.checked)} style={{ width: 24, height: 24, accentColor: colors.blueText }} />
            <span>
              <span style={{ fontWeight: 900 }}>Rhythm syllables</span>
              <span style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", opacity: 0.7 }}>
                Ta, Ti-ti, Ta-a, Sh under the notes (great for young children)
              </span>
            </span>
          </label>
        </section>

        {level === "easy" && (
          <section style={card}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} style={{ width: 24, height: 24, accentColor: colors.blueText }} />
              <span>
                <span style={{ fontWeight: 900 }}>Practice</span>
                <span style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", opacity: 0.7 }}>
                  Show the lily pads coming, so you can see when to tap (for absolute beginners)
                </span>
              </span>
            </label>
          </section>
        )}

        <RunnerCard runner={runner} onChange={() => setPicking("change")} />

        <section style={{ ...card, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
          <div>
            <div style={{ fontWeight: 900 }}>🥁 Timing check</div>
            <div style={{ fontWeight: 600, fontSize: "0.85rem", opacity: 0.7 }}>
              {delayMs === null ? "Not done on this device yet (it runs before your first game)." : `This device: ${delayMs} ms delay, saved.`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              unlockNoteAudio();
              setAfterCalibrate("settings");
              setScreen("calibrate");
            }}
            style={{ ...choice(false), textAlign: "center", fontWeight: 800, whiteSpace: "nowrap" }}
          >
            {delayMs === null ? "Do it now" : "Re-calibrate"}
          </button>
        </section>

        <button
          type="button"
          onClick={play}
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
          Jump!
        </button>
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.85rem", fontWeight: 700, opacity: 0.6 }}>
          Tablet or phone: tap the screen · Computer: Space · Sound on 🔊
        </p>
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  background: colors.white,
  borderRadius: radius.card,
  padding: "1rem",
  boxShadow: solidShadow(4, colors.rosterCardShadow),
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
};

function choice(on: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "0.75rem 0.9rem",
    borderRadius: "14px",
    border: `2px solid ${on ? colors.blueText : colors.neutralGray}`,
    background: on ? colors.blueBackground : colors.white,
    color: colors.textPrimary,
    cursor: "pointer",
  };
}
