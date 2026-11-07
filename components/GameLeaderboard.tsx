"use client";

import { useState } from "react";
import { colors, radius, solidShadow } from "@/lib/theme";
import type { Leaderboards } from "@/lib/gameLeaderboard";

const MEDAL = ["🥇", "🥈", "🥉"];
const OVERALL = "overall";

// Game leaderboard card for one class: "Overall" plus one board per game,
// picked from a dropdown. Boards arrive pre-ranked (lib/gameLeaderboard.ts)
// — the teacher's class page builds them from RLS-scoped reads, the student
// dashboard builds them server-side — so this only renders.
export default function GameLeaderboard({
  boards,
  currentStudentId,
  emptyMessage,
  limit = 10,
}: {
  boards: Leaderboards;
  currentStudentId?: string;
  // Shown when nobody has played yet; omit to render nothing instead.
  emptyMessage?: string;
  limit?: number;
}) {
  const [selected, setSelected] = useState(OVERALL);

  if (boards.overall.length === 0) {
    if (!emptyMessage) return null;
    return <p style={{ opacity: 0.6, fontWeight: 600, margin: 0 }}>{emptyMessage}</p>;
  }

  const game = boards.games.find((g) => g.gameId === selected);
  const isOverall = !game;
  const entries = (game ? game.entries : boards.overall).slice(0, limit);

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.6rem" }}>
        <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>🎮 Game Leaderboard</span>
        <select
          aria-label="Choose a leaderboard"
          value={isOverall ? OVERALL : selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            fontSize: "0.78rem",
            fontWeight: 700,
            padding: "0.3rem 0.5rem",
            borderRadius: radius.pill,
            border: `1px solid ${colors.inputBorder}`,
            background: colors.white,
            color: colors.textPrimary,
            maxWidth: "60%",
          }}
        >
          <option value={OVERALL}>Overall</option>
          {boards.games.map((g) => (
            <option key={g.gameId} value={g.gameId}>
              {g.title}
            </option>
          ))}
        </select>
      </div>

      <span style={{ fontSize: "0.72rem", fontWeight: 600, opacity: 0.6 }}>
        {isOverall ? "Best score in each game, added up" : "Best score in this game"}
      </span>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {entries.map((entry, i) => {
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
              <span style={{ opacity: 0.7, whiteSpace: "nowrap" }}>
                {isOverall
                  ? `${Math.round(entry.score)} · ${entry.gamesPlayed} ${entry.gamesPlayed === 1 ? "game" : "games"}`
                  : `${Math.round(entry.score)}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
