import { colors, radius, solidShadow } from "@/lib/theme";
import { shadowForColor } from "@/lib/teamColors";

export interface LeaderboardTeam {
  id: string;
  name: string;
  color: string;
  score: number;
}

// Live team leaderboard for Team Battle — shared by the teacher's host view
// (app/games/play/[id]/TeamBattleHost.tsx) and the student play view
// (app/student/play/[sessionId]/TeamBattlePlayer.tsx), both of which keep
// `teams` fresh via a Realtime subscription and just re-render this.
export default function TeamLeaderboard({ teams }: { teams: LeaderboardTeam[] }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", width: "100%" }}>
      {sorted.map((team, i) => (
        <div
          key={team.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            background: team.color,
            boxShadow: solidShadow(4, shadowForColor(team.color)),
            borderRadius: radius.iconSquare,
            padding: "0.75rem 1rem",
            color: colors.white,
          }}
        >
          <span style={{ width: "1.5rem", fontWeight: 800, direction: "ltr" }}>{i + 1}</span>
          <span style={{ flex: 1, textAlign: "left", fontWeight: 800 }}>{team.name}</span>
          <span style={{ fontWeight: 800, direction: "ltr" }}>{team.score}</span>
        </div>
      ))}
    </div>
  );
}
