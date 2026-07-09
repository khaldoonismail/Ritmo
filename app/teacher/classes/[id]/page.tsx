"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { lessonTitle as legacyLessonTitle } from "@/lib/lessons";
import type { LessonBlockData } from "@/lib/lessonBlocks";

interface ClassInfo {
  id: string;
  name: string;
  join_code: string;
}

interface Student {
  id: string;
  name: string;
  created_at: string;
}

interface Assignment {
  id: string;
  lesson_id: string;
  assigned_at: string;
  due_at: string | null;
  is_active: boolean;
}

interface LessonRow {
  id: string;
  title: string;
  teacher_id: string;
  is_public: boolean;
  usage_count: number;
  blocks: LessonBlockData[];
  teachers: { name: string } | { name: string }[] | null;
}

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function ownerNameOf(row: LessonRow): string | null {
  if (Array.isArray(row.teachers)) return row.teachers[0]?.name ?? null;
  return row.teachers?.name ?? null;
}

export default function ManageClassPage() {
  const params = useParams();
  const classId = params?.id as string;
  const router = useRouter();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [copied, setCopied] = useState(false);
  const [myTeacherId, setMyTeacherId] = useState<string | null>(null);
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);
  const [studentSort, setStudentSort] = useState<"az" | "newest">("az");

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPin, setNewStudentPin] = useState(randomPin());
  const [addStudentError, setAddStudentError] = useState("");
  const [addStudentBusy, setAddStudentBusy] = useState(false);
  const [lastAddedPin, setLastAddedPin] = useState<{ name: string; pin: string } | null>(null);

  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentName, setEditStudentName] = useState("");
  const [editStudentBusy, setEditStudentBusy] = useState(false);
  const [editStudentError, setEditStudentError] = useState("");
  const [regenPinBusyId, setRegenPinBusyId] = useState<string | null>(null);
  const [regenPinResult, setRegenPinResult] = useState<{ name: string; pin: string } | null>(
    null
  );
  const [removeStudentError, setRemoveStudentError] = useState("");

  const [showAssignLesson, setShowAssignLesson] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [assignError, setAssignError] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);

  async function loadAll() {
    const supabase = createBrowserSupabaseClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/accounts/login");
      return;
    }

    const { data: teacherRow } = await supabase
      .from("teachers")
      .select("id")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();
    if (teacherRow) setMyTeacherId(teacherRow.id);

    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .select("id, name, join_code")
      .eq("id", classId)
      .maybeSingle();

    if (classError || !classRow) {
      setNotFound(true);
      return;
    }
    setClassInfo(classRow);

    const { data: studentRows, error: studentsError } = await supabase
      .from("students")
      .select("id, name, created_at")
      .eq("class_id", classId)
      .order("name", { ascending: true });

    if (studentsError) {
      setLoadError(studentsError.message);
    } else {
      setStudents(studentRows || []);
    }

    const { data: assignmentRows, error: assignmentsError } = await supabase
      .from("assignments")
      .select("id, lesson_id, assigned_at, due_at, is_active")
      .eq("class_id", classId)
      .order("assigned_at", { ascending: false });

    if (assignmentsError) {
      setLoadError(assignmentsError.message);
    } else {
      setAssignments(assignmentRows || []);
    }

    const { data: lessonRows, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, title, teacher_id, is_public, usage_count, blocks, teachers(name)")
      .order("created_at", { ascending: false });

    if (lessonsError) {
      setLoadError(lessonsError.message);
    } else {
      setLessons((lessonRows as unknown as LessonRow[]) || []);
    }
  }

  useEffect(() => {
    if (classId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function handleCopyJoinCode() {
    if (!classInfo) return;
    await navigator.clipboard.writeText(classInfo.join_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    setAddStudentError("");
    setAddStudentBusy(true);

    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("students")
      .insert({
        class_id: classId,
        name: newStudentName.trim(),
        pin: newStudentPin,
      })
      .select("id, name, created_at")
      .single();

    setAddStudentBusy(false);

    if (error || !data) {
      setAddStudentError(error?.message || "Could not add student.");
      return;
    }

    setStudents((prev) => [...(prev || []), data]);
    setLastAddedPin({ name: data.name, pin: newStudentPin });
    setNewStudentName("");
    setNewStudentPin(randomPin());
    setShowAddStudent(false);
  }

  function startEditStudent(s: Student) {
    setEditingStudentId(s.id);
    setEditStudentName(s.name);
    setEditStudentError("");
  }

  function cancelEditStudent() {
    setEditingStudentId(null);
    setEditStudentName("");
    setEditStudentError("");
  }

  async function saveStudentName(studentId: string) {
    if (!editStudentName.trim()) return;
    setEditStudentBusy(true);
    setEditStudentError("");

    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("students")
      .update({ name: editStudentName.trim() })
      .eq("id", studentId)
      .select("id, name")
      .single();

    setEditStudentBusy(false);

    if (error || !data) {
      setEditStudentError(error?.message || "Could not rename student.");
      return;
    }

    setStudents(
      (prev) =>
        prev?.map((s) => (s.id === studentId ? { ...s, name: data.name } : s)) ?? prev
    );
    setEditingStudentId(null);
  }

  async function regenerateStudentPin(student: Student) {
    setRegenPinBusyId(student.id);
    setRemoveStudentError("");

    const newPin = randomPin();
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("students")
      .update({ pin: newPin })
      .eq("id", student.id)
      .select("id, name, pin")
      .single();

    setRegenPinBusyId(null);

    if (error || !data) {
      setRemoveStudentError(error?.message || "Could not regenerate PIN.");
      return;
    }

    setRegenPinResult({ name: data.name, pin: data.pin });
  }

  async function removeStudent(student: Student) {
    if (!window.confirm(`Remove ${student.name} from this class?`)) return;
    setRemoveStudentError("");

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from("students").delete().eq("id", student.id);

    if (error) {
      setRemoveStudentError(error.message);
      return;
    }

    setStudents((prev) => (prev || []).filter((s) => s.id !== student.id));
  }

  async function assignLessonToClass(lessonId: string) {
    setAssignError("");

    const newDueDate = dueDate || null;
    const isDuplicate = (assignments || []).some((a) => {
      if (a.lesson_id !== lessonId) return false;
      const existingDueDate = a.due_at ? a.due_at.slice(0, 10) : null;
      return existingDueDate === newDueDate;
    });
    if (isDuplicate) {
      setAssignError(
        newDueDate
          ? "This lesson is already assigned to this class with that due date."
          : "This lesson is already assigned to this class."
      );
      return;
    }

    setAssignBusy(true);

    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("assignments")
      .insert({
        class_id: classId,
        lesson_id: lessonId,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
        is_active: true,
      })
      .select("id, lesson_id, assigned_at, due_at, is_active")
      .single();

    if (error || !data) {
      setAssignBusy(false);
      setAssignError(error?.message || "Could not assign lesson.");
      return;
    }

    await supabase.rpc("increment_lesson_usage", { lesson_id: lessonId });

    setAssignments((prev) => [data, ...(prev || [])]);
    setLessons(
      (prev) =>
        prev?.map((l) =>
          l.id === lessonId ? { ...l, usage_count: l.usage_count + 1 } : l
        ) ?? prev
    );
    setDueDate("");
    setAssignBusy(false);
  }

  async function removeAssignment(assignmentId: string) {
    setRemoveError("");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      setRemoveError(error.message);
      return;
    }

    setAssignments((prev) => (prev || []).filter((a) => a.id !== assignmentId));
  }

  async function copyAndEditLesson(lesson: LessonRow) {
    if (!myTeacherId) return;
    setAssignError("");
    setAssignBusy(true);

    const supabase = createBrowserSupabaseClient();
    const { data: newLesson, error } = await supabase
      .from("lessons")
      .insert({
        teacher_id: myTeacherId,
        title: lesson.title,
        blocks: lesson.blocks,
        is_public: false,
        forked_from: lesson.id,
      })
      .select("id")
      .single();

    if (error || !newLesson) {
      setAssignBusy(false);
      setAssignError(error?.message || "Could not copy lesson.");
      return;
    }

    await supabase.rpc("increment_lesson_usage", { lesson_id: lesson.id });

    router.push(`/academy/teacher/create-lesson?lessonId=${newLesson.id}`);
  }

  const inputStyle: React.CSSProperties = {
    fontSize: "0.95rem",
    padding: "0.55rem 0.75rem",
    borderRadius: "8px",
    border: "1px solid #ddd",
    outline: "none",
    direction: "ltr",
    textAlign: "left",
    fontFamily: "inherit",
    width: "100%",
  };

  const primaryButtonStyle: React.CSSProperties = {
    fontSize: "0.82rem",
    fontWeight: 700,
    padding: "0.4rem 0.7rem",
    borderRadius: "6px",
    border: "none",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...primaryButtonStyle,
    background: "#fff",
    color: "#111",
    border: "1px solid #ddd",
  };

  const lessonTitleMap = new Map((lessons || []).map((l) => [l.id, l.title]));
  const sortedStudents = [...(students || [])].sort((a, b) =>
    studentSort === "az"
      ? a.name.localeCompare(b.name)
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (notFound) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>
          Class not found
        </h1>
        <Link href="/teacher/classes" style={{ color: "inherit", textDecoration: "underline" }}>
          ← Back to My Classes
        </Link>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        gap: "1.5rem",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "2.25rem", fontWeight: 800, margin: 0 }}>
          {classInfo?.name || "Loading..."}
        </h1>
      </div>

      {loadError && <p style={{ color: "#c00", fontSize: "0.9rem" }}>{loadError}</p>}

      {classInfo && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.6rem 1rem",
            border: "1px solid #ddd",
            borderRadius: "10px",
            background: "#fff",
          }}
        >
          <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>Join code</span>
          <span
            style={{
              fontSize: "1.2rem",
              fontWeight: 800,
              letterSpacing: "0.05em",
              direction: "ltr",
            }}
          >
            {classInfo.join_code}
          </span>
          <button
            onClick={handleCopyJoinCode}
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              padding: "0.35rem 0.7rem",
              borderRadius: "6px",
              border: "1px solid #ddd",
              background: copied ? "#111" : "#fff",
              color: copied ? "#fff" : "#111",
              cursor: "pointer",
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      {/* Students section */}
      <section style={{ width: "100%", maxWidth: "600px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
          }}
        >
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>
            Students
          </h2>
          <button
            onClick={() => setShowAddStudent((v) => !v)}
            style={{
              fontSize: "0.9rem",
              fontWeight: 700,
              padding: "0.5rem 0.9rem",
              borderRadius: "8px",
              border: "1px dashed #999",
              background: "#fafafa",
              color: "#111",
              cursor: "pointer",
            }}
          >
            + Add Student
          </button>
        </div>

        {lastAddedPin && (
          <div
            style={{
              background: "#eafbea",
              border: "1px solid #b6e6b6",
              borderRadius: "8px",
              padding: "0.6rem 0.9rem",
              marginBottom: "0.75rem",
              textAlign: "left",
              fontSize: "0.9rem",
            }}
          >
            Added <strong>{lastAddedPin.name}</strong> — give them PIN{" "}
            <strong style={{ direction: "ltr", display: "inline-block" }}>
              {lastAddedPin.pin}
            </strong>{" "}
            and the class join code above.
          </div>
        )}

        {regenPinResult && (
          <div
            style={{
              background: "#eafbea",
              border: "1px solid #b6e6b6",
              borderRadius: "8px",
              padding: "0.6rem 0.9rem",
              marginBottom: "0.75rem",
              textAlign: "left",
              fontSize: "0.9rem",
            }}
          >
            New PIN for <strong>{regenPinResult.name}</strong>:{" "}
            <strong style={{ direction: "ltr", display: "inline-block" }}>
              {regenPinResult.pin}
            </strong>
          </div>
        )}

        {removeStudentError && (
          <p style={{ color: "#c00", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
            {removeStudentError}
          </p>
        )}

        {showAddStudent && (
          <form
            onSubmit={handleAddStudent}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "0.9rem",
              marginBottom: "0.75rem",
              background: "#fff",
              textAlign: "left",
            }}
          >
            <input
              type="text"
              placeholder="Student name"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              style={inputStyle}
              required
            />
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>PIN</span>
              <span
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  direction: "ltr",
                }}
              >
                {newStudentPin}
              </span>
              <button
                type="button"
                onClick={() => setNewStudentPin(randomPin())}
                style={{
                  fontSize: "0.8rem",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Regenerate
              </button>
            </div>
            {addStudentError && (
              <p style={{ color: "#c00", fontSize: "0.85rem", margin: 0 }}>
                {addStudentError}
              </p>
            )}
            <button
              type="submit"
              disabled={addStudentBusy}
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                border: "none",
                background: "#111",
                color: "#fff",
                cursor: addStudentBusy ? "default" : "pointer",
                opacity: addStudentBusy ? 0.6 : 1,
              }}
            >
              {addStudentBusy ? "Adding..." : "Add Student"}
            </button>
          </form>
        )}

        {students !== null && students.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            }}
          >
            <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>Sort:</span>
            <div
              style={{
                display: "flex",
                border: "1px solid #ddd",
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setStudentSort("az")}
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  padding: "0.3rem 0.7rem",
                  border: "none",
                  background: studentSort === "az" ? "#111" : "#fff",
                  color: studentSort === "az" ? "#fff" : "#111",
                  cursor: "pointer",
                }}
              >
                A-Z
              </button>
              <button
                onClick={() => setStudentSort("newest")}
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  padding: "0.3rem 0.7rem",
                  border: "none",
                  borderLeft: "1px solid #ddd",
                  background: studentSort === "newest" ? "#111" : "#fff",
                  color: studentSort === "newest" ? "#fff" : "#111",
                  cursor: "pointer",
                }}
              >
                Newest
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {students === null && <p style={{ opacity: 0.5 }}>Loading...</p>}
          {students?.length === 0 && (
            <p style={{ opacity: 0.5 }}>No students yet.</p>
          )}
          {sortedStudents.map((s) => {
            const isEditing = editingStudentId === s.id;
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.6rem",
                  padding: "0.6rem 0.9rem",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  background: "#fff",
                  textAlign: "left",
                }}
              >
                {isEditing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1 }}>
                    <input
                      type="text"
                      value={editStudentName}
                      onChange={(e) => setEditStudentName(e.target.value)}
                      style={inputStyle}
                      autoFocus
                    />
                    {editStudentError && (
                      <p style={{ color: "#c00", fontSize: "0.8rem", margin: 0 }}>
                        {editStudentError}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button
                        onClick={() => saveStudentName(s.id)}
                        disabled={editStudentBusy}
                        style={primaryButtonStyle}
                      >
                        {editStudentBusy ? "Saving..." : "Save"}
                      </button>
                      <button onClick={cancelEditStudent} style={secondaryButtonStyle}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span>{s.name}</span>
                    <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                      <button onClick={() => startEditStudent(s)} style={secondaryButtonStyle}>
                        Edit
                      </button>
                      <button
                        onClick={() => regenerateStudentPin(s)}
                        disabled={regenPinBusyId === s.id}
                        style={secondaryButtonStyle}
                      >
                        {regenPinBusyId === s.id ? "..." : "Regenerate PIN"}
                      </button>
                      <button
                        onClick={() => removeStudent(s)}
                        style={{ ...secondaryButtonStyle, color: "#c00" }}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Assignments section */}
      <section style={{ width: "100%", maxWidth: "600px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
          }}
        >
          <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>
            Assigned Lessons
          </h2>
          <button
            onClick={() => setShowAssignLesson((v) => !v)}
            style={{
              fontSize: "0.9rem",
              fontWeight: 700,
              padding: "0.5rem 0.9rem",
              borderRadius: "8px",
              border: "1px dashed #999",
              background: "#fafafa",
              color: "#111",
              cursor: "pointer",
            }}
          >
            + Assign New Lesson
          </button>
        </div>

        {showAssignLesson && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "0.9rem",
              marginBottom: "0.75rem",
              background: "#fff",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <label style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                Due date (optional, applies to whichever lesson you assign below)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            {assignError && (
              <p style={{ color: "#c00", fontSize: "0.85rem", margin: 0 }}>
                {assignError}
              </p>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                maxHeight: "320px",
                overflowY: "auto",
              }}
            >
              {lessons === null && <p style={{ opacity: 0.5 }}>Loading lessons...</p>}
              {lessons?.length === 0 && (
                <p style={{ opacity: 0.5 }}>
                  No lessons yet.{" "}
                  <Link href="/academy/teacher/create-lesson" style={{ textDecoration: "underline" }}>
                    Create one
                  </Link>
                  .
                </p>
              )}
              {lessons?.map((l) => {
                const isMine = l.teacher_id === myTeacherId;
                const owner = ownerNameOf(l);
                return (
                  <div
                    key={l.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.6rem",
                      padding: "0.6rem 0.75rem",
                      border: "1px solid #eee",
                      borderRadius: "8px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{l.title}</div>
                      <div style={{ fontSize: "0.72rem", opacity: 0.6 }}>
                        {isMine ? "Your lesson" : `by ${owner || "another teacher"}`} · used{" "}
                        {l.usage_count} time{l.usage_count === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                      {isMine ? (
                        <>
                          <button
                            onClick={() => assignLessonToClass(l.id)}
                            disabled={assignBusy}
                            style={primaryButtonStyle}
                          >
                            Assign
                          </button>
                          <Link
                            href={`/academy/teacher/create-lesson?lessonId=${l.id}`}
                            style={secondaryButtonStyle}
                          >
                            Edit
                          </Link>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => assignLessonToClass(l.id)}
                            disabled={assignBusy}
                            style={primaryButtonStyle}
                          >
                            Assign as-is
                          </button>
                          <button
                            onClick={() => copyAndEditLesson(l)}
                            disabled={assignBusy}
                            style={secondaryButtonStyle}
                          >
                            Copy &amp; Edit
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {removeError && (
          <p style={{ color: "#c00", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            {removeError}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {assignments === null && <p style={{ opacity: 0.5 }}>Loading...</p>}
          {assignments?.length === 0 && (
            <p style={{ opacity: 0.5 }}>No lessons assigned yet.</p>
          )}
          {assignments?.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.6rem",
                padding: "0.6rem 0.9rem",
                border: "1px solid #ddd",
                borderRadius: "8px",
                background: "#fff",
                textAlign: "left",
                fontSize: "0.9rem",
              }}
            >
              <span style={{ fontWeight: 700 }}>
                {lessonTitleMap.get(a.lesson_id) ?? legacyLessonTitle(a.lesson_id)}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
                <span style={{ opacity: 0.6, direction: "ltr" }}>
                  {a.due_at
                    ? `Due ${new Date(a.due_at).toLocaleDateString()}`
                    : "No due date"}
                </span>
                <button
                  onClick={() => removeAssignment(a.id)}
                  title="Remove this assignment"
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.5rem",
                    borderRadius: "6px",
                    border: "1px solid #ddd",
                    background: "#fff",
                    color: "#c00",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Link
        href="/teacher/classes"
        style={{
          fontSize: "0.9rem",
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
        }}
      >
        ← Back to My Classes
      </Link>
    </main>
  );
}
