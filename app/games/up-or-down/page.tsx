"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { LEVELS, type UpOrDownLevel } from "@/lib/upOrDown";

// Up or Down, stage 1: an ear-training runner on its own unlisted page
// (not in the library yet, no database). Three.js is only in the game's
// chunk, loaded by this page alone.

const loadGame = () => import("@/components/upOrDown/UpOrDownGame");
const UpOrDownGame = dynamic(loadGame, {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#BFE3F5" }}>
      <p style={{ fontWeight: 800 }}>Loading Up or Down…</p>
    </main>
  ),
});

const LEVEL_KEYS: UpOrDownLevel[] = ["easy", "medium", "hard"];

export default function UpOrDownPage() {
  const [level, setLevel] = useState<UpOrDownLevel>("easy");
  const [runKey, setRunKey] = useState<number | null>(null);

  useEffect(() => {
    loadGame().catch(() => {});
  }, []);

  if (runKey !== null) {
    return <UpOrDownGame key={runKey} level={level} autoStart onChangeSettings={() => setRunKey(null)} />;
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
          <div style={{ fontSize: "3rem", lineHeight: 1 }}>⬆️👂⬇️</div>
          <h1 style={{ margin: "0.4rem 0 0.2rem", fontSize: "2rem", fontWeight: 900 }}>Up or Down</h1>
          <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.45 }}>
            Before each fork you hear two notes. If the second is higher, take the bridge ⬆️; if it is lower, take
            the tunnel ⬇️. 3 hearts — the more you get right, the faster you run.
          </p>
        </div>
        <section
          style={{
            background: colors.white,
            borderRadius: radius.card,
            padding: "1rem",
            boxShadow: solidShadow(4, colors.rosterCardShadow),
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
          }}
          role="radiogroup"
          aria-label="Level"
        >
          <div style={{ fontWeight: 900 }}>Level</div>
          {LEVEL_KEYS.map((key) => {
            const on = key === level;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setLevel(key)}
                style={{
                  textAlign: "left",
                  padding: "0.75rem 0.9rem",
                  borderRadius: "14px",
                  border: `2px solid ${on ? colors.blueText : colors.neutralGray}`,
                  background: on ? colors.blueBackground : colors.white,
                  color: colors.textPrimary,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{LEVELS[key].label}</div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", opacity: 0.75 }}>{LEVELS[key].detail}</div>
              </button>
            );
          })}
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
          Computer: ↑ ↓ keys{" "}
          {level === "hard" ? "(→ for Same) " : ""}· Tablet: tap a path or swipe up/down · Sound on 🔊
        </p>
      </div>
    </main>
  );
}
