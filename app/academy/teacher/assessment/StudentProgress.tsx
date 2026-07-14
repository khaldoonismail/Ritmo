"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { lessonTitle as legacyLessonTitle } from "@/lib/lessons";

type ProgressStatus = "not_started" | "in_progress" | "completed";

const STATUS_DISPLAY: Record<
  ProgressStatus,
  { icon: string; label: string; color: string }
> = {
  completed: { icon: "✅", label: "Completed", color: "#1a7f37" },
  in_progress: { icon: "🔵", label: "In Progress", color: "#1a5fd6" },
  not_started: { icon: "⚪", label: "Not Started", color: "#6b7280" },
};

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

interface AssignmentRow {
  id: string;
  class_id: string;
  lesson_id: string;
  student_id: string | null;
  due_at: string | null;
  assigned_at: string;
}

interface ProgressRow {
  student_id: string;
  assignment_id: string;
  status: ProgressStatus;
  score: number | null;
  updated_at: string;
}

interface RosterEntry {
  studentId: string;
  studentName: string;
  status: ProgressStatus;
  score: number | null;
  updatedAt: string | null;
}

export default function StudentProgress() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [lessonTitleMap, setLessonTitleMap] = useState<Map<string, string>>(new Map());
  const [roster, setRoster] = useState<Map<string, RosterEntry[]>>(new Map());
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Record<string, string>>({});

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
        setClasses([]);
        setLoading(false);
        return;
      }

      const [{ data: assignmentRows, error: assignmentsError }, { data: studentRows }] =
        await Promise.all([
          supabase
            .from("assignments")
            .select("id, class_id, lesson_id, student_id, due_at, assigned_at")
            .in("class_id", classIds)
            .eq("is_active", true)
            .order("assigned_at", { ascending: false }),
          supabase.from("students").select("id, name, class_id").in("class_id", classIds),
        ]);

      if (assignmentsError) {
        setError(assignmentsError.message);
        setLoading(false);
        return;
      }

      const realLessonIds = [
        ...new Set((assignmentRows || []).map((a) => a.lesson_id)),
      ].filter((id) => UUID_RE.test(id));

      let titleMap = new Map<string, string>();
      if (realLessonIds.length > 0) {
        const { data: lessonRows } = await supabase
          .from("lessons")
          .select("id, title")
          .in("id", realLessonIds);
        titleMap = new Map((lessonRows || []).map((l) => [l.id, l.title]));
      }

      const assignmentIds = (assignmentRows || []).map((a) => a.id);
      let progressRows: ProgressRow[] = [];
      if (assignmentIds.length > 0) {
        const { data } = await supabase
          .from("student_progress")
          .select("student_id, assignment_id, status, score, updated_at")
          .in("assignment_id", assignmentIds);
        progressRows = data || [];
      }

      const progressByKey = new Map(
        progressRows.map((p) => [`${p.assignment_id}:${p.student_id}`, p])
      );
      const studentsById = new Map((studentRows || []).map((s) => [s.id, s]));
      const studentsByClass = new Map<string, StudentRow[]>();
      for (const s of studentRows || []) {
        const list = studentsByClass.get(s.class_id) || [];
        list.push(s);
        studentsByClass.set(s.class_id, list);
      }

      const rosterMap = new Map<string, RosterEntry[]>();
      const initialScoreInputs: Record<string, string> = {};
      for (const a of assignmentRows || []) {
        const applicable: StudentRow[] = a.student_id
          ? [studentsById.get(a.student_id)].filter((s): s is StudentRow => !!s)
          : studentsByClass.get(a.class_id) || [];

        const entries: RosterEntry[] = applicable
          .map((s) => {
            const p = progressByKey.get(`${a.id}:${s.id}`);
            return {
              studentId: s.id,
              studentName: s.name,
              status: p?.status ?? "not_started",
              score: p?.score ?? null,
              updatedAt: p?.updated_at ?? null,
            };
          })
          .sort((x, y) => x.studentName.localeCompare(y.studentName));

        for (const entry of entries) {
          const key = `${a.id}:${entry.studentId}`;
          initialScoreInputs[key] = entry.score === null ? "" : String(entry.score);
        }

        rosterMap.set(a.id, entries);
      }

      setClasses(classRows || []);
      setAssignments(assignmentRows || []);
      setLessonTitleMap(titleMap);
      setRoster(rosterMap);
      setScoreInputs(initialScoreInputs);
      setLoading(false);
    }

    load();
  }, [router]);

  async function saveScore(assignmentId: string, studentId: string) {
    const key = `${assignmentId}:${studentId}`;
    const raw = scoreInputs[key] ?? "";
    const score = raw.trim() === "" ? null : Number(raw);

    if (raw.trim() !== "" && Number.isNaN(score)) {
      setSaveError((prev) => ({ ...prev, [key]: "Enter a number" }));
      return;
    }

    const currentStatus =
      roster.get(assignmentId)?.find((e) => e.studentId === studentId)?.status ??
      "not_started";

    setSavingKey(key);
    setSaveError((prev) => ({ ...prev, [key]: "" }));

    const supabase = createBrowserSupabaseClient();
    const { error: saveErr } = await supabase.from("student_progress").upsert(
      { student_id: studentId, assignment_id: assignmentId, score, status: currentStatus },
      { onConflict: "student_id,assignment_id" }
    );

    setSavingKey(null);

    if (saveErr) {
      setSaveError((prev) => ({ ...prev, [key]: saveErr.message }));
      return;
    }

    setRoster((prev) => {
      const next = new Map(prev);
      const entries = (next.get(assignmentId) || []).map((e) =>
        e.studentId === studentId
          ? { ...e, score, updatedAt: new Date().toISOString() }
          : e
      );
      next.set(assignmentId, entries);
      return next;
    });
  }

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  const inputStyle: React.CSSProperties = {
    fontSize: "0.85rem",
    padding: "0.35rem 0.5rem",
    borderRadius: "6px",
    border: "1px solid #ddd",
    outline: "none",
    direction: "ltr",
    textAlign: "left",
    fontFamily: "inherit",
    width: "70px",
  };

  if (loading) {
    return <p style={{ opacity: 0.5 }}>Loading student progress...</p>;
  }

  if (error) {
    return <p style={{ color: "#c00", fontSize: "0.9rem" }}>{error}</p>;
  }

  if (classes.length === 0) {
    return (
      <p style={{ opacity: 0.5, textAlign: "center" }}>
        You don't have any classes yet.
      </p>
    );
  }

  if (assignments.length === 0) {
    return (
      <p style={{ opacity: 0.5, textAlign: "center" }}>
        No active assignments yet. Assign a lesson to a class to see student
        progress here.
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
      {assignments.map((a) => {
        const entries = roster.get(a.id) || [];
        const title = lessonTitleMap.get(a.lesson_id) ?? legacyLessonTitle(a.lesson_id);
        const className = classNameById.get(a.class_id) ?? "Unknown class";

        return (
          <div
            key={a.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "1rem",
              background: "#fff",
              textAlign: "left",
            }}
          >
            <div style={{ marginBottom: "0.75rem" }}>
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{title}</div>
              <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                Class: {className}
                {a.due_at && (
                  <>
                    {" "}
                    · Due{" "}
                    <span style={{ direction: "ltr", display: "inline-block" }}>
                      {new Date(a.due_at).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>
            </div>

            {entries.length === 0 ? (
              <p style={{ opacity: 0.5, fontSize: "0.85rem" }}>
                No students to show for this assignment.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <th style={{ textAlign: "left", padding: "0.4rem" }}>Student</th>
                      <th style={{ textAlign: "left", padding: "0.4rem" }}>Status</th>
                      <th style={{ textAlign: "left", padding: "0.4rem" }}>Score</th>
                      <th style={{ textAlign: "left", padding: "0.4rem" }}>Last updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const key = `${a.id}:${entry.studentId}`;
                      const { icon, label, color } = STATUS_DISPLAY[entry.status];
                      return (
                        <tr key={entry.studentId} style={{ borderBottom: "1px solid #f3f3f3" }}>
                          <td style={{ padding: "0.4rem", fontWeight: 600 }}>
                            {entry.studentName}
                          </td>
                          <td style={{ padding: "0.4rem", color, fontWeight: 600 }}>
                            {icon} {label}
                          </td>
                          <td style={{ padding: "0.4rem" }}>
                            <input
                              type="number"
                              value={scoreInputs[key] ?? ""}
                              onChange={(e) =>
                                setScoreInputs((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              onBlur={() => saveScore(a.id, entry.studentId)}
                              disabled={savingKey === key}
                              style={inputStyle}
                            />
                            {saveError[key] && (
                              <div style={{ color: "#c00", fontSize: "0.75rem" }}>
                                {saveError[key]}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "0.4rem", opacity: 0.6, fontSize: "0.8rem" }}>
                            {entry.updatedAt
                              ? new Date(entry.updatedAt).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
