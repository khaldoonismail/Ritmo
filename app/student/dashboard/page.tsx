import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  verifyStudentSessionToken,
  STUDENT_SESSION_COOKIE,
} from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { lessonTitle as legacyLessonTitle } from "@/lib/lessons";
import LogoutButton from "./LogoutButton";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: 0 }}>
        Welcome, {session.name}
      </h1>
      <p style={{ opacity: 0.7 }}>
        You're logged in as a student. This page is only reachable with a
        valid signed session cookie.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          maxWidth: "420px",
          marginTop: "1rem",
        }}
      >
        {(!assignments || assignments.length === 0) && (
          <p style={{ opacity: 0.5 }}>No lessons assigned yet.</p>
        )}
        {assignments?.map((a) => (
          <Link
            key={a.id}
            href={`/student/lesson/${a.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              border: "1px solid #ddd",
              background: "#fff",
              color: "inherit",
              textDecoration: "none",
              textAlign: "left",
            }}
          >
            <span style={{ fontWeight: 700 }}>
              {lessonTitleMap.get(a.lesson_id) ?? legacyLessonTitle(a.lesson_id)}
            </span>
            {a.due_at && (
              <span style={{ opacity: 0.6, fontSize: "0.85rem", direction: "ltr" }}>
                Due {new Date(a.due_at).toLocaleDateString()}
              </span>
            )}
          </Link>
        ))}
      </div>

      <LogoutButton />
    </main>
  );
}
