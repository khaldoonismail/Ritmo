"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { lessonTitle as legacyLessonTitle } from "@/lib/lessons";
import { colors, radius, solidShadow } from "@/lib/theme";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STRUGGLE_THRESHOLD = 60; // score below this on a completed attempt counts as "struggled"

interface ContentStat {
  key: string;
  kind: "lesson" | "game";
  title: string;
  assigned: number;
  completed: number;
  completionRate: number;
  averageScore: number | null;
  struggleCount: number;
  struggleRate: number | null; // null when nothing has been completed yet
}

export default function AnalyticsReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ContentStat[]>([]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/accounts/login");
        return;
      }

      const { data: assignmentRows, error: assignmentsError } = await supabase
        .from("assignments")
        .select("id, lesson_id, game_id");

      if (assignmentsError) {
        setError(assignmentsError.message);
        setLoading(false);
        return;
      }

      const assignmentIds = (assignmentRows || []).map((a) => a.id);
      if (assignmentIds.length === 0) {
        setStats([]);
        setLoading(false);
        return;
      }

      const { data: progressRows, error: progressError } = await supabase
        .from("student_progress")
        .select("assignment_id, status, score")
        .in("assignment_id", assignmentIds);

      if (progressError) {
        setError(progressError.message);
        setLoading(false);
        return;
      }

      // Group assignments by the piece of content they point at (a lesson or
      // a game may be assigned many times, across many classes).
      const contentKey = (a: { lesson_id: string | null; game_id: string | null }) =>
        a.game_id ? `game:${a.game_id}` : `lesson:${a.lesson_id}`;

      const assignmentIdsByContent = new Map<string, string[]>();
      for (const a of assignmentRows || []) {
        const key = contentKey(a);
        const list = assignmentIdsByContent.get(key) || [];
        list.push(a.id);
        assignmentIdsByContent.set(key, list);
      }

      const progressByAssignment = new Map<string, { status: string; score: number | null }[]>();
      for (const p of progressRows || []) {
        const list = progressByAssignment.get(p.assignment_id) || [];
        list.push({ status: p.status, score: p.score });
        progressByAssignment.set(p.assignment_id, list);
      }

      // Resolve titles: games via the games table, lessons via the lessons
      // table when the id is a real uuid, else the static legacy catalog
      // (matches the pattern used on the weekly report / dashboard).
      const gameIds = [...assignmentIdsByContent.keys()]
        .filter((k) => k.startsWith("game:"))
        .map((k) => k.slice(5));
      const lessonIds = [...assignmentIdsByContent.keys()]
        .filter((k) => k.startsWith("lesson:"))
        .map((k) => k.slice(7));
      const realLessonIds = lessonIds.filter((id) => UUID_RE.test(id));

      const [{ data: gameRows }, { data: lessonRows }] = await Promise.all([
        gameIds.length > 0
          ? supabase.from("games").select("id, title").in("id", gameIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        realLessonIds.length > 0
          ? supabase.from("lessons").select("id, title").in("id", realLessonIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      ]);

      const gameTitleMap = new Map((gameRows || []).map((g) => [g.id, g.title]));
      const lessonTitleMap = new Map((lessonRows || []).map((l) => [l.id, l.title]));

      const nextStats: ContentStat[] = [...assignmentIdsByContent.entries()].map(
        ([key, ids]) => {
          const [kind, id] = key.startsWith("game:")
            ? (["game", key.slice(5)] as const)
            : (["lesson", key.slice(7)] as const);

          const title =
            kind === "game"
              ? gameTitleMap.get(id) ?? "Unknown game"
              : UUID_RE.test(id)
                ? lessonTitleMap.get(id) ?? "Unknown lesson"
                : legacyLessonTitle(id);

          const rows = ids.flatMap((aid) => progressByAssignment.get(aid) || []);
          const assigned = rows.length;
          const completedRows = rows.filter((r) => r.status === "completed");
          const completed = completedRows.length;
          const completionRate = assigned > 0 ? completed / assigned : 0;

          const scored = completedRows.filter((r) => r.score !== null).map((r) => r.score as number);
          const averageScore = scored.length > 0 ? scored.reduce((a, b) => a + b, 0) / scored.length : null;

          const struggleCount = scored.filter((s) => s < STRUGGLE_THRESHOLD).length;
          const struggleRate = scored.length > 0 ? struggleCount / scored.length : null;

          return {
            key,
            kind,
            title,
            assigned,
            completed,
            completionRate,
            averageScore,
            struggleCount,
            struggleRate,
          };
        }
      );

      // Struggling content first (highest struggle rate), content with no
      // completions yet pushed to the bottom rather than sorted as "0 struggle".
      nextStats.sort((a, b) => {
        if (a.struggleRate === null && b.struggleRate === null) return b.assigned - a.assigned;
        if (a.struggleRate === null) return 1;
        if (b.struggleRate === null) return -1;
        return b.struggleRate - a.struggleRate;
      });

      setStats(nextStats);
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) {
    return <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading analytics...</p>;
  }

  if (error) {
    return <p style={{ color: colors.coralText, fontSize: "0.9rem", fontWeight: 600 }}>{error}</p>;
  }

  if (stats.length === 0) {
    return (
      <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>
        No assignments yet — analytics will show up here once students start completing lessons and games.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", width: "100%", maxWidth: "700px" }}>
      <p style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.6, margin: "0 0 0.25rem", textAlign: "left" }}>
        Sorted by struggle rate — the share of completed attempts scoring below {STRUGGLE_THRESHOLD}.
      </p>

      {stats.map((s) => (
        <div
          key={s.key}
          style={{
            borderRadius: radius.card,
            padding: "1rem 1.1rem",
            background: colors.white,
            boxShadow: solidShadow(4, colors.rosterCardShadow),
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.6rem" }}>
            <div style={{ fontWeight: 800 }}>
              {s.kind === "game" ? "🎮 " : "🎵 "}
              {s.title}
            </div>
            {s.struggleRate !== null && (
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  padding: "0.25rem 0.6rem",
                  borderRadius: radius.pill,
                  whiteSpace: "nowrap",
                  background:
                    s.struggleRate >= 0.5
                      ? colors.coralBackground
                      : s.struggleRate >= 0.25
                        ? colors.inProgressCardBg
                        : colors.completedCardBg,
                  color:
                    s.struggleRate >= 0.5
                      ? colors.coralText
                      : s.struggleRate >= 0.25
                        ? colors.classesText
                        : colors.lessonsText,
                }}
              >
                {Math.round(s.struggleRate * 100)}% struggling
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.82rem", fontWeight: 600, opacity: 0.7, marginTop: "0.35rem" }}>
            {s.assigned} assigned · {s.completed} completed ({Math.round(s.completionRate * 100)}%)
            {s.averageScore !== null && ` · avg score ${s.averageScore.toFixed(1)}`}
            {s.struggleRate === null && " · no completions yet"}
          </div>
        </div>
      ))}
    </div>
  );
}
