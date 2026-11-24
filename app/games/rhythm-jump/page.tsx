"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { RunnerCard, RunnerPickerScreen, useRunnerChoice } from "@/components/characters/RunnerChoice";
import { usePianoSamples } from "@/lib/usePianoSamples";
import Calibration from "@/components/rhythmJump/Calibration";
import { ValueSymbol } from "@/components/rhythmJump/Notation";
import {
  ALL_METERS,
  LEVELS,
  MODE_LABELS,
  NOTE_VALUES,
  PRESET_CHOICES,
  REST_VALUES,
  TEMPOS,
  TEMPO_LABELS,
  bpmFor,
  choiceProblem,
  levelOfChoice,
  loadCalibration,
  loadChoice,
  presetOf,
  saveChoice,
  type RhythmChoice,
  type RhythmLevel,
  type RhythmValue,
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
  // Easy / Medium / Hard fill the rhythm choice; Custom lets the teacher
  // pick exactly which values appear. Remembered on this device.
  const [selected, setSelected] = useState<RhythmLevel | "custom">("easy");
  const [choice, setChoice] = useState<RhythmChoice>(PRESET_CHOICES.easy);
  const [showRhythms, setShowRhythms] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const preset = presetOf(choice);
  const level = levelOfChoice(choice);
  const problem = choiceProblem(choice);
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
    const saved = loadChoice();
    if (saved) {
      setSelected(saved.selected);
      setChoice(saved.choice);
      if (saved.selected === "custom") setShowRhythms(true);
    }
    setLoaded(true);
    loadGame().catch(() => {});
  }, []);

  useEffect(() => {
    if (loaded) saveChoice(selected, choice);
  }, [loaded, selected, choice]);

  const pickPreset = (l: RhythmLevel) => {
    setSelected(l);
    setChoice(PRESET_CHOICES[l]);
  };
  const toggle = (next: RhythmChoice) => {
    setChoice(next);
    setSelected(presetOf(next) ?? "custom");
  };
  const toggleValue = (v: RhythmValue) =>
    toggle({ ...choice, values: choice.values.includes(v.key) ? choice.values.filter((k) => k !== v.key) : [...choice.values, v.key] });
  const toggleMeter = (m: number) =>
    toggle({ ...choice, meters: choice.meters.includes(m) ? choice.meters.filter((x) => x !== m) : [...choice.meters, m].sort() });

  const play = () => {
    if (problem) return;
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
        custom={preset ? null : choice}
        mode={mode}
        tempo={tempo}
        syllables={syllables}
        practice={practice && preset === "easy"}
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
            <button key={key} type="button" role="radio" aria-checked={key === selected} onClick={() => pickPreset(key)} style={option(key === selected)}>
              <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{LEVELS[key].label}</div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", opacity: 0.75 }}>{LEVELS[key].detail}</div>
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={selected === "custom"}
            onClick={() => {
              setSelected("custom");
              setShowRhythms(true);
            }}
            style={option(selected === "custom")}
          >
            <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>Custom</div>
            <div style={{ fontWeight: 600, fontSize: "0.9rem", opacity: 0.75 }}>Choose exactly which notes, rests and time signatures appear</div>
          </button>
          <button
            type="button"
            aria-expanded={showRhythms}
            onClick={() => setShowRhythms((v) => !v)}
            style={{ background: "none", border: "none", padding: "0.2rem 0", textAlign: "left", fontWeight: 800, color: colors.blueText, cursor: "pointer", fontSize: "0.95rem" }}
          >
            {showRhythms ? "▾ Hide the rhythms" : "▸ See or change the rhythms"}
          </button>
          {showRhythms && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600, opacity: 0.7 }}>
                Start from a level above and change it, or pick your own. Only these will appear in the game.
              </p>
              <ValueGroup title="Note values" values={NOTE_VALUES} chosen={choice.values} onToggle={toggleValue} />
              <ValueGroup title="Rests" values={REST_VALUES} chosen={choice.values} onToggle={toggleValue} />
              <div>
                <div style={{ fontWeight: 900, marginBottom: "0.4rem" }}>Time signatures</div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {ALL_METERS.map((m) => (
                    <label key={m} style={{ ...checkRow(choice.meters.includes(m)), flex: 1, justifyContent: "center" }}>
                      <input type="checkbox" checked={choice.meters.includes(m)} onChange={() => toggleMeter(m)} style={checkbox} />
                      <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 0.95, fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 900, fontSize: "1.15rem" }} aria-label={`${m}/4`}>
                        <span>{m}</span>
                        <span>4</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          {problem && (
            <div role="alert" style={problemBox}>
              {problem}
            </div>
          )}
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
                style={{ ...option(m.key === mode), flex: 1 }}
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

        {preset === "easy" && (
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
            style={{ ...option(false), textAlign: "center", fontWeight: 800, whiteSpace: "nowrap" }}
          >
            {delayMs === null ? "Do it now" : "Re-calibrate"}
          </button>
        </section>

        <button
          type="button"
          onClick={play}
          disabled={!!problem}
          style={{
            opacity: problem ? 0.5 : 1,
            fontSize: "1.25rem",
            fontWeight: 900,
            padding: "0.95rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.greenButton,
            boxShadow: solidShadow(4, colors.greenButtonShadow),
            color: colors.white,
            cursor: problem ? "not-allowed" : "pointer",
          }}
        >
          Jump!
        </button>
        {problem && (
          <div role="status" style={{ ...problemBox, textAlign: "center" }}>
            {problem}
          </div>
        )}
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

function ValueGroup({
  title,
  values,
  chosen,
  onToggle,
}: {
  title: string;
  values: RhythmValue[];
  chosen: string[];
  onToggle: (v: RhythmValue) => void;
}) {
  return (
    <div>
      <div style={{ fontWeight: 900, marginBottom: "0.4rem" }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "0.4rem" }}>
        {values.map((v) => {
          const on = chosen.includes(v.key);
          return (
            <label key={v.key} style={checkRow(on)}>
              <input type="checkbox" checked={on} onChange={() => onToggle(v)} style={checkbox} />
              <span style={{ width: 64, display: "flex", justifyContent: "center", flex: "0 0 auto" }}>
                <ValueSymbol tokens={v.tokens} />
              </span>
              <span style={{ fontWeight: 700, fontSize: "0.9rem", lineHeight: 1.2 }}>{v.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

const checkbox: React.CSSProperties = { width: 22, height: 22, accentColor: colors.blueText, flex: "0 0 auto", margin: 0 };

function checkRow(on: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.35rem 0.6rem",
    borderRadius: 12,
    border: `2px solid ${on ? colors.blueText : colors.neutralGray}`,
    background: on ? colors.blueBackground : colors.white,
    cursor: "pointer",
    minHeight: 48,
    boxSizing: "border-box",
  };
}

const problemBox: React.CSSProperties = {
  background: "#FFF1E0",
  border: "2px solid #F2B266",
  color: "#7A4A12",
  borderRadius: 12,
  padding: "0.6rem 0.8rem",
  fontWeight: 700,
  fontSize: "0.92rem",
  lineHeight: 1.4,
};

function option(on: boolean): React.CSSProperties {
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
