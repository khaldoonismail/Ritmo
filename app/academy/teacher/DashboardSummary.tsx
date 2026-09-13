"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { lessonTitle as legacyLessonTitle } from "@/lib/lessons";
import { colors, radius, solidShadow } from "@/lib/theme";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TopGame {
  id: string;
  title: string;
  usage_count: number;
}

interface LastActivity {
  studentName: string;
  title: string;
  updatedAt: string;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Quick-glance stats for the teacher's home screen: how many students they
// have, when a student last did something, and which of their own games get
// assigned the most (games.usage_count, shared with the Games Library page).
export default function DashboardSummary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [studentCount, setStudentCount] = useState(0);
  const [lastActivity, setLastActivity] = useState<LastActivity | null>(null);
  const [topGames, setTopGames] = useState<TopGame[]>([]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!teacherRow) {
        setLoading(false);
        return;
      }

      const [{ data: classRows }, { data: topGameRows }] = await Promise.all([
        supabase.from("classes").select("id"),
        supabase
          .from("games")
          .select("id, title, usage_count")
          .eq("teacher_id", teacherRow.id)
          .order("usage_count", { ascending: false })
          .limit(3),
      ]);

      setTopGames((topGameRows || []).filter((g) => g.usage_count > 0));

      const classIds = (classRows || []).map((c) => c.id);
      if (classIds.length === 0) {
        setLoading(false);
        return;
      }

      const [{ data: studentRows }, { data: assignmentRows }] = await Promise.all([
        supabase.from("students").select("id, name").in("class_id", classIds),
        supabase.from("assignments").select("id, lesson_id, game_id").in("class_id", classIds),
      ]);

      setStudentCount((studentRows || []).length);
      const studentNameById = new Map((studentRows || []).map((s) => [s.id, s.name]));

      const assignmentIds = (assignmentRows || []).map((a) => a.id);
      if (assignmentIds.length > 0) {
        const { data: recentProgress } = await supabase
          .from("student_progress")
          .select("student_id, assignment_id, updated_at")
          .in("assignment_id", assignmentIds)
          .neq("status", "not_started")
          .order("updated_at", { ascending: false })
          .limit(1);

        const row = (recentProgress || [])[0];
        if (row) {
          const assignment = (assignmentRows || []).find((a) => a.id === row.assignment_id);
          let title = "an assignment";
          if (assignment?.game_id) {
            const { data: game } = await supabase
              .from("games")
              .select("title")
              .eq("id", assignment.game_id)
              .maybeSingle();
            title = game?.title ?? title;
          } else if (assignment?.lesson_id) {
            if (UUID_RE.test(assignment.lesson_id)) {
              const { data: lesson } = await supabase
                .from("lessons")
                .select("title")
                .eq("id", assignment.lesson_id)
                .maybeSingle();
              title = lesson?.title ?? title;
            } else {
              title = legacyLessonTitle(assignment.lesson_id);
            }
          }

          setLastActivity({
            studentName: studentNameById.get(row.student_id) ?? "A student",
            title,
            updatedAt: row.updated_at,
          });
        }
      }

      setLoading(false);
    }

    load().catch((e) => {
      setError(e instanceof Error ? e.message : "Could not load dashboard summary.");
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <p style={{ opacity: 0.6, fontWeight: 600, fontSize: "0.85rem", margin: 0 }}>
        Loading summary...
      </p>
    );
  }

  if (error) {
    return <p style={{ color: colors.coralText, fontSize: "0.85rem", fontWeight: 600, margin: 0 }}>{error}</p>;
  }

  const statCardStyle: React.CSSProperties = {
    flex: "1 1 140px",
    borderRadius: radius.card,
    padding: "0.9rem 1rem",
    background: colors.white,
    boxShadow: solidShadow(4, colors.rosterCardShadow),
    textAlign: "left",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", maxWidth: "650px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={statCardStyle}>
          <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{studentCount}</div>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, opacity: 0.6 }}>
            student{studentCount === 1 ? "" : "s"}
          </div>
        </div>

        <div style={statCardStyle}>
          {lastActivity ? (
            <>
              <div style={{ fontSize: "0.85rem", fontWeight: 800 }}>
                {lastActivity.studentName} · {lastActivity.title}
              </div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, opacity: 0.6 }}>
                {timeAgo(lastActivity.updatedAt)}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, opacity: 0.6 }}>No activity yet</div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, opacity: 0.5 }}>Last activity</div>
            </>
          )}
        </div>
      </div>

      {topGames.length > 0 && (
        <div style={statCardStyle}>
          <div style={{ fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.4rem" }}>
            🔥 Most-used games
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {topGames.map((g) => (
              <div
                key={g.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                <span>{g.title}</span>
                <span style={{ opacity: 0.6 }}>
                  {g.usage_count} use{g.usage_count === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/games/teacher/library"
            style={{ fontSize: "0.75rem", fontWeight: 700, opacity: 0.6, color: "inherit", textDecoration: "underline" }}
          >
            View Games Library →
          </Link>
        </div>
      )}
    </div>
  );
}
