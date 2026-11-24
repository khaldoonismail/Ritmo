"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { RunnerCard, RunnerPickerScreen, useRunnerChoice } from "@/components/characters/RunnerChoice";
import { usePianoSamples } from "@/lib/usePianoSamples";
import { AnimalIcon } from "@/components/musicTrain/Animals";
import { LEVELS, type TrainLevel } from "@/lib/fastOrSlow/music";

// Music Train (Fast or Slow), stage 1: tempo by ear. An unlisted page (not
// in the library, no database). 2D (SVG and CSS), light for old tablets.

const loadGame = () => import("@/components/musicTrain/MusicTrainGame");
const MusicTrainGame = dynamic(loadGame, {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#D9EFFF" }}>
      <p style={{ fontWeight: 800 }}>Loading Music Train…</p>
    </main>
  ),
});

const LEVEL_KEYS: TrainLevel[] = ["easy", "medium", "hard"];

export default function FastOrSlowPage() {
  usePianoSamples();
  const [level, setLevel] = useState<TrainLevel>("easy");
  const [italian, setItalian] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const { runner, chosen, picking, setPicking, save } = useRunnerChoice();

  useEffect(() => {
    loadGame().catch(() => {});
  }, []);

  const go = () => {
    setRunKey(Date.now());
    setPlaying(true);
  };
  const play = () => {
    unlockNoteAudio();
    if (!chosen) {
      setPicking("start");
      return;
    }
    go();
  };

  if (playing) {
    return <MusicTrainGame key={runKey} level={level} italian={italian} character={runner} autoStart onChangeSettings={() => setPlaying(false)} />;
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
          if (picking === "start") go();
        }}
      />
    );
  }

  return (
    <main style={{ minHeight: "100dvh", background: colors.background, color: colors.textPrimary, padding: "1.25rem 16px 2.5rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "min(520px, 100%)", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Link href="/" style={{ color: "inherit", fontWeight: 800, textDecoration: "none", opacity: 0.7 }}>
          ✕ Exit
        </Link>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }} aria-hidden="true">
            <AnimalIcon kind="turtle" size={64} />
            <AnimalIcon kind="rabbit" size={64} />
          </div>
          <h1 style={{ margin: "0.4rem 0 0.2rem", fontSize: "2rem", fontWeight: 900 }}>Music Train</h1>
          <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.45 }}>
            Listen: is the music fast or slow? Choose who drives the train, then watch it run with the beat. Every right answer adds a
            carriage. 10 pieces a round, up to 3 stars.
          </p>
        </div>

        <section style={card} role="radiogroup" aria-label="Level">
          <div style={{ fontWeight: 900 }}>Level</div>
          {LEVEL_KEYS.map((key) => (
            <button key={key} type="button" role="radio" aria-checked={key === level} onClick={() => setLevel(key)} style={option(key === level)}>
              <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{LEVELS[key].label}</div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", opacity: 0.75 }}>{LEVELS[key].detail}</div>
            </button>
          ))}
        </section>

        <section style={card}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
            <input type="checkbox" checked={italian} onChange={(e) => setItalian(e.target.checked)} style={{ width: 24, height: 24, accentColor: colors.blueText }} />
            <span>
              <span style={{ fontWeight: 900 }}>Italian tempo words</span>
              <span style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", opacity: 0.7 }}>
                Largo, Andante, Allegro, Presto (and accelerando, ritardando) next to the animals, for older students
              </span>
            </span>
          </label>
        </section>

        <RunnerCard runner={runner} onChange={() => setPicking("change")} />

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
          All aboard!
        </button>
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.85rem", fontWeight: 700, opacity: 0.6 }}>Sound on 🔊 · You are the conductor at the station</p>
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
