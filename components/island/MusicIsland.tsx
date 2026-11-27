"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SvgPuppet from "@/components/characters/SvgPuppet";
import type { CharacterChoice } from "@/components/characters/choice";
import { IslandMap, type GameProgress } from "./IslandMap";

// The student's home screen: Music Island with a slim top bar. The
// dashboard (app/student/dashboard/page.tsx) works out the progress, the
// homework and where each landmark leads, on the server; this adds what
// only the device knows (games played for practice, not saved anywhere)
// and the screen size.

const INK = "#2B2745";
const PLAYED_KEY = "ritmo.island.played";

function loadPlayed(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(PLAYED_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function MusicIsland({
  name,
  levelLabel,
  character,
  progress,
  hrefs,
  notes,
  homeworkCount,
}: {
  name: string;
  levelLabel: string;
  character: CharacterChoice;
  progress: Record<string, GameProgress>;
  hrefs: Record<string, string | null>;
  notes: Record<string, string>;
  homeworkCount: number;
}) {
  const router = useRouter();
  const [compact, setCompact] = useState(false);
  const [played, setPlayed] = useState<string[]>([]);

  useEffect(() => {
    setPlayed(loadPlayed());
    const update = () => setCompact(Math.min(window.innerWidth, window.innerHeight) < 500);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // "New!" goes once a game has been played, saved or just for practice.
  const merged: Record<string, GameProgress> = { ...progress };
  for (const id of played) merged[id] = { ...(merged[id] ?? {}), played: true };

  const navigate = (href: string) => {
    const id = Object.keys(hrefs).find((k) => hrefs[k] === href);
    if (id && !played.includes(id)) {
      try {
        window.localStorage.setItem(PLAYED_KEY, JSON.stringify([...played, id]));
      } catch {
        // private mode
      }
    }
    router.push(href);
  };

  const toLessons = () => document.getElementById("lessons")?.scrollIntoView({ behavior: "smooth" });

  return (
    <section aria-label="Music Island" style={{ position: "relative", height: "100dvh", minHeight: 320, background: "#7CCBF2", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: compact ? 0 : 64, bottom: 0 }}>
        <IslandMap progress={merged} hrefs={hrefs} notes={notes} character={character} compact={compact} onNavigate={navigate} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          padding: compact ? "max(6px, env(safe-area-inset-top)) 10px 0" : "max(10px, env(safe-area-inset-top)) 16px 0",
          pointerEvents: "none",
          zIndex: 3,
        }}
      >
        <div style={{ ...pill, padding: compact ? "3px 12px 3px 4px" : "4px 16px 4px 4px", pointerEvents: "auto", minWidth: 0 }}>
          <div style={{ width: compact ? 34 : 44, height: compact ? 34 : 44, flex: "0 0 auto", borderRadius: 999, background: "#FFE9A8", overflow: "hidden", border: `3px solid ${INK}` }}>
            <SvgPuppet choice={character} freezeAt={0} style={{ width: "100%", height: "auto", transform: "scale(1.9) translateY(14%)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, minWidth: 0 }}>
            <span style={{ fontWeight: 900, fontSize: compact ? 15 : 18, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Hi, {name}!</span>
            {!compact && <span style={{ fontWeight: 800, fontSize: 13, opacity: 0.65 }}>{levelLabel}</span>}
          </div>
        </div>
        {!compact && <div style={{ ...pill, fontSize: 20, fontWeight: 900 }}>Music Island</div>}
        <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
          <button type="button" onClick={toLessons} style={{ ...pill, border: `3px solid ${INK}`, background: homeworkCount > 0 ? "#FFE27A" : "#FFFFFF", fontWeight: 900, fontSize: compact ? 14 : 16, cursor: "pointer", minHeight: 44 }}>
            <Notebook /> Homework{homeworkCount > 0 ? ` · ${homeworkCount}` : ""}
          </button>
          <button type="button" onClick={toLessons} aria-label="My lessons, scores and more" style={{ ...pill, fontWeight: 800, fontSize: compact ? 14 : 15, cursor: "pointer", minHeight: 44 }}>
            More ↓
          </button>
        </div>
      </div>
    </section>
  );
}

function Notebook() {
  return (
    <svg viewBox="0 0 20 24" width={16} height={20} aria-hidden="true">
      <rect x={2} y={2} width={16} height={20} rx={2} fill="#FFFFFF" stroke={INK} strokeWidth={2} />
      <path d="M6,8 h8 M6,12 h8 M6,16 h5" stroke={INK} strokeWidth={1.8} />
    </svg>
  );
}

const pill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(255,255,255,0.95)",
  color: INK,
  borderRadius: 999,
  padding: "6px 14px",
  boxShadow: "0 3px 0 rgba(0,0,0,0.18)",
  border: "none",
  fontFamily: "inherit",
};
