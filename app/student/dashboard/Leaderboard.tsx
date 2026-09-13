"use client";

import { useState } from "react";
import { colors, radius, solidShadow } from "@/lib/theme";

interface BoardEntry {
  studentId: string;
  name: string;
  points: number;
}

const MEDAL = ["🥇", "🥈", "🥉"];

// Both periods are pre-computed server-side (page.tsx) and handed over —
// this component only toggles which array is on screen, no extra fetches
// and no client-side querying of other students' data.
export default function Leaderboard({
  weeklyBoard,
  monthlyBoard,
  currentStudentId,
}: {
  weeklyBoard: BoardEntry[];
  monthlyBoard: BoardEntry[];
  currentStudentId: string;
}) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const board = period === "week" ? weeklyBoard : monthlyBoard;

  if (board.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        width: "100%",
        maxWidth: "480px",
        padding: "1rem 1.25rem",
        borderRadius: radius.card,
        background: colors.white,
        boxShadow: solidShadow(4, colors.rosterCardShadow),
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>🏆 Class Leaderboard</span>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                padding: "0.25rem 0.6rem",
                borderRadius: radius.pill,
                border: period === p ? "none" : `1px solid ${colors.inputBorder}`,
                background: period === p ? colors.blueText : colors.white,
                color: period === p ? colors.white : colors.textPrimary,
                cursor: "pointer",
              }}
            >
              {p === "week" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {board.slice(0, 10).map((entry, i) => {
          const isMe = entry.studentId === currentStudentId;
          return (
            <div
              key={entry.studentId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.6rem",
                padding: "0.4rem 0.6rem",
                borderRadius: radius.iconSquare,
                background: isMe ? colors.inProgressCardBg : "transparent",
                fontWeight: isMe ? 800 : 600,
                fontSize: "0.85rem",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ width: "1.4rem", textAlign: "center" }}>{MEDAL[i] ?? i + 1}</span>
                <span>
                  {entry.name}
                  {isMe && " (you)"}
                </span>
              </span>
              <span style={{ opacity: 0.7, whiteSpace: "nowrap" }}>{entry.points} pts</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
