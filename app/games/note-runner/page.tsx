"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import NoteReadingSettings from "@/components/NoteReadingSettings";
import { colors, radius, solidShadow } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { DEFAULT_NOTE_READING_CONFIG, configLabel } from "@/lib/noteReading";
import type { NoteRunnerConfig } from "@/lib/noteRunner";

// Note Runner, stage 1: a playable version on its own unlisted page (not in
// the library yet). Three.js is only in NoteRunnerGame's chunk, loaded by
// this page alone, so the rest of the site never downloads it.

const loadGame = () => import("@/components/noteRunner/NoteRunnerGame");
const NoteRunnerGame = dynamic(loadGame, {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#BFE3F5" }}>
      <p style={{ fontWeight: 800 }}>Loading Note Runner…</p>
    </main>
  ),
});

export default function NoteRunnerPage() {
  const [config, setConfig] = useState<NoteRunnerConfig>({ ...DEFAULT_NOTE_READING_CONFIG, count: 1 });
  const [runKey, setRunKey] = useState<number | null>(null);

  // Start downloading the 3D code while the student picks settings.
  useEffect(() => {
    loadGame().catch(() => {});
  }, []);

  if (runKey !== null) {
    return (
      <NoteRunnerGame key={runKey} config={config} autoStart onChangeSettings={() => setRunKey(null)} />
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
          <div style={{ fontSize: "3rem", lineHeight: 1 }}>🏃🎵</div>
          <h1 style={{ margin: "0.4rem 0 0.2rem", fontSize: "2rem", fontWeight: 900 }}>Note Runner</h1>
          <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.45 }}>
            A note name appears at the top. Run to the note head with that name before the notes reach
            you. 3 lives — the more you get right, the faster it goes.
          </p>
        </div>
        <section
          style={{
            background: colors.white,
            borderRadius: radius.card,
            padding: "1rem",
            boxShadow: solidShadow(4, colors.rosterCardShadow),
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: "0.75rem" }}>
            Settings{" "}
            <span style={{ fontWeight: 700, opacity: 0.6, marginLeft: "0.4rem" }}>{configLabel(config)}</span>
          </div>
          <NoteReadingSettings value={config} onChange={setConfig} showCount={false} />
        </section>
        <button
          type="button"
          onClick={() => {
            unlockNoteAudio();
            setRunKey(Date.now());
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
          Run!
        </button>
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.85rem", fontWeight: 700, opacity: 0.6 }}>
          Computer: ↑ ↓ keys · Tablet: tap a note head or swipe up/down · Sound on 🔊
        </p>
      </div>
    </main>
  );
}
