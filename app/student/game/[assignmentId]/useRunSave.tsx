"use client";

import { useRef, useState } from "react";
import { colors } from "@/lib/theme";

// One assigned runner game's runs: each run gets a run id from the server
// when it starts (/api/student/runs/start) and is checked and scored by the
// server when it ends (/api/student/runs/finish); the score shown in the
// game is only the browser's own count. Used by RunnerPlayer (Note Runner,
// Up or Down) and SharedGamePlayer (Piano Hop, Happy or Sad, Rhythm Jump,
// Music Train).

export type Save =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; points: number; accuracy: number; best: number; bestAccuracy: number; newBest: boolean }
  | { state: "error"; message: string };

export interface Best {
  points: number;
  accuracy: number;
}

export function useRunSave(assignmentId: string, initialBest: Best | null) {
  const [best, setBest] = useState<Best | null>(initialBest);
  const [save, setSave] = useState<Save>({ state: "idle" });
  const runIdRef = useRef<Promise<string | null> | null>(null);

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
        // Still sent if the student leaves the page right away (Exit).
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, answers }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setSave({ state: "error", message: d?.error || "Couldn't save this run." });
        return;
      }
      setBest({ points: d.best, accuracy: Number(d.bestAccuracy ?? 0) });
      setSave({
        state: "saved",
        points: d.points,
        accuracy: Number(d.accuracy ?? 0),
        best: d.best,
        bestAccuracy: Number(d.bestAccuracy ?? 0),
        newBest: d.newBest,
      });
    } catch {
      setSave({ state: "error", message: "Couldn't save this run (no connection)." });
    }
  };

  // A round left before its end: nothing to save (rounds only count whole).
  const onRoundAbandoned = () => {
    runIdRef.current = null;
  };

  return { best, save, onRunStart, onRunEnd, onRoundAbandoned };
}

// The line on the game-over panel. byAccuracy: rounds (best = highest %).
export function SaveNote({ save, byAccuracy = false }: { save: Save; byAccuracy?: boolean }) {
  const style: React.CSSProperties = { margin: 0, fontWeight: 800, fontSize: "0.95rem" };
  if (save.state === "saving") return <p style={{ ...style, opacity: 0.6 }}>Saving…</p>;
  if (save.state === "error") return <p style={{ ...style, color: colors.coralText }}>{save.message}</p>;
  if (save.state === "saved") {
    const bestText = byAccuracy ? `${Math.round(save.bestAccuracy)}%` : `${save.best.toLocaleString()} pts`;
    return (
      <p style={{ ...style, color: colors.greenCardShadow }}>
        {save.newBest ? `🏆 New best! ${bestText}` : `Saved · your best: ${bestText}`}
      </p>
    );
  }
  return null;
}
