import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  verifyStudentSessionToken,
  STUDENT_SESSION_COOKIE,
} from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { lessonTitle as legacyLessonTitle } from "@/lib/lessons";
import { colors, radius, solidShadow } from "@/lib/theme";
import { levelForPoints, scoreBadge } from "@/lib/studentLevels";
import LogoutButton from "./LogoutButton";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProgressStatus = "not_started" | "in_progress" | "completed";

const STATUS_DISPLAY: Record<
  ProgressStatus,
  {
    icon: string;
    label: string;
    cardBg: string;
    cardShadow: string;
    iconFill: string;
    iconShadow: string;
    badgeBg: string;
    cardOpacity: number;
  }
> = {
  completed: {
    icon: "✓",
    label: "Completed",
    cardBg: colors.completedCardBg,
    cardShadow: colors.completedCardShadow,
    iconFill: colors.greenCard,
    iconShadow: colors.greenCardShadow,
    badgeBg: colors.greenCard,
    cardOpacity: 1,
  },
  in_progress: {
    icon: "▶",
    label: "In progress",
    cardBg: colors.inProgressCardBg,
    cardShadow: colors.inProgressCardShadow,
    iconFill: colors.orange,
    iconShadow: colors.orangeShadow,
    badgeBg: colors.orange,
    cardOpacity: 1,
  },
  not_started: {
    icon: "🔒",
    label: "Not started",
    cardBg: colors.notStartedCardBg,
    cardShadow: colors.notStartedCardShadow,
    iconFill: colors.neutralGray,
    iconShadow: colors.neutralGrayShadow,
    badgeBg: colors.neutralGray,
    cardOpacity: 0.75,
  },
};

export default async function StudentDashboardPage() {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;

  if (!session) {
    redirect("/student/login");
  }

  const supabase = createAdminSupabaseClient();
  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, lesson_id, game_id, due_at, assigned_at")
    .eq("class_id", session.classId)
    .eq("is_active", true)
    .or(`student_id.is.null,student_id.eq.${session.studentId}`)
    .order("assigned_at", { ascending: false });

  // assignments.lesson_id is either a real lessons.id (uuid) or the legacy
  // static demo lesson_id ("1"), which isn't a valid uuid — only look up
  // the real ones, and fall back to the static title map for the rest.
  const realLessonIds = [
    ...new Set((assignments || []).map((a) => a.lesson_id).filter((id): id is string => !!id)),
  ].filter((id) => UUID_RE.test(id));

  let lessonTitleMap = new Map<string, string>();
  if (realLessonIds.length > 0) {
    const { data: lessonRows } = await supabase
      .from("lessons")
      .select("id, title")
      .in("id", realLessonIds);
    lessonTitleMap = new Map((lessonRows || []).map((l) => [l.id, l.title]));
  }

  const gameIds = [
    ...new Set((assignments || []).map((a) => a.game_id).filter((id): id is string => !!id)),
  ];
  let gameTitleMap = new Map<string, string>();
  if (gameIds.length > 0) {
    const { data: gameRows } = await supabase.from("games").select("id, title").in("id", gameIds);
    gameTitleMap = new Map((gameRows || []).map((g) => [g.id, g.title]));
  }

  function assignmentTitle(a: { lesson_id: string | null; game_id: string | null }): string {
    if (a.game_id) return gameTitleMap.get(a.game_id) ?? "Unknown game";
    if (a.lesson_id) return lessonTitleMap.get(a.lesson_id) ?? legacyLessonTitle(a.lesson_id);
    return "Unknown assignment";
  }

  // Scoped to this student's own id (never another student's) to prevent
  // leaking another student's progress via this join.
  let progressMap = new Map<string, { status: ProgressStatus; score: number | null }>();
  const assignmentIds = (assignments || []).map((a) => a.id);
  if (assignmentIds.length > 0) {
    const { data: progressRows } = await supabase
      .from("student_progress")
      .select("assignment_id, status, score")
      .eq("student_id", session.studentId)
      .in("assignment_id", assignmentIds);
    progressMap = new Map(
      (progressRows || []).map((p) => [
        p.assignment_id,
        { status: p.status as ProgressStatus, score: p.score },
      ])
    );
  }

  // Total points = sum of every graded score this student has, and drives
  // the level badge below (see lib/studentLevels.ts). Completed count feeds
  // the same banner's subtext.
  let totalPoints = 0;
  let completedCount = 0;
  for (const { status, score } of progressMap.values()) {
    if (status === "completed") completedCount += 1;
    if (score !== null) totalPoints += score;
  }
  const { level, next, pointsToNext } = levelForPoints(totalPoints);

  // Lightweight, computed-at-load notifications (no persisted/dismissible
  // state) — "new" means assigned in the last 3 days, "due soon" means due
  // within the next 2 days and not yet completed.
  const now = Date.now();
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
  const newAssignmentIds = new Set(
    (assignments || [])
      .filter((a) => now - new Date(a.assigned_at).getTime() <= THREE_DAYS_MS)
      .map((a) => a.id)
  );
  const dueSoonIds = new Set(
    (assignments || [])
      .filter((a) => {
        if (!a.due_at) return false;
        const status = progressMap.get(a.id)?.status ?? "not_started";
        if (status === "completed") return false;
        const msUntilDue = new Date(a.due_at).getTime() - now;
        return msUntilDue >= 0 && msUntilDue <= TWO_DAYS_MS;
      })
      .map((a) => a.id)
  );
  const notificationCount = newAssignmentIds.size + dueSoonIds.size;

  // Notes from the teacher: whole-class notes (student_id is null) plus any
  // aimed directly at this student. One-way, no replies.
  const { data: notes } = await supabase
    .from("teacher_notes")
    .select("id, message, created_at")
    .eq("class_id", session.classId)
    .or(`student_id.is.null,student_id.eq.${session.studentId}`)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: 800,
          margin: "1rem 0 0",
        }}
      >
        Welcome, {session.name}
      </h1>
      <p style={{ opacity: 0.7, fontWeight: 600, margin: 0 }}>
        Here are your lessons.
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.85rem",
          width: "100%",
          maxWidth: "480px",
          padding: "1rem 1.25rem",
          borderRadius: radius.card,
          background: colors.inProgressCardBg,
          boxShadow: solidShadow(5, colors.inProgressCardShadow),
          textAlign: "left",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "46px",
            height: "46px",
            minWidth: "46px",
            borderRadius: "50%",
            background: colors.orange,
            boxShadow: solidShadow(3, colors.orangeShadow),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
          }}
        >
          {level.icon}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
          <span style={{ fontWeight: 800, fontSize: "1.05rem" }}>{level.label}</span>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, opacity: 0.7 }}>
            {totalPoints} pts · {completedCount} item{completedCount === 1 ? "" : "s"} completed
            {next && pointsToNext !== null && ` · ${pointsToNext} pts to ${next.label}`}
          </span>
        </span>
      </div>

      {notificationCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            width: "100%",
            maxWidth: "480px",
            padding: "0.6rem 1rem",
            borderRadius: radius.pill,
            background: colors.coralBackground,
            color: colors.coralText,
            fontWeight: 700,
            fontSize: "0.85rem",
          }}
        >
          <span aria-hidden="true">🔔</span>
          {newAssignmentIds.size > 0 &&
            `${newAssignmentIds.size} new assignment${newAssignmentIds.size === 1 ? "" : "s"}`}
          {newAssignmentIds.size > 0 && dueSoonIds.size > 0 && " · "}
          {dueSoonIds.size > 0 && `${dueSoonIds.size} due soon`}
        </div>
      )}

      {notes && notes.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            width: "100%",
            maxWidth: "480px",
            padding: "1rem 1.25rem",
            borderRadius: radius.card,
            background: colors.blueBackground,
            textAlign: "left",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>📝 Notes from your teacher</div>
          {notes.map((n) => (
            <div key={n.id} style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              <span style={{ opacity: 0.6, fontWeight: 700, fontSize: "0.75rem" }}>
                {new Date(n.created_at).toLocaleDateString()}
              </span>
              <div>{n.message}</div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
          width: "100%",
          maxWidth: "480px",
          marginTop: "1rem",
        }}
      >
        {(!assignments || assignments.length === 0) && (
          <p style={{ opacity: 0.6, fontWeight: 600, fontSize: "1.1rem" }}>
            You don't have any lessons yet — check with your teacher!
          </p>
        )}
        {assignments?.map((a) => {
          const progress = progressMap.get(a.id);
          const status = progress?.status ?? "not_started";
          const score = progress?.score ?? null;
          const badge = scoreBadge(score);
          const { icon, label, cardBg, cardShadow, iconFill, iconShadow, badgeBg, cardOpacity } =
            STATUS_DISPLAY[status];
          const isNew = newAssignmentIds.has(a.id);
          const isDueSoon = dueSoonIds.has(a.id);
          return (
            <Link
              key={a.id}
              href={a.game_id ? `/student/game/${a.id}` : `/student/lesson/${a.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "1rem 1.25rem",
                borderRadius: radius.card,
                background: cardBg,
                boxShadow: solidShadow(5, cardShadow),
                opacity: cardOpacity,
                color: "inherit",
                textDecoration: "none",
                textAlign: "left",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: "38px",
                    height: "38px",
                    minWidth: "38px",
                    borderRadius: "50%",
                    background: iconFill,
                    boxShadow: solidShadow(3, iconShadow),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.1rem",
                    color: colors.white,
                  }}
                >
                  {icon}
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                  <span style={{ fontWeight: 800, fontSize: "1.05rem" }}>
                    {a.game_id ? "🎮 " : ""}
                    {assignmentTitle(a)}
                  </span>
                  <span style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {a.due_at && (
                      <span style={{ opacity: 0.6, fontWeight: 600, fontSize: "0.8rem", direction: "ltr" }}>
                        Due {new Date(a.due_at).toLocaleDateString()}
                      </span>
                    )}
                    {isNew && (
                      <span style={{ color: colors.blueText, fontWeight: 800, fontSize: "0.75rem" }}>
                        · New
                      </span>
                    )}
                    {isDueSoon && (
                      <span style={{ color: colors.coralText, fontWeight: 800, fontSize: "0.75rem" }}>
                        · Due soon
                      </span>
                    )}
                  </span>
                </span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: "0.75rem",
                    padding: "0.35rem 0.75rem",
                    borderRadius: radius.pill,
                    background: badgeBg,
                    color: colors.white,
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
                {score !== null && (
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, opacity: 0.7, whiteSpace: "nowrap" }}>
                    {badge ? `${badge.icon} ` : ""}
                    {score} pts
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      <div style={{ marginTop: "1rem", marginBottom: "2rem" }}>
        <LogoutButton />
      </div>
    </main>
  );
}
