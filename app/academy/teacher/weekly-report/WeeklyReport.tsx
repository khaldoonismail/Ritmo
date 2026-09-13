"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { lessonTitle as legacyLessonTitle } from "@/lib/lessons";
import { colors, radius, solidShadow } from "@/lib/theme";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const UPCOMING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ClassRow {
  id: string;
  name: string;
}

interface StudentRow {
  id: string;
  name: string;
  class_id: string;
}

interface ProgressRow {
  student_id: string;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
  updated_at: string;
}

interface StudentWeekly {
  studentId: string;
  studentName: string;
  completedThisWeek: number;
  averageScore: number | null;
  lastActivity: string | null;
}

interface UpcomingItem {
  assignmentId: string;
  className: string;
  title: string;
  dueAt: string;
  completedCount: number;
  totalApplicable: number;
}

interface ClassSummary {
  classId: string;
  className: string;
  totalCompletions: number;
  averageScore: number | null;
  students: StudentWeekly[];
}

const AVATAR_COLORS = [
  { bg: colors.orange, shadow: colors.orangeShadow },
  { bg: colors.greenCard, shadow: colors.greenCardShadow },
];

export default function WeeklyReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summaries, setSummaries] = useState<ClassSummary[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const cutoff = new Date(Date.now() - WEEK_MS);

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

      const { data: classRows, error: classesError } = await supabase
        .from("classes")
        .select("id, name")
        .order("name");

      if (classesError) {
        setError(classesError.message);
        setLoading(false);
        return;
      }

      const classIds = (classRows || []).map((c) => c.id);
      if (classIds.length === 0) {
        setSummaries([]);
        setLoading(false);
        return;
      }

      const [{ data: studentRows }, { data: assignmentRows, error: assignmentsError }] =
        await Promise.all([
          supabase.from("students").select("id, name, class_id").in("class_id", classIds),
          supabase
            .from("assignments")
            .select("id, class_id, lesson_id, game_id, student_id, due_at")
            .in("class_id", classIds),
        ]);

      if (assignmentsError) {
        setError(assignmentsError.message);
        setLoading(false);
        return;
      }

      const assignmentIds = (assignmentRows || []).map((a) => a.id);
      const classIdByAssignment = new Map(
        (assignmentRows || []).map((a) => [a.id, a.class_id])
      );

      let progressRows: (ProgressRow & { assignment_id: string })[] = [];
      if (assignmentIds.length > 0) {
        const { data } = await supabase
          .from("student_progress")
          .select("student_id, assignment_id, status, score, updated_at")
          .in("assignment_id", assignmentIds)
          .gte("updated_at", cutoff.toISOString());
        progressRows = data || [];
      }

      const studentsByClass = new Map<string, StudentRow[]>();
      for (const s of studentRows || []) {
        const list = studentsByClass.get(s.class_id) || [];
        list.push(s);
        studentsByClass.set(s.class_id, list);
      }

      // Bucket this week's progress rows per student, scoped to the class
      // the row's assignment belongs to (a student only ever appears in
      // their own class, but assignment -> class is how we know which rows
      // are "this class's activity" at all).
      const rowsByStudent = new Map<string, (ProgressRow & { assignment_id: string })[]>();
      for (const row of progressRows) {
        const list = rowsByStudent.get(row.student_id) || [];
        list.push(row);
        rowsByStudent.set(row.student_id, list);
      }

      const nextSummaries: ClassSummary[] = (classRows || []).map((c) => {
        const students = (studentsByClass.get(c.id) || [])
          .map((s): StudentWeekly => {
            const rows = (rowsByStudent.get(s.id) || []).filter(
              (r) => classIdByAssignment.get(r.assignment_id) === c.id
            );
            const completedThisWeek = rows.filter((r) => r.status === "completed").length;
            const scored = rows.filter((r) => r.score !== null).map((r) => r.score as number);
            const averageScore =
              scored.length > 0 ? scored.reduce((a, b) => a + b, 0) / scored.length : null;
            const lastActivity = rows.length > 0
              ? rows.map((r) => r.updated_at).sort().slice(-1)[0]
              : null;

            return {
              studentId: s.id,
              studentName: s.name,
              completedThisWeek,
              averageScore,
              lastActivity,
            };
          })
          .sort((a, b) => a.studentName.localeCompare(b.studentName));

        const totalCompletions = students.reduce((sum, s) => sum + s.completedThisWeek, 0);
        const allScored = students.flatMap((s) =>
          s.averageScore !== null ? [s.averageScore] : []
        );
        const averageScore =
          allScored.length > 0 ? allScored.reduce((a, b) => a + b, 0) / allScored.length : null;

        return {
          classId: c.id,
          className: c.name,
          totalCompletions,
          averageScore,
          students,
        };
      });

      // Upcoming: assignments due in the next 3 days, with how many of the
      // students they apply to have already completed them (all-time, not
      // just this week — a different question than the weekly summary
      // above).
      const now = Date.now();
      const dueSoon = (assignmentRows || []).filter((a) => {
        if (!a.due_at) return false;
        const msUntilDue = new Date(a.due_at).getTime() - now;
        return msUntilDue >= 0 && msUntilDue <= UPCOMING_WINDOW_MS;
      });

      const dueSoonIds = dueSoon.map((a) => a.id);
      let allTimeProgress: { student_id: string; assignment_id: string; status: string }[] = [];
      if (dueSoonIds.length > 0) {
        const { data } = await supabase
          .from("student_progress")
          .select("student_id, assignment_id, status")
          .in("assignment_id", dueSoonIds);
        allTimeProgress = data || [];
      }

      const realLessonIds = [
        ...new Set(dueSoon.map((a) => a.lesson_id).filter((id): id is string => !!id)),
      ].filter((id) => UUID_RE.test(id));
      let lessonTitleMap = new Map<string, string>();
      if (realLessonIds.length > 0) {
        const { data } = await supabase.from("lessons").select("id, title").in("id", realLessonIds);
        lessonTitleMap = new Map((data || []).map((l) => [l.id, l.title]));
      }

      const gameIds = [
        ...new Set(dueSoon.map((a) => a.game_id).filter((id): id is string => !!id)),
      ];
      let gameTitleMap = new Map<string, string>();
      if (gameIds.length > 0) {
        const { data } = await supabase.from("games").select("id, title").in("id", gameIds);
        gameTitleMap = new Map((data || []).map((g) => [g.id, g.title]));
      }

      const classNameById = new Map((classRows || []).map((c) => [c.id, c.name]));

      const nextUpcoming: UpcomingItem[] = dueSoon
        .map((a): UpcomingItem => {
          const title = a.game_id
            ? gameTitleMap.get(a.game_id) ?? "Unknown game"
            : a.lesson_id
              ? lessonTitleMap.get(a.lesson_id) ?? legacyLessonTitle(a.lesson_id)
              : "Unknown assignment";

          const totalApplicable = a.student_id
            ? 1
            : (studentsByClass.get(a.class_id) || []).length;
          const completedCount = allTimeProgress.filter(
            (p) => p.assignment_id === a.id && p.status === "completed"
          ).length;

          return {
            assignmentId: a.id,
            className: classNameById.get(a.class_id) ?? "Unknown class",
            title,
            dueAt: a.due_at as string,
            completedCount,
            totalApplicable,
          };
        })
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

      setUpcoming(nextUpcoming);
      setSummaries(nextSummaries);
      setLoading(false);
    }

    load();
    // cutoff is derived from Date.now() at render time; intentionally not a
    // dependency so the query window doesn't shift on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (loading) {
    return <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading weekly report...</p>;
  }

  if (error) {
    return <p style={{ color: colors.coralText, fontSize: "0.9rem", fontWeight: 600 }}>{error}</p>;
  }

  if (summaries.length === 0) {
    return (
      <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>
        You don't have any classes yet.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        width: "100%",
        maxWidth: "700px",
      }}
    >
      {upcoming.length > 0 && (
        <div
          style={{
            borderRadius: radius.card,
            padding: "1.1rem 1.25rem",
            background: colors.coralBackground,
            textAlign: "left",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "0.6rem" }}>
            🔔 Due in the next 3 days
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {upcoming.map((u) => (
              <div
                key={u.assignmentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.6rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                }}
              >
                <span>
                  {u.title}{" "}
                  <span style={{ opacity: 0.6, fontWeight: 600 }}>({u.className})</span>
                </span>
                <span style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexShrink: 0 }}>
                  <span style={{ opacity: 0.75, direction: "ltr" }}>
                    {new Date(u.dueAt).toLocaleDateString()}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.2rem 0.55rem",
                      borderRadius: radius.pill,
                      background: colors.coralText,
                      color: colors.white,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {u.completedCount}/{u.totalApplicable} done
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.6, margin: 0, textAlign: "left" }}>
        Activity since{" "}
        <span style={{ direction: "ltr", display: "inline-block" }}>
          {cutoff.toLocaleDateString()}
        </span>
        .
      </p>

      {summaries.map((c) => (
        <div
          key={c.classId}
          style={{
            borderRadius: radius.card,
            padding: "1.25rem",
            background: colors.white,
            boxShadow: solidShadow(4, colors.rosterCardShadow),
            textAlign: "left",
          }}
        >
          <div style={{ marginBottom: "0.85rem" }}>
            <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{c.className}</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.7 }}>
              {c.totalCompletions} lesson{c.totalCompletions === 1 ? "" : "s"} completed this week
              {c.averageScore !== null && ` · class average ${c.averageScore.toFixed(1)} pts`}
            </div>
          </div>

          {c.students.length === 0 ? (
            <p style={{ opacity: 0.6, fontWeight: 600, fontSize: "0.85rem" }}>
              No students in this class yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {c.students.map((s, i) => {
                const avatar = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const noActivity = s.completedThisWeek === 0 && s.lastActivity === null;
                return (
                  <div
                    key={s.studentId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "0.6rem",
                      padding: "0.6rem 0.75rem",
                      borderRadius: radius.iconSquare,
                      background: colors.listRowBg,
                      boxShadow: solidShadow(3, colors.rosterCardShadow),
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: "36px",
                        height: "36px",
                        minWidth: "36px",
                        borderRadius: "50%",
                        background: avatar.bg,
                        boxShadow: solidShadow(3, avatar.shadow),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        color: colors.white,
                      }}
                    >
                      {s.studentName.charAt(0).toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 700, marginRight: "auto" }}>{s.studentName}</span>

                    {noActivity ? (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          padding: "0.3rem 0.6rem",
                          borderRadius: radius.pill,
                          background: colors.neutralGray,
                          color: colors.white,
                          whiteSpace: "nowrap",
                        }}
                      >
                        No activity this week
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.78rem", fontWeight: 700, opacity: 0.75, whiteSpace: "nowrap" }}>
                        {s.completedThisWeek} completed
                        {s.averageScore !== null && ` · avg ${s.averageScore.toFixed(1)} pts`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
