"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { RunnerCard, RunnerPickerScreen, useRunnerChoice } from "@/components/characters/RunnerChoice";
import { noteRunnerConfig, type RunnerSettings } from "@/lib/runnerGames";
import type { RunSummary } from "@/components/noteRunner/NoteRunnerGame";
import type { UpOrDownRunSummary } from "@/components/upOrDown/UpOrDownGame";

// An assigned Note Runner / Up or Down game. The teacher chose the
// settings; the student can play as many runs as they like, and the best
// one counts. Each run gets a run id from the server when it starts
// (/api/student/runs/start) and is checked and scored by the server when
// it ends (/api/student/runs/finish); the score shown in the game is only
// the browser's own count.

const loadNoteRunner = () => import("@/components/noteRunner/NoteRunnerGame");
const loadUpOrDown = () => import("@/components/upOrDown/UpOrDownGame");
const loading = () => (
  <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#BFE3F5" }}>
    <p style={{ fontWeight: 800 }}>Loading…</p>
  </main>
);
const NoteRunnerGame = dynamic(loadNoteRunner, { ssr: false, loading });
const UpOrDownGame = dynamic(loadUpOrDown, { ssr: false, loading });

type Save =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; points: number; best: number; newBest: boolean }
  | { state: "error"; message: string };

export default function RunnerPlayer({
  assignmentId,
  title,
  settings,
  initialBest,
}: {
  assignmentId: string;
  title: string;
  settings: RunnerSettings;
  initialBest: number | null;
}) {
  const [runKey, setRunKey] = useState<number | null>(null);
  const [best, setBest] = useState(initialBest);
  const [save, setSave] = useState<Save>({ state: "idle" });
  const { runner, chosen, picking, setPicking, save: saveRunner } = useRunnerChoice();
  const runIdRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    (settings.game === "note_runner" ? loadNoteRunner() : loadUpOrDown()).catch(() => {});
  }, [settings.game]);

  const onRunStart = () => {
    setSave({ state: "idle" });
    runIdRef.current = fetch("/api/student/runs/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (typeof d?.runId === "string" ? d.runId : null))
      .catch(() => null);
  };

  const onRunEnd = async (answers: unknown[]) => {
    const pending = runIdRef.current;
    runIdRef.current = null;
    if (!pending || answers.length === 0) return;
    setSave({ state: "saving" });
    const runId = await pending;
    if (!runId) {
      setSave({ state: "error", message: "Couldn't save this run (no connection when it started)." });
      return;
    }
    try {
      const r = await fetch("/api/student/runs/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, answers }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setSave({ state: "error", message: d?.error || "Couldn't save this run." });
        return;
      }
      setBest(d.best);
      setSave({ state: "saved", points: d.points, best: d.best, newBest: d.newBest });
    } catch {
      setSave({ state: "error", message: "Couldn't save this run (no connection)." });
    }
  };

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

function SaveNote({ save }: { save: Save }) {
  const style: React.CSSProperties = { margin: 0, fontWeight: 800, fontSize: "0.95rem" };
  if (save.state === "saving") return <p style={{ ...style, opacity: 0.6 }}>Saving…</p>;
  if (save.state === "error") return <p style={{ ...style, color: colors.coralText }}>{save.message}</p>;
  if (save.state === "saved") {
    return (
      <p style={{ ...style, color: colors.greenCardShadow }}>
        {save.newBest ? `🏆 New best! ${save.best.toLocaleString()} pts` : `Saved · your best: ${save.best.toLocaleString()} pts`}
      </p>
    );
  }
  return null;
}
