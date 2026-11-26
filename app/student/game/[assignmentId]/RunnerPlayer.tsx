"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { RunnerCard, RunnerPickerScreen, useRunnerChoice } from "@/components/characters/RunnerChoice";
import { noteRunnerConfig, type NoteRunnerSettings, type UpOrDownSettings } from "@/lib/runnerGames";
import { SaveNote, useRunSave } from "./useRunSave";
import type { RunSummary } from "@/components/noteRunner/NoteRunnerGame";
import type { UpOrDownRunSummary } from "@/components/upOrDown/UpOrDownGame";
import { usePianoSamples } from "@/lib/usePianoSamples";

// An assigned Note Runner / Up or Down game. The teacher chose the
// settings; the student can play as many runs as they like, and the best
// one counts (runs are started, checked and saved by ./useRunSave).

const loadNoteRunner = () => import("@/components/noteRunner/NoteRunnerGame");
const loadUpOrDown = () => import("@/components/upOrDown/UpOrDownGame");
const loading = () => (
  <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#BFE3F5" }}>
    <p style={{ fontWeight: 800 }}>Loading…</p>
  </main>
);
const NoteRunnerGame = dynamic(loadNoteRunner, { ssr: false, loading });
const UpOrDownGame = dynamic(loadUpOrDown, { ssr: false, loading });

export default function RunnerPlayer({
  assignmentId,
  title,
  settings,
  initialBest,
}: {
  assignmentId: string;
  title: string;
  settings: NoteRunnerSettings | UpOrDownSettings;
  initialBest: number | null;
}) {
  // Start loading the piano samples while the child picks a level.
  usePianoSamples();
  const [runKey, setRunKey] = useState<number | null>(null);
  const { best: bestRun, save, onRunStart, onRunEnd } = useRunSave(
    assignmentId,
    initialBest === null ? null : { points: initialBest, accuracy: 0 }
  );
  const best = bestRun?.points ?? null;
  const { runner, chosen, picking, setPicking, save: saveRunner } = useRunnerChoice();

  useEffect(() => {
    (settings.game === "note_runner" ? loadNoteRunner() : loadUpOrDown()).catch(() => {});
  }, [settings.game]);

  const endNote = <SaveNote save={save} />;
  const back = () => setRunKey(null);

  if (runKey !== null) {
    return settings.game === "note_runner" ? (
      <NoteRunnerGame
        key={runKey}
        config={noteRunnerConfig(settings)}
        character={runner}
        autoStart
        exitLabel="Back"
        onChangeSettings={back}
        onRunStart={onRunStart}
        onRunEnd={(s: RunSummary) => onRunEnd(s.answers.map((a) => ({ note: a.note, picked: a.picked })))}
        endNote={endNote}
      />
    ) : (
      <UpOrDownGame
        key={runKey}
        level={settings.level}
        character={runner}
        autoStart
        exitLabel="Back"
        onChangeSettings={back}
        onRunStart={onRunStart}
        onRunEnd={(s: UpOrDownRunSummary) => onRunEnd(s.answers)}
        endNote={endNote}
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
          saveRunner(c);
          setPicking(null);
          if (picking === "start") setRunKey(Date.now());
        }}
      />
    );
  }

  const isNoteRunner = settings.game === "note_runner";
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
          <div style={{ fontSize: "3rem", lineHeight: 1 }}>{isNoteRunner ? "🏃🎵" : "⬆️👂⬇️"}</div>
          <h1 style={{ margin: "0.4rem 0 0.2rem", fontSize: "1.8rem", fontWeight: 900 }}>{title}</h1>
          <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.45 }}>
            {isNoteRunner
              ? "A note name appears at the top. Run to the note head with that name before the notes reach you."
              : "Listen to two notes. Higher? Take the bridge ⬆️. Lower? Take the tunnel ⬇️."}
            {!isNoteRunner && settings.level === "hard" && " The same? Go straight ➡️."} Play as often as you
            like — your best run counts.
          </p>
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
            {best === null ? "—" : `${best.toLocaleString()} pts`}
          </div>
        </section>
        <RunnerCard runner={runner} onChange={() => setPicking("change")} />
        <button
          type="button"
          onClick={() => {
            unlockNoteAudio();
            if (!chosen) setPicking("start");
            else setRunKey(Date.now());
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
          {best === null ? "Run!" : "Run again!"}
        </button>
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.85rem", fontWeight: 700, opacity: 0.6 }}>
          Computer: ↑ ↓ keys · Tablet or phone: tap or swipe up/down · Sound on 🔊
        </p>
      </div>
    </main>
  );
}
