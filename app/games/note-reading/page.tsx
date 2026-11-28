"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import NoteReadingSettings from "@/components/NoteReadingSettings";
import NoteStaff from "@/components/NoteStaff";
import {
  DEFAULT_NOTE_READING_CONFIG,
  configLabel,
  generateFromConfig,
  normalizeNoteReadingConfig,
  type NoteReadingConfig,
  type NoteReadingQuestion,
} from "@/lib/noteReading";
import GamePlayer from "@/app/student/game/[assignmentId]/GamePlayer";

// Note Reading, free practice: the student picks the clef, level, note
// names and sharps/flats, and plays 10 fresh questions, as often as they
// like. Made in the browser from lib/noteReading.ts (the same questions as
// an assignment) and played in the same player; nothing is saved (no
// leaderboard, no progress). Music Island opens this when there's no Note
// Reading homework (lib/islandProgress.ts).

const SETTINGS_KEY = "ritmo.noteReading.practice";
const PRACTICE_COUNT = 10;

type Screen = "settings" | "game";

export default function NoteReadingPracticePage() {
  const [config, setConfig] = useState<NoteReadingConfig>({ ...DEFAULT_NOTE_READING_CONFIG, count: PRACTICE_COUNT });
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>("settings");
  const [questions, setQuestions] = useState<NoteReadingQuestion[]>([]);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SETTINGS_KEY);
      if (saved) setConfig({ ...normalizeNoteReadingConfig(JSON.parse(saved)), count: PRACTICE_COUNT });
    } catch {
      // nothing saved
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
    } catch {
      // private mode
    }
  }, [loaded, config]);

  const play = () => {
    unlockNoteAudio();
    setQuestions(generateFromConfig({ ...config, count: PRACTICE_COUNT }));
    setRunKey(Date.now());
    setScreen("game");
  };

  if (screen === "game") {
    return (
      <GamePlayer
        key={runKey}
        assignmentId=""
        title={`Note Reading – ${configLabel(config)}`}
        questions={questions}
        alreadyCompleted={false}
        savedScore={null}
        practice={{ onPlayAgain: play, onChangeSettings: () => setScreen("settings") }}
      />
    );
  }

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
          <div style={{ width: 150, margin: "0 auto" }} aria-hidden="true">
            <NoteStaff note={{ clef: config.clef === "bass" ? "bass" : "treble", step: "G", octave: config.clef === "bass" ? 2 : 4, accidental: null }} />
          </div>
          <h1 style={{ margin: "0.4rem 0 0.2rem", fontSize: "2rem", fontWeight: 900 }}>Note Reading</h1>
          <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.45 }}>
            Name the note on the staff. Choose your clef and level, then play {PRACTICE_COUNT} fresh notes — as often as you like.
          </p>
        </div>

        <section style={card}>
          <NoteReadingSettings value={config} onChange={setConfig} showCount={false} />
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
          Start practice
        </button>
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.85rem", fontWeight: 700, opacity: 0.6 }}>
          Practice only: scores aren&apos;t saved. Homework from your teacher opens from the island.
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
