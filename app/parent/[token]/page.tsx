import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { lessonTitle as legacyLessonTitle } from "@/lib/lessons";
import { colors, radius, solidShadow } from "@/lib/theme";
import { levelForPoints } from "@/lib/studentLevels";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        textAlign: "center",
        padding: "2rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>Link not found</h1>
      <p style={{ opacity: 0.7, fontWeight: 600 }}>
        This parent link may have been regenerated — ask your child's teacher for a new one.
      </p>
    </main>
  );
}

// Read-only parent view, reached only via an unguessable per-student link
// (students.parent_token) — no login, no account, matching the app's
// existing lightweight capability-link model. Deliberately shows nothing a
// parent couldn't already see if they were standing behind their kid: no
// class roster, no other students, no way to act on anything.
export default async function ParentPortalPage({ params }: { params: { token: string } }) {
  const supabase = createAdminSupabaseClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, name, class_id")
    .eq("parent_token", params.token)
    .maybeSingle();

  if (!student) {
    return <NotFound />;
  }

  const { data: classRow } = await supabase
    .from("classes")
    .select("name")
    .eq("id", student.class_id)
    .maybeSingle();

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, lesson_id, game_id, due_at, assigned_at")
    .eq("class_id", student.class_id)
    .eq("is_active", true)
    .or(`student_id.is.null,student_id.eq.${student.id}`)
    .order("assigned_at", { ascending: false });

  const realLessonIds = [
    ...new Set((assignments || []).map((a) => a.lesson_id).filter((id): id is string => !!id)),
  ].filter((id) => UUID_RE.test(id));
  let lessonTitleMap = new Map<string, string>();
  if (realLessonIds.length > 0) {
    const { data } = await supabase.from("lessons").select("id, title").in("id", realLessonIds);
    lessonTitleMap = new Map((data || []).map((l) => [l.id, l.title]));
  }

  const gameIds = [
    ...new Set((assignments || []).map((a) => a.game_id).filter((id): id is string => !!id)),
  ];
  let gameTitleMap = new Map<string, string>();
  if (gameIds.length > 0) {
    const { data } = await supabase.from("games").select("id, title").in("id", gameIds);
    gameTitleMap = new Map((data || []).map((g) => [g.id, g.title]));
  }

  function titleOf(a: { lesson_id: string | null; game_id: string | null }): string {
    if (a.game_id) return gameTitleMap.get(a.game_id) ?? "Unknown game";
    if (a.lesson_id) return lessonTitleMap.get(a.lesson_id) ?? legacyLessonTitle(a.lesson_id);
    return "Unknown assignment";
  }

  const assignmentIds = (assignments || []).map((a) => a.id);
  let progressMap = new Map<string, { status: string; score: number | null }>();
  if (assignmentIds.length > 0) {
    const { data } = await supabase
      .from("student_progress")
      .select("assignment_id, status, score")
      .eq("student_id", student.id)
      .in("assignment_id", assignmentIds);
    progressMap = new Map((data || []).map((p) => [p.assignment_id, { status: p.status, score: p.score }]));
  }

  let totalPoints = 0;
  let completedCount = 0;
  for (const { status, score } of progressMap.values()) {
    if (status === "completed") completedCount += 1;
    if (score !== null) totalPoints += score;
  }
  const { level, next, pointsToNext } = levelForPoints(totalPoints);

  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("date, status")
    .eq("student_id", student.id)
    .order("date", { ascending: false })
    .limit(30);

  const attendanceCounts = { present: 0, late: 0, absent: 0 };
  for (const row of attendanceRows || []) {
    attendanceCounts[row.status as "present" | "late" | "absent"] += 1;
  }

  const { data: notes } = await supabase
    .from("teacher_notes")
    .select("id, message, created_at")
    .eq("class_id", student.class_id)
    .or(`student_id.is.null,student_id.eq.${student.id}`)
    .order("created_at", { ascending: false })
    .limit(10);

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
      <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "1rem 0 0" }}>{student.name}</h1>
      <p style={{ opacity: 0.7, fontWeight: 600, margin: 0 }}>
        {classRow?.name ?? "Class"} · read-only progress view
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

      {(attendanceCounts.present + attendanceCounts.late + attendanceCounts.absent) > 0 && (
        <div
          style={{
            width: "100%",
            maxWidth: "480px",
            padding: "0.9rem 1.25rem",
            borderRadius: radius.card,
            background: colors.white,
            boxShadow: solidShadow(4, colors.rosterCardShadow),
            textAlign: "left",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: "0.3rem" }}>
            Attendance (last 30 sessions)
          </div>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.75 }}>
            {attendanceCounts.present} present
            {attendanceCounts.late > 0 && ` · ${attendanceCounts.late} late`}
            {attendanceCounts.absent > 0 && ` · ${attendanceCounts.absent} absent`}
          </div>
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
          <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>📝 Notes from the teacher</div>
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
          gap: "0.6rem",
          width: "100%",
          maxWidth: "480px",
          marginTop: "0.5rem",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 0.25rem", textAlign: "left" }}>
          Assignments
        </h2>
        {(!assignments || assignments.length === 0) && (
          <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "left" }}>No assignments yet.</p>
        )}
        {assignments?.map((a) => {
          const progress = progressMap.get(a.id);
          const status = progress?.status ?? "not_started";
          const score = progress?.score ?? null;
          return (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                borderRadius: radius.iconSquare,
                background: colors.white,
                boxShadow: solidShadow(3, colors.rosterCardShadow),
                textAlign: "left",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                {a.game_id ? "🎮 " : "🎵 "}
                {titleOf(a)}
              </span>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, opacity: 0.7, whiteSpace: "nowrap" }}>
                {status === "completed"
                  ? `✓ Completed${score !== null ? ` · ${score} pts` : ""}`
                  : status === "in_progress"
                    ? "In progress"
                    : "Not started"}
              </span>
            </div>
          );
        })}
      </div>
    </main>
  );
}
