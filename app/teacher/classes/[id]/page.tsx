"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { lessonTitle as legacyLessonTitle } from "@/lib/lessons";
import type { LessonBlockData } from "@/lib/lessonBlocks";
import { forkLesson } from "@/lib/forkLesson";
import { randomPin } from "@/lib/studentPin";
import { DAY_NAMES, formatTime } from "@/lib/classSchedule";
import UploadStudentsExcel from "./UploadStudentsExcel";
import StudentThumbnail from "./StudentThumbnail";
import StudentPhotoUploader from "./StudentPhotoUploader";
import Attendance from "./Attendance";
import Notes from "./Notes";
import { colors, radius, solidShadow } from "@/lib/theme";

interface ClassInfo {
  id: string;
  name: string;
  join_code: string;
}

interface Student {
  id: string;
  name: string;
  avatar_url: string | null;
  parent_token: string;
}

interface Assignment {
  id: string;
  lesson_id: string | null;
  game_id: string | null;
  student_id: string | null;
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
  created_at: string;
  teachers: { name: string } | { name: string }[] | null;
}

interface GameRow {
  id: string;
  title: string;
  teacher_id: string;
  is_public: boolean;
  usage_count: number;
  created_at: string;
  teachers: { name: string } | { name: string }[] | null;
}

interface ScheduleSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

function ownerNameOf(row: LessonRow | GameRow): string | null {
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
  const [lessonSort, setLessonSort] = useState<"az" | "newest">("newest");

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showUploadStudents, setShowUploadStudents] = useState(false);
  const [photoStudentId, setPhotoStudentId] = useState<string | null>(null);
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
  const [copiedParentId, setCopiedParentId] = useState<string | null>(null);

  const [showAssignLesson, setShowAssignLesson] = useState(false);
  const [assignKind, setAssignKind] = useState<"lesson" | "game">("lesson");
  const [games, setGames] = useState<GameRow[] | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [assignError, setAssignError] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignTarget, setAssignTarget] = useState<"class" | "students">("class");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const [schedule, setSchedule] = useState<ScheduleSlot[] | null>(null);
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [scheduleDay, setScheduleDay] = useState(1);
  const [scheduleStart, setScheduleStart] = useState("15:00");
  const [scheduleEnd, setScheduleEnd] = useState("15:45");
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleBusy, setScheduleBusy] = useState(false);

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
      .select("id, name, avatar_url, parent_token")
      .eq("class_id", classId)
      .order("name", { ascending: true });

    if (studentsError) {
      setLoadError(studentsError.message);
    } else {
      setStudents(studentRows || []);
    }

    const { data: assignmentRows, error: assignmentsError } = await supabase
      .from("assignments")
      .select("id, lesson_id, game_id, student_id, assigned_at, due_at, is_active")
      .eq("class_id", classId)
      .order("assigned_at", { ascending: false });

    if (assignmentsError) {
      setLoadError(assignmentsError.message);
    } else {
      setAssignments(assignmentRows || []);
    }

    const { data: lessonRows, error: lessonsError } = await supabase
      .from("lessons")
      .select("id, title, teacher_id, is_public, usage_count, blocks, created_at, teachers(name)")
      .order("created_at", { ascending: false });

    if (lessonsError) {
      setLoadError(lessonsError.message);
    } else {
      setLessons((lessonRows as unknown as LessonRow[]) || []);
    }

    const { data: gameRows, error: gamesError } = await supabase
      .from("games")
      .select("id, title, teacher_id, is_public, usage_count, created_at, teachers(name)")
      .order("created_at", { ascending: false });

    if (gamesError) {
      setLoadError(gamesError.message);
    } else {
      setGames((gameRows as unknown as GameRow[]) || []);
    }

    const { data: scheduleRows, error: scheduleFetchError } = await supabase
      .from("class_schedule")
      .select("id, day_of_week, start_time, end_time")
      .eq("class_id", classId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (scheduleFetchError) {
      setLoadError(scheduleFetchError.message);
    } else {
      setSchedule(scheduleRows || []);
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
      .select("id, name, avatar_url, parent_token")
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

  async function copyParentLink(student: Student) {
    const url = `${window.location.origin}/parent/${student.parent_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedParentId(student.id);
      setTimeout(() => setCopiedParentId((v) => (v === student.id ? null : v)), 2000);
    } catch {
      window.prompt("Copy this link to share with a parent:", url);
    }
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

    const targets: (string | null)[] =
      assignTarget === "class" ? [null] : selectedStudentIds;

    if (assignTarget === "students" && targets.length === 0) {
      setAssignError("Select at least one student.");
      return;
    }

    const newDueDate = dueDate || null;
    const duplicateTarget = targets.find((studentId) =>
      (assignments || []).some((a) => {
        if (a.lesson_id !== lessonId) return false;
        const existingDueDate = a.due_at ? a.due_at.slice(0, 10) : null;
        if (existingDueDate !== newDueDate) return false;
        return a.student_id === studentId;
      })
    );
    if (duplicateTarget !== undefined) {
      const label =
        duplicateTarget === null
          ? "the whole class"
          : studentNameMap.get(duplicateTarget) || "that student";
      setAssignError(
        `This lesson is already assigned to ${label}${
          newDueDate ? " with that due date" : ""
        }.`
      );
      return;
    }

    setAssignBusy(true);

    const supabase = createBrowserSupabaseClient();
    const rows = targets.map((studentId) => ({
      class_id: classId,
      lesson_id: lessonId,
      student_id: studentId,
      due_at: dueDate ? new Date(dueDate).toISOString() : null,
      is_active: true,
    }));

    const { data, error } = await supabase
      .from("assignments")
      .insert(rows)
      .select("id, lesson_id, game_id, student_id, assigned_at, due_at, is_active");

    if (error || !data) {
      setAssignBusy(false);
      setAssignError(error?.message || "Could not assign lesson.");
      return;
    }

    for (let i = 0; i < data.length; i++) {
      await supabase.rpc("increment_lesson_usage", { lesson_id: lessonId });
    }

    setAssignments((prev) => [...data, ...(prev || [])]);
    setLessons(
      (prev) =>
        prev?.map((l) =>
          l.id === lessonId
            ? { ...l, usage_count: l.usage_count + data.length }
            : l
        ) ?? prev
    );
    setDueDate("");
    setSelectedStudentIds([]);
    setAssignBusy(false);
  }

  async function assignGameToClass(gameId: string) {
    setAssignError("");

    const targets: (string | null)[] =
      assignTarget === "class" ? [null] : selectedStudentIds;

    if (assignTarget === "students" && targets.length === 0) {
      setAssignError("Select at least one student.");
      return;
    }

    const newDueDate = dueDate || null;
    const duplicateTarget = targets.find((studentId) =>
      (assignments || []).some((a) => {
        if (a.game_id !== gameId) return false;
        const existingDueDate = a.due_at ? a.due_at.slice(0, 10) : null;
        if (existingDueDate !== newDueDate) return false;
        return a.student_id === studentId;
      })
    );
    if (duplicateTarget !== undefined) {
      const label =
        duplicateTarget === null
          ? "the whole class"
          : studentNameMap.get(duplicateTarget) || "that student";
      setAssignError(
        `This game is already assigned to ${label}${
          newDueDate ? " with that due date" : ""
        }.`
      );
      return;
    }

    setAssignBusy(true);

    const supabase = createBrowserSupabaseClient();
    const rows = targets.map((studentId) => ({
      class_id: classId,
      game_id: gameId,
      student_id: studentId,
      due_at: dueDate ? new Date(dueDate).toISOString() : null,
      is_active: true,
    }));

    const { data, error } = await supabase
      .from("assignments")
      .insert(rows)
      .select("id, lesson_id, game_id, student_id, assigned_at, due_at, is_active");

    if (error || !data) {
      setAssignBusy(false);
      setAssignError(error?.message || "Could not assign game.");
      return;
    }

    for (let i = 0; i < data.length; i++) {
      await supabase.rpc("increment_game_usage", { game_id: gameId });
    }

    setAssignments((prev) => [...data, ...(prev || [])]);
    setGames(
      (prev) =>
        prev?.map((g) =>
          g.id === gameId ? { ...g, usage_count: g.usage_count + data.length } : g
        ) ?? prev
    );
    setDueDate("");
    setSelectedStudentIds([]);
    setAssignBusy(false);
  }

  async function addScheduleSlot() {
    setScheduleError("");
    if (scheduleEnd <= scheduleStart) {
      setScheduleError("End time must be after start time.");
      return;
    }

    setScheduleBusy(true);
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("class_schedule")
      .insert({
        class_id: classId,
        day_of_week: scheduleDay,
        start_time: scheduleStart,
        end_time: scheduleEnd,
      })
      .select("id, day_of_week, start_time, end_time")
      .single();

    setScheduleBusy(false);

    if (error || !data) {
      setScheduleError(error?.message || "Could not add time slot.");
      return;
    }

    setSchedule((prev) =>
      [...(prev || []), data].sort(
        (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)
      )
    );
    setShowAddSchedule(false);
  }

  async function removeScheduleSlot(id: string) {
    setScheduleError("");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from("class_schedule").delete().eq("id", id);

    if (error) {
      setScheduleError(error.message);
      return;
    }

    setSchedule((prev) => (prev || []).filter((s) => s.id !== id));
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
    const result = await forkLesson(supabase, myTeacherId, lesson);

    if ("error" in result) {
      setAssignBusy(false);
      setAssignError(result.error);
      return;
    }

    router.push(`/academy/teacher/create-lesson?lessonId=${result.id}`);
  }

  const inputStyle: React.CSSProperties = {
    fontSize: "0.95rem",
    padding: "0.55rem 0.75rem",
    borderRadius: radius.iconSquare,
    border: `1px solid ${colors.inputBorder}`,
    outline: "none",
    direction: "ltr",
    textAlign: "left",
    fontFamily: "inherit",
    width: "100%",
    background: colors.white,
  };

  const primaryButtonStyle: React.CSSProperties = {
    fontSize: "0.82rem",
    fontWeight: 800,
    padding: "0.45rem 0.8rem",
    borderRadius: radius.button,
    border: "none",
    background: colors.orange,
    boxShadow: solidShadow(3, colors.orangeShadow),
    color: colors.white,
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...primaryButtonStyle,
    background: colors.neutralGray,
    boxShadow: solidShadow(3, colors.neutralGrayShadow),
  };

  const dashedButtonStyle: React.CSSProperties = {
    fontSize: "0.9rem",
    fontWeight: 800,
    padding: "0.5rem 0.9rem",
    borderRadius: radius.button,
    border: "none",
    background: colors.greenButton,
    boxShadow: solidShadow(3, colors.greenButtonShadow),
    color: colors.white,
    cursor: "pointer",
  };

  const lessonTitleMap = new Map((lessons || []).map((l) => [l.id, l.title]));
  const gameTitleMap = new Map((games || []).map((g) => [g.id, g.title]));
  const studentNameMap = new Map((students || []).map((s) => [s.id, s.name]));
  const sortedStudents = [...(students || [])].sort((a, b) => a.name.localeCompare(b.name));
  const sortedLessons = [...(lessons || [])].sort((a, b) =>
    lessonSort === "az"
      ? a.title.localeCompare(b.title)
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const sortedGames = [...(games || [])].sort((a, b) =>
    lessonSort === "az"
      ? a.title.localeCompare(b.title)
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
          background: colors.background,
          color: colors.textPrimary,
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>
          Class not found
        </h1>
        <Link href="/teacher/classes" style={{ color: "inherit", textDecoration: "underline", fontWeight: 700 }}>
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
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>
          {classInfo?.name || "Loading..."}
        </h1>
      </div>

      {loadError && <p style={{ color: colors.coralText, fontSize: "0.9rem", fontWeight: 600 }}>{loadError}</p>}

      {classInfo && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.6rem 1rem",
            borderRadius: radius.card,
            background: colors.white,
            boxShadow: solidShadow(4, colors.rosterCardShadow),
          }}
        >
          <span style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.6 }}>Join code</span>
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
              fontWeight: 800,
              padding: "0.4rem 0.8rem",
              borderRadius: radius.button,
              border: "none",
              background: copied ? colors.greenCard : colors.neutralGray,
              boxShadow: solidShadow(3, copied ? colors.greenCardShadow : colors.neutralGrayShadow),
              color: colors.white,
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
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>
            Students
          </h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={() => setShowAddStudent((v) => !v)} style={dashedButtonStyle}>
              + Add Student
            </button>
            <button onClick={() => setShowUploadStudents((v) => !v)} style={dashedButtonStyle}>
              Upload Students (Excel)
            </button>
          </div>
        </div>

        {showUploadStudents && (
          <UploadStudentsExcel
            classId={classId}
            onAdded={(newStudents) =>
              setStudents((prev) => [
                ...(prev || []),
                ...newStudents.map((s) => ({ ...s, avatar_url: null })),
              ])
            }
            onDone={() => setShowUploadStudents(false)}
          />
        )}

        {lastAddedPin && (
          <div
            style={{
              background: colors.completedCardBg,
              borderRadius: radius.iconSquare,
              boxShadow: solidShadow(3, colors.completedCardShadow),
              padding: "0.6rem 0.9rem",
              marginBottom: "0.75rem",
              textAlign: "left",
              fontSize: "0.9rem",
              fontWeight: 600,
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
              background: colors.completedCardBg,
              borderRadius: radius.iconSquare,
              boxShadow: solidShadow(3, colors.completedCardShadow),
              padding: "0.6rem 0.9rem",
              marginBottom: "0.75rem",
              textAlign: "left",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            New PIN for <strong>{regenPinResult.name}</strong>:{" "}
            <strong style={{ direction: "ltr", display: "inline-block" }}>
              {regenPinResult.pin}
            </strong>
          </div>
        )}

        {removeStudentError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.75rem" }}>
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
              borderRadius: radius.card,
              padding: "0.9rem",
              marginBottom: "0.75rem",
              background: colors.white,
              boxShadow: solidShadow(4, colors.rosterCardShadow),
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
              <span style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.7 }}>PIN</span>
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
                  fontWeight: 700,
                  padding: "0.35rem 0.7rem",
                  borderRadius: radius.button,
                  border: "none",
                  background: colors.neutralGray,
                  color: colors.white,
                  cursor: "pointer",
                }}
              >
                Regenerate
              </button>
            </div>
            {addStudentError && (
              <p style={{ color: colors.coralText, fontSize: "0.85rem", margin: 0 }}>
                {addStudentError}
              </p>
            )}
            <button
              type="submit"
              disabled={addStudentBusy}
              style={{
                fontSize: "0.95rem",
                fontWeight: 800,
                padding: "0.7rem 1rem",
                borderRadius: radius.button,
                border: "none",
                background: colors.orange,
                boxShadow: addStudentBusy ? "none" : solidShadow(4, colors.orangeShadow),
                color: colors.white,
                cursor: addStudentBusy ? "default" : "pointer",
                opacity: addStudentBusy ? 0.7 : 1,
              }}
            >
              {addStudentBusy ? "Adding..." : "Add Student"}
            </button>
          </form>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {students === null && <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading...</p>}
          {students?.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600 }}>No students yet.</p>
          )}
          {sortedStudents.map((s) => {
            const isEditing = editingStudentId === s.id;
            return (
              <div key={s.id} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.6rem",
                    padding: "0.6rem 0.9rem",
                    borderRadius: radius.iconSquare,
                    background: colors.white,
                    boxShadow: solidShadow(3, colors.rosterCardShadow),
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
                      <p style={{ color: colors.coralText, fontSize: "0.8rem", margin: 0 }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <StudentThumbnail avatarUrl={s.avatar_url} />
                      <span>{s.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0, flexWrap: "wrap" }}>
                      <button
                        onClick={() => setPhotoStudentId((v) => (v === s.id ? null : s.id))}
                        style={secondaryButtonStyle}
                      >
                        Photo
                      </button>
                      <button onClick={() => startEditStudent(s)} style={secondaryButtonStyle}>
                        Edit
                      </button>
                      <button onClick={() => copyParentLink(s)} style={secondaryButtonStyle}>
                        {copiedParentId === s.id ? "Copied!" : "👪 Parent Link"}
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
                        style={{ ...secondaryButtonStyle, background: colors.coralText, boxShadow: "none" }}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </div>
              {photoStudentId === s.id && (
                <StudentPhotoUploader
                  studentId={s.id}
                  studentName={s.name}
                  onUploaded={(avatarUrl) => {
                    setStudents(
                      (prev) =>
                        prev?.map((student) =>
                          student.id === s.id ? { ...student, avatar_url: avatarUrl } : student
                        ) ?? prev
                    );
                    setPhotoStudentId(null);
                  }}
                  onCancel={() => setPhotoStudentId(null)}
                />
              )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Schedule section */}
      <section style={{ width: "100%", maxWidth: "600px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
          }}
        >
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>Weekly Schedule</h2>
          <button onClick={() => setShowAddSchedule((v) => !v)} style={dashedButtonStyle}>
            + Add Time Slot
          </button>
        </div>

        {showAddSchedule && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              borderRadius: radius.card,
              padding: "0.9rem",
              marginBottom: "0.75rem",
              background: colors.white,
              boxShadow: solidShadow(4, colors.rosterCardShadow),
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <select
                value={scheduleDay}
                onChange={(e) => setScheduleDay(Number(e.target.value))}
                style={{ ...inputStyle, width: "auto", flex: 1, minWidth: "120px" }}
              >
                {DAY_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={scheduleStart}
                onChange={(e) => setScheduleStart(e.target.value)}
                style={{ ...inputStyle, width: "auto" }}
              />
              <span style={{ alignSelf: "center", fontWeight: 700, opacity: 0.6 }}>to</span>
              <input
                type="time"
                value={scheduleEnd}
                onChange={(e) => setScheduleEnd(e.target.value)}
                style={{ ...inputStyle, width: "auto" }}
              />
            </div>
            {scheduleError && (
              <p style={{ color: colors.coralText, fontSize: "0.85rem", margin: 0 }}>
                {scheduleError}
              </p>
            )}
            <button
              onClick={addScheduleSlot}
              disabled={scheduleBusy}
              style={{
                fontSize: "0.9rem",
                fontWeight: 800,
                padding: "0.6rem 1rem",
                borderRadius: radius.button,
                border: "none",
                background: colors.orange,
                boxShadow: scheduleBusy ? "none" : solidShadow(3, colors.orangeShadow),
                color: colors.white,
                cursor: scheduleBusy ? "default" : "pointer",
                opacity: scheduleBusy ? 0.7 : 1,
              }}
            >
              {scheduleBusy ? "Adding..." : "Add Time Slot"}
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {schedule === null && <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading...</p>}
          {schedule?.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600 }}>
              No time slots yet — add one so this class shows up on your weekly schedule.
            </p>
          )}
          {schedule?.map((slot) => (
            <div
              key={slot.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.6rem",
                padding: "0.5rem 0.9rem",
                borderRadius: radius.iconSquare,
                background: colors.white,
                boxShadow: solidShadow(3, colors.rosterCardShadow),
                textAlign: "left",
                fontSize: "0.88rem",
                fontWeight: 700,
              }}
            >
              <span>
                {DAY_NAMES[slot.day_of_week]} · {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
              </span>
              <button
                onClick={() => removeScheduleSlot(slot.id)}
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  padding: "0.3rem 0.6rem",
                  borderRadius: radius.button,
                  border: "none",
                  background: colors.coralText,
                  color: colors.white,
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Attendance section */}
      <section style={{ width: "100%", maxWidth: "600px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.75rem" }}>Attendance</h2>
        <Attendance
          classId={classId}
          students={(students || []).map((s) => ({ id: s.id, name: s.name }))}
        />
      </section>

      {/* Notes section */}
      {myTeacherId && (
        <section style={{ width: "100%", maxWidth: "600px" }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.75rem" }}>Notes</h2>
          <Notes
            classId={classId}
            teacherId={myTeacherId}
            students={(students || []).map((s) => ({ id: s.id, name: s.name }))}
          />
        </section>
      )}

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
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>
            Assignments
          </h2>
          <button onClick={() => setShowAssignLesson((v) => !v)} style={dashedButtonStyle}>
            + New Assignment
          </button>
        </div>

        {showAssignLesson && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              borderRadius: radius.card,
              padding: "0.9rem",
              marginBottom: "0.75rem",
              background: colors.white,
              boxShadow: solidShadow(4, colors.rosterCardShadow),
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button
                type="button"
                onClick={() => setAssignKind("lesson")}
                style={{
                  flex: 1,
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  padding: "0.5rem",
                  borderRadius: radius.button,
                  border: "none",
                  background: assignKind === "lesson" ? colors.orange : colors.background,
                  color: assignKind === "lesson" ? colors.white : colors.textPrimary,
                  cursor: "pointer",
                }}
              >
                🎵 Lesson
              </button>
              <button
                type="button"
                onClick={() => setAssignKind("game")}
                style={{
                  flex: 1,
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  padding: "0.5rem",
                  borderRadius: radius.button,
                  border: "none",
                  background: assignKind === "game" ? colors.orange : colors.background,
                  color: assignKind === "game" ? colors.white : colors.textPrimary,
                  cursor: "pointer",
                }}
              >
                🎮 Game
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, opacity: 0.7 }}>
                Due date (optional, applies to whichever {assignKind} you assign below)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, opacity: 0.7 }}>Assign to</label>
              <div style={{ display: "flex", gap: "1rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
                  <input
                    type="radio"
                    checked={assignTarget === "class"}
                    onChange={() => {
                      setAssignTarget("class");
                      setSelectedStudentIds([]);
                    }}
                  />
                  Whole class
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
                  <input
                    type="radio"
                    checked={assignTarget === "students"}
                    onChange={() => setAssignTarget("students")}
                  />
                  Specific student(s)
                </label>
              </div>

              {assignTarget === "students" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.3rem",
                    maxHeight: "150px",
                    overflowY: "auto",
                    borderRadius: radius.iconSquare,
                    background: colors.background,
                    padding: "0.5rem 0.7rem",
                  }}
                >
                  {sortedStudents.length === 0 && (
                    <span style={{ fontSize: "0.8rem", fontWeight: 600, opacity: 0.55 }}>
                      No students in this class yet.
                    </span>
                  )}
                  {sortedStudents.map((s) => (
                    <label
                      key={s.id}
                      style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(s.id)}
                        onChange={(e) =>
                          setSelectedStudentIds((prev) =>
                            e.target.checked
                              ? [...prev, s.id]
                              : prev.filter((id) => id !== s.id)
                          )
                        }
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {assignError && (
              <p style={{ color: colors.coralText, fontSize: "0.85rem", margin: 0 }}>
                {assignError}
              </p>
            )}

            {((assignKind === "lesson" && lessons !== null && lessons.length > 0) ||
              (assignKind === "game" && games !== null && games.length > 0)) && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, opacity: 0.6 }}>Sort:</span>
                <div
                  style={{
                    display: "flex",
                    borderRadius: radius.button,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setLessonSort("newest")}
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 800,
                      padding: "0.35rem 0.8rem",
                      border: "none",
                      background: lessonSort === "newest" ? colors.orange : colors.neutralGray,
                      color: colors.white,
                      cursor: "pointer",
                    }}
                  >
                    Newest
                  </button>
                  <button
                    onClick={() => setLessonSort("az")}
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 800,
                      padding: "0.35rem 0.8rem",
                      border: "none",
                      background: lessonSort === "az" ? colors.orange : colors.neutralGray,
                      color: colors.white,
                      cursor: "pointer",
                    }}
                  >
                    A-Z
                  </button>
                </div>
              </div>
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
              {assignKind === "lesson" && (
              <>
              {lessons === null && <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading lessons...</p>}
              {lessons?.length === 0 && (
                <p style={{ opacity: 0.6, fontWeight: 600 }}>
                  No lessons yet.{" "}
                  <Link href="/academy/teacher/create-lesson" style={{ textDecoration: "underline" }}>
                    Create one
                  </Link>
                  .
                </p>
              )}
              {sortedLessons.map((l) => {
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
                      borderRadius: radius.iconSquare,
                      background: colors.listRowBg,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{l.title}</div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, opacity: 0.6 }}>
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
              </>
              )}

              {assignKind === "game" && (
              <>
              {games === null && <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading games...</p>}
              {games?.length === 0 && (
                <p style={{ opacity: 0.6, fontWeight: 600 }}>
                  No games yet.{" "}
                  <Link href="/games/teacher/create-game" style={{ textDecoration: "underline" }}>
                    Create one
                  </Link>
                  .
                </p>
              )}
              {sortedGames.map((g) => {
                const isMine = g.teacher_id === myTeacherId;
                const owner = ownerNameOf(g);
                return (
                  <div
                    key={g.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.6rem",
                      padding: "0.6rem 0.75rem",
                      borderRadius: radius.iconSquare,
                      background: colors.listRowBg,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{g.title}</div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, opacity: 0.6 }}>
                        {isMine ? "Your game" : `by ${owner || "another teacher"}`} · used{" "}
                        {g.usage_count} time{g.usage_count === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                      <button
                        onClick={() => assignGameToClass(g.id)}
                        disabled={assignBusy}
                        style={primaryButtonStyle}
                      >
                        {isMine ? "Assign" : "Assign as-is"}
                      </button>
                    </div>
                  </div>
                );
              })}
              </>
              )}
            </div>
          </div>
        )}

        {removeError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            {removeError}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {assignments === null && <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading...</p>}
          {assignments?.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600 }}>No assignments yet.</p>
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
                borderRadius: radius.iconSquare,
                background: colors.white,
                boxShadow: solidShadow(3, colors.rosterCardShadow),
                textAlign: "left",
                fontSize: "0.9rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>
                  {a.game_id
                    ? `🎮 ${gameTitleMap.get(a.game_id) ?? "Unknown game"}`
                    : a.lesson_id
                      ? (lessonTitleMap.get(a.lesson_id) ?? legacyLessonTitle(a.lesson_id))
                      : "Unknown assignment"}
                </div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.6 }}>
                  {a.student_id
                    ? `Assigned to: ${studentNameMap.get(a.student_id) || "Unknown student"}`
                    : "Whole class"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
                <span style={{ opacity: 0.6, fontWeight: 600, direction: "ltr" }}>
                  {a.due_at
                    ? `Due ${new Date(a.due_at).toLocaleDateString()}`
                    : "No due date"}
                </span>
                <button
                  onClick={() => removeAssignment(a.id)}
                  title="Remove this assignment"
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    padding: "0.3rem 0.6rem",
                    borderRadius: radius.button,
                    border: "none",
                    background: colors.coralText,
                    color: colors.white,
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
          fontWeight: 700,
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
