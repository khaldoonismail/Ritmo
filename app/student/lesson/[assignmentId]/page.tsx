import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  verifyStudentSessionToken,
  STUDENT_SESSION_COOKIE,
} from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getLessonContent } from "@/lib/lessonContent";
import LessonView from "./LessonView";

function NotFound({ message }: { message: string }) {
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
      <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>
        {message}
      </h1>
      <a
        href="/student/dashboard"
        style={{ color: "inherit", textDecoration: "underline" }}
      >
        ← Back to Dashboard
      </a>
    </main>
  );
}

export default async function StudentLessonPage({
  params,
}: {
  params: { assignmentId: string };
}) {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;

  if (!session) {
    redirect("/student/login");
  }

  const supabase = createAdminSupabaseClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, class_id, lesson_id")
    .eq("id", params.assignmentId)
    .maybeSingle();

  if (!assignment || assignment.class_id !== session.classId) {
    return <NotFound message="Assignment not found" />;
  }

  const lesson = getLessonContent(assignment.lesson_id);
  if (!lesson) {
    return <NotFound message="This lesson isn't available yet" />;
  }

  return (
    <LessonView
      title={lesson.title}
      blocks={lesson.blocks}
      backHref="/student/dashboard"
    />
  );
}
