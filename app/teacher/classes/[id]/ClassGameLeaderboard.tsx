"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { colors } from "@/lib/theme";
import GameLeaderboard from "@/components/GameLeaderboard";
import { buildLeaderboards, type Leaderboards } from "@/lib/gameLeaderboard";
import { isRunnerGenerator, rankByOf } from "@/lib/runnerGames";

interface StudentLite {
  id: string;
  name: string;
}

// Teacher view of the class game leaderboard. game_results is readable here
// through its teacher-only RLS policy (0025_game_results.sql); teachers see
// full names, unlike the student dashboard's first-names-only board.
export default function ClassGameLeaderboard({ classId, students }: { classId: string; students: StudentLite[] }) {
  const [boards, setBoards] = useState<Leaderboards | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data: rows, error: rowsError } = await supabase
        .from("game_results")
        .select("student_id, game_id, accuracy, points, variant")
        .eq("class_id", classId);
      if (cancelled) return;
      if (rowsError) {
        setError(rowsError.message);
        return;
      }

      const gameIds = [...new Set((rows || []).map((r) => r.game_id))];
      let titleByGame = new Map<string, string>();
      // Endless runs (Note Runner, Up or Down, Piano Hop) rank by points.
      const pointsRanked = new Set<string>();
      if (gameIds.length > 0) {
        const { data: games } = await supabase.from("games").select("id, title, generator").in("id", gameIds);
        titleByGame = new Map((games || []).map((g) => [g.id, g.title]));
        for (const g of games || []) if (isRunnerGenerator(g.generator) && rankByOf(g.generator) === "points") pointsRanked.add(g.id);
      }
      if (cancelled) return;

      const nameByStudent = new Map(students.map((s) => [s.id, s.name]));
      setBoards(buildLeaderboards(rows || [], nameByStudent, titleByGame, pointsRanked));
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, students]);

  if (error) return <p style={{ color: colors.coralText, fontWeight: 600, margin: 0 }}>{error}</p>;
  if (!boards) return <p style={{ opacity: 0.6, fontWeight: 600, margin: 0 }}>Loading...</p>;
  return (
    <GameLeaderboard
      boards={boards}
      emptyMessage="No games played yet. Results appear here after a Team Battle ends or a student submits an assigned game."
    />
  );
}
