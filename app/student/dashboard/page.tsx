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
    .select("id, lesson_id, due_at")
    .eq("class_id", session.classId)
    .eq("is_active", true)
    .or(`student_id.is.null,student_id.eq.${session.studentId}`)
    .order("assigned_at", { ascending: false });

  // assignments.lesson_id is either a real lessons.id (uuid) or the legacy
  // static demo lesson_id ("1"), which isn't a valid uuid — only look up
  // the real ones, and fall back to the static title map for the rest.
  const realLessonIds = [
    ...new Set((assignments || []).map((a) => a.lesson_id)),
  ].filter((id) => UUID_RE.test(id));

  let lessonTitleMap = new Map<string, string>();
  if (realLessonIds.length > 0) {
    const { data: lessonRows } = await supabase
      .from("lessons")
      .select("id, title")
      .in("id", realLessonIds);
    lessonTitleMap = new Map((lessonRows || []).map((l) => [l.id, l.title]));
  }

  // Scoped to this student's own id (never another student's) to prevent
  // leaking another student's progress via this join.
  let progressMap = new Map<string, ProgressStatus>();
  const assignmentIds = (assignments || []).map((a) => a.id);
  if (assignmentIds.length > 0) {
    const { data: progressRows } = await supabase
      .from("student_progress")
      .select("assignment_id, status")
      .eq("student_id", session.studentId)
      .in("assignment_id", assignmentIds);
    progressMap = new Map(
      (progressRows || []).map((p) => [p.assignment_id, p.status as ProgressStatus])
    );
  }

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
          const status = progressMap.get(a.id) ?? "not_started";
          const { icon, label, cardBg, cardShadow, iconFill, iconShadow, badgeBg, cardOpacity } =
            STATUS_DISPLAY[status];
          return (
            <Link
              key={a.id}
              href={`/student/lesson/${a.id}`}
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
                    {lessonTitleMap.get(a.lesson_id) ?? legacyLessonTitle(a.lesson_id)}
                  </span>
                  {a.due_at && (
                    <span style={{ opacity: 0.6, fontWeight: 600, fontSize: "0.8rem", direction: "ltr" }}>
                      Due {new Date(a.due_at).toLocaleDateString()}
                    </span>
                  )}
                </span>
              </span>
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
