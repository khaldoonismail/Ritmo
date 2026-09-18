"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { lessonTitle as legacyLessonTitle } from "@/lib/lessons";
import { colors, radius, solidShadow } from "@/lib/theme";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000; // matches WeeklyReport.tsx's window
const STRUGGLE_THRESHOLD = 60; // matches AnalyticsReport.tsx
const INACTIVE_DAYS = 14;

interface ClassRow {
  id: string;
  name: string;
}
interface StudentRow {
  id: string;
  name: string;
  class_id: string;
}
interface AssignmentRow {
  id: string;
  class_id: string;
  game_id: string | null;
  lesson_id: string | null;
}
interface ProgressRow {
  student_id: string;
  assignment_id: string;
  status: string;
  score: number | null;
  updated_at: string;
}
interface GameRow {
  id: string;
  title: string;
}
interface SessionRow {
  id: string;
  class_id: string | null;
  game_id: string;
  play_mode: string;
  status: string;
  created_at: string;
}

interface ActivityItem {
  id: string;
  when: string;
  kind: "solo" | "team_battle";
  studentName?: string;
  className: string;
  title: string;
  score?: number | null;
}

interface ClassSummary {
  id: string;
  name: string;
  studentCount: number;
  lastActivity: string | null;
}

interface InactiveStudent {
  name: string;
  daysSince: number | null;
}

interface StrugglingItem {
  title: string;
  kind: "lesson" | "game";
  struggleRate: number;
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

export default function TeacherDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [studentCount, setStudentCount] = useState(0);
  const [classCount, setClassCount] = useState(0);
  const [gamesThisWeek, setGamesThisWeek] = useState(0);
  const [avgSuccessRate, setAvgSuccessRate] = useState<number | null>(null);

  const [inactiveStudents, setInactiveStudents] = useState<InactiveStudent[]>([]);
  const [strugglingItems, setStrugglingItems] = useState<StrugglingItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [classSummaries, setClassSummaries] = useState<ClassSummary[]>([]);

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

      const [{ data: classRows }, { data: gameRows }, { data: sessionRows }] = await Promise.all([
        supabase.from("classes").select("id, name"),
        supabase.from("games").select("id, title").eq("teacher_id", teacherRow.id),
        supabase
          .from("game_sessions")
          .select("id, class_id, game_id, play_mode, status, created_at")
          .eq("teacher_id", teacherRow.id)
          .order("created_at", { ascending: false })
          .limit(15),
      ]);

      const classes: ClassRow[] = classRows || [];
      const games: GameRow[] = gameRows || [];
      const sessions: SessionRow[] = sessionRows || [];
      setClassCount(classes.length);

      const classIds = classes.map((c) => c.id);
      if (classIds.length === 0) {
        setLoading(false);
        return;
      }

      const [{ data: studentRows }, { data: assignmentRows }] = await Promise.all([
        supabase.from("students").select("id, name, class_id").in("class_id", classIds),
        supabase.from("assignments").select("id, class_id, game_id, lesson_id").in("class_id", classIds),
      ]);

      const students: StudentRow[] = studentRows || [];
      const assignments: AssignmentRow[] = assignmentRows || [];
      setStudentCount(students.length);

      const assignmentIds = assignments.map((a) => a.id);
      let progressRows: ProgressRow[] = [];
      if (assignmentIds.length > 0) {
        const { data } = await supabase
          .from("student_progress")
          .select("student_id, assignment_id, status, score, updated_at")
          .in("assignment_id", assignmentIds);
        progressRows = data || [];
      }

      const gameTitleById = new Map(games.map((g) => [g.id, g.title]));
      const studentNameById = new Map(students.map((s) => [s.id, s.name]));
      const studentClassById = new Map(students.map((s) => [s.id, s.class_id]));
      const classNameById = new Map(classes.map((c) => [c.id, c.name]));
      const assignmentById = new Map(assignments.map((a) => [a.id, a]));
      const gameAssignmentIds = new Set(assignments.filter((a) => a.game_id).map((a) => a.id));

      // --- Overview: games played this week ---
      const weekCutoff = Date.now() - WEEK_MS;
      const selfPacedThisWeek = progressRows.filter(
        (p) =>
          p.status === "completed" &&
          gameAssignmentIds.has(p.assignment_id) &&
          new Date(p.updated_at).getTime() >= weekCutoff
      ).length;
      const teamBattleThisWeek = sessions.filter(
        (s) =>
          s.play_mode === "team_battle" &&
          s.status === "final" &&
          new Date(s.created_at).getTime() >= weekCutoff
      ).length;
      setGamesThisWeek(selfPacedThisWeek + teamBattleThisWeek);

      // --- Overview: average success rate ---
      const scoredCompleted = progressRows
        .filter((p) => p.status === "completed" && p.score !== null)
        .map((p) => p.score as number);
      setAvgSuccessRate(
        scoredCompleted.length > 0
          ? Math.round(scoredCompleted.reduce((a, b) => a + b, 0) / scoredCompleted.length)
          : null
      );

      // --- Real activity (excludes auto-created "not_started" placeholder rows) ---
      const realActivity = progressRows.filter((p) => p.status !== "not_started");
      const lastActivityByStudent = new Map<string, string>();
      for (const p of realActivity) {
        const prev = lastActivityByStudent.get(p.student_id);
        if (!prev || new Date(p.updated_at) > new Date(prev)) {
          lastActivityByStudent.set(p.student_id, p.updated_at);
        }
      }

      // --- Alerts: inactive students ---
      const now = Date.now();
      const inactive: InactiveStudent[] = students
        .map((s) => {
          const last = lastActivityByStudent.get(s.id);
          const daysSince = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : null;
          return { name: s.name, daysSince };
        })
        .filter((s) => s.daysSince === null || s.daysSince >= INACTIVE_DAYS)
        .sort((a, b) => (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity));
      setInactiveStudents(inactive);

      // --- Classes summary ---
      const studentIdsByClass = new Map<string, string[]>();
      for (const s of students) {
        const list = studentIdsByClass.get(s.class_id) || [];
        list.push(s.id);
        studentIdsByClass.set(s.class_id, list);
      }
      const summaries: ClassSummary[] = classes.map((c) => {
        const ids = studentIdsByClass.get(c.id) || [];
        let latest: string | null = null;
        for (const sid of ids) {
          const t = lastActivityByStudent.get(sid);
          if (t && (!latest || new Date(t) > new Date(latest))) latest = t;
        }
        return { id: c.id, name: c.name, studentCount: ids.length, lastActivity: latest };
      });
      setClassSummaries(summaries);

      // --- Alerts: struggling content (condensed version of AnalyticsReport's logic) ---
      const contentKey = (a: AssignmentRow) => (a.game_id ? `game:${a.game_id}` : `lesson:${a.lesson_id}`);
      const idsByContent = new Map<string, string[]>();
      for (const a of assignments) {
        const key = contentKey(a);
        const list = idsByContent.get(key) || [];
        list.push(a.id);
        idsByContent.set(key, list);
      }
      const progressByAssignment = new Map<string, ProgressRow[]>();
      for (const p of progressRows) {
        const list = progressByAssignment.get(p.assignment_id) || [];
        list.push(p);
        progressByAssignment.set(p.assignment_id, list);
      }
      const lessonIds = [...idsByContent.keys()]
        .filter((k) => k.startsWith("lesson:"))
        .map((k) => k.slice(7))
        .filter((id) => UUID_RE.test(id));
      const { data: lessonRows } =
        lessonIds.length > 0
          ? await supabase.from("lessons").select("id, title").in("id", lessonIds)
          : { data: [] as { id: string; title: string }[] };
      const lessonTitleById = new Map((lessonRows || []).map((l) => [l.id, l.title]));

      const struggling: StrugglingItem[] = [];
      for (const [key, ids] of idsByContent.entries()) {
        const isGame = key.startsWith("game:");
        const contentId = isGame ? key.slice(5) : key.slice(7);
        const rows = ids.flatMap((aid) => progressByAssignment.get(aid) || []);
        const scored = rows
          .filter((r) => r.status === "completed" && r.score !== null)
          .map((r) => r.score as number);
        if (scored.length < 2) continue;
        const struggleRate = scored.filter((s) => s < STRUGGLE_THRESHOLD).length / scored.length;
        if (struggleRate <= 0.5) continue;
        const title = isGame
          ? gameTitleById.get(contentId) ?? "Unknown game"
          : UUID_RE.test(contentId)
            ? lessonTitleById.get(contentId) ?? "Unknown lesson"
            : legacyLessonTitle(contentId);
        struggling.push({ title, kind: isGame ? "game" : "lesson", struggleRate });
      }
      struggling.sort((a, b) => b.struggleRate - a.struggleRate);
      setStrugglingItems(struggling.slice(0, 2));

      // --- Recent activity feed ---
      const soloActivity: ActivityItem[] = progressRows
        .filter((p) => p.status === "completed")
        .map((p): ActivityItem | null => {
          const a = assignmentById.get(p.assignment_id);
          if (!a || !a.game_id) return null;
          return {
            id: `sp-${p.student_id}-${p.assignment_id}`,
            when: p.updated_at,
            kind: "solo",
            studentName: studentNameById.get(p.student_id) ?? "A student",
            className: classNameById.get(studentClassById.get(p.student_id) ?? "") ?? "",
            title: gameTitleById.get(a.game_id) ?? "a game",
            score: p.score,
          };
        })
        .filter((item): item is ActivityItem => item !== null)
        .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
        .slice(0, 6);

      const teamBattleActivity: ActivityItem[] = sessions
        .filter((s) => s.play_mode === "team_battle" && s.status === "final")
        .map((s) => ({
          id: `tb-${s.id}`,
          when: s.created_at,
          kind: "team_battle" as const,
          className: (s.class_id && classNameById.get(s.class_id)) || "a class",
          title: gameTitleById.get(s.game_id) ?? "a game",
        }))
        .slice(0, 6);

      const feed = [...soloActivity, ...teamBattleActivity]
        .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
        .slice(0, 8);
      setActivity(feed);

      setLoading(false);
    }

    load().catch((e) => {
      setError(e instanceof Error ? e.message : "Could not load the dashboard.");
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <p style={{ opacity: 0.6, fontWeight: 600, fontSize: "0.9rem", margin: 0 }}>Loading dashboard…</p>
    );
  }

  if (error) {
    return <p style={{ color: colors.coralText, fontWeight: 600, margin: 0 }}>{error}</p>;
  }

  const cardStyle: CSSProperties = {
    borderRadius: radius.card,
    background: colors.white,
    boxShadow: solidShadow(4, colors.rosterCardShadow),
    padding: "1.1rem 1.25rem",
    textAlign: "left",
  };

  const statCardStyle: CSSProperties = {
    ...cardStyle,
    flex: "1 1 150px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", maxWidth: "820px" }}>
      {/* Overview cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.85rem" }}>
        <div style={statCardStyle}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>{studentCount}</div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, opacity: 0.6 }}>
            student{studentCount === 1 ? "" : "s"}
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>{classCount}</div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, opacity: 0.6 }}>
            class{classCount === 1 ? "" : "es"}
          </div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>{gamesThisWeek}</div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, opacity: 0.6 }}>games played this week</div>
          <div style={{ fontSize: "0.7rem", opacity: 0.45, marginTop: "0.15rem" }}>assigned + live sessions</div>
        </div>
        <div style={statCardStyle}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>
            {avgSuccessRate !== null ? `${avgSuccessRate}%` : "—"}
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, opacity: 0.6 }}>
            {avgSuccessRate !== null ? "avg. success rate" : "no graded work yet"}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <Link
          href="/games/teacher/library"
          style={{
            fontSize: "0.9rem",
            fontWeight: 800,
            padding: "0.7rem 1.3rem",
            borderRadius: radius.button,
            background: colors.greenButton,
            boxShadow: solidShadow(4, colors.greenButtonShadow),
            color: colors.white,
            textDecoration: "none",
          }}
        >
          🎮 Host a Game
        </Link>
        <Link
          href="/teacher/classes"
          style={{
            fontSize: "0.9rem",
            fontWeight: 800,
            padding: "0.7rem 1.3rem",
            borderRadius: radius.button,
            background: colors.orange,
            boxShadow: solidShadow(4, colors.orangeShadow),
            color: colors.white,
            textDecoration: "none",
          }}
        >
          ➕ Create a Class
        </Link>
        <Link
          href="/academy/teacher/reports"
          style={{
            fontSize: "0.9rem",
            fontWeight: 800,
            padding: "0.7rem 1.3rem",
            borderRadius: radius.button,
            background: colors.blueBackground,
            color: colors.blueText,
            textDecoration: "none",
          }}
        >
          📊 View Reports
        </Link>
      </div>

      {/* Alerts */}
      {(inactiveStudents.length > 0 || strugglingItems.length > 0) && (
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: "0.6rem" }}>⚠️ Alerts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {inactiveStudents.slice(0, 3).map((s) => (
              <div key={s.name} style={{ fontSize: "0.85rem" }}>
                <strong>{s.name}</strong>{" "}
                <span style={{ opacity: 0.7 }}>
                  {s.daysSince === null ? "hasn't played yet" : `hasn't played in ${s.daysSince}d`}
                </span>
              </div>
            ))}
            {inactiveStudents.length > 3 && (
              <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>+{inactiveStudents.length - 3} more inactive</div>
            )}
            {strugglingItems.map((item) => (
              <div key={item.title} style={{ fontSize: "0.85rem" }}>
                🔻 <strong>{item.title}</strong>{" "}
                <span style={{ opacity: 0.7 }}>
                  — {Math.round(item.struggleRate * 100)}% of attempts scoring below {STRUGGLE_THRESHOLD}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 800, marginBottom: "0.6rem" }}>Recent Activity</div>
        {activity.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.6, fontSize: "0.85rem" }}>
            No games played yet — host a Team Battle or assign a game.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {activity.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "0.6rem",
                  fontSize: "0.85rem",
                  borderTop: `1px solid ${colors.inputBorder}`,
                  paddingTop: "0.5rem",
                }}
              >
                <span>
                  {item.kind === "team_battle" ? (
                    <>
                      🏆 <strong>Team Battle</strong> · {item.title} · {item.className}
                    </>
                  ) : (
                    <>
                      <strong>{item.studentName}</strong> · {item.title} · {item.className}
                      {typeof item.score === "number" && <> · {item.score} pts</>}
                    </>
                  )}
                </span>
                <span style={{ opacity: 0.5, whiteSpace: "nowrap" }}>{timeAgo(item.when)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Classes summary */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 800, marginBottom: "0.6rem" }}>Classes</div>
        {classSummaries.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.6, fontSize: "0.85rem" }}>
            You don't have any classes yet —{" "}
            <Link href="/teacher/classes" style={{ color: "inherit", fontWeight: 700 }}>
              create one
            </Link>
            .
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {classSummaries.map((c) => (
              <Link
                key={c.id}
                href={`/teacher/classes/${c.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.6rem",
                  padding: "0.6rem 0.7rem",
                  borderRadius: radius.iconSquare,
                  background: colors.listRowBg,
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <span style={{ fontWeight: 700 }}>{c.name}</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.6, whiteSpace: "nowrap" }}>
                  {c.studentCount} student{c.studentCount === 1 ? "" : "s"} ·{" "}
                  {c.lastActivity ? timeAgo(c.lastActivity) : "no activity yet"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
