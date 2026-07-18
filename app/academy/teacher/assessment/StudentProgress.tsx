"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { lessonTitle as legacyLessonTitle } from "@/lib/lessons";
import { colors, radius, solidShadow } from "@/lib/theme";

type ProgressStatus = "not_started" | "in_progress" | "completed";

const STATUS_DISPLAY: Record<
  ProgressStatus,
  { icon: string; label: string; badgeBg: string }
> = {
  completed: { icon: "✓", label: "Completed", badgeBg: colors.greenCard },
  in_progress: { icon: "▶", label: "In progress", badgeBg: colors.orange },
  not_started: { icon: "🔒", label: "Not started", badgeBg: colors.neutralGray },
};

const AVATAR_COLORS = [
  { bg: colors.orange, shadow: colors.orangeShadow },
  { bg: colors.greenCard, shadow: colors.greenCardShadow },
];

type PerformanceRating = "excellent" | "very_good" | "good" | "needs_practice";

const RATING_DISPLAY: Record<
  PerformanceRating,
  { label: string; bg: string; shadow: string }
> = {
  excellent: { label: "Excellent", bg: colors.greenCard, shadow: colors.greenCardShadow },
  very_good: { label: "Very Good", bg: colors.greenButton, shadow: colors.greenButtonShadow },
  good: { label: "Good", bg: colors.orange, shadow: colors.orangeShadow },
  needs_practice: {
    label: "Needs Practice",
    bg: colors.neutralGray,
    shadow: colors.neutralGrayShadow,
  },
};

const RATING_OPTIONS: PerformanceRating[] = [
  "excellent",
  "very_good",
  "good",
  "needs_practice",
];

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
  performance_rating: PerformanceRating | null;
  updated_at: string;
}

interface RosterEntry {
  studentId: string;
  studentName: string;
  status: ProgressStatus;
  score: number | null;
  rating: PerformanceRating | null;
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
          .select("student_id, assignment_id, status, score, performance_rating, updated_at")
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
              rating: p?.performance_rating ?? null,
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

  async function saveRating(
    assignmentId: string,
    studentId: string,
    rating: PerformanceRating | null
  ) {
    const key = `${assignmentId}:${studentId}`;
    const currentStatus =
      roster.get(assignmentId)?.find((e) => e.studentId === studentId)?.status ??
      "not_started";

    setSavingKey(key);
    setSaveError((prev) => ({ ...prev, [key]: "" }));

    const supabase = createBrowserSupabaseClient();
    const { error: saveErr } = await supabase.from("student_progress").upsert(
      {
        student_id: studentId,
        assignment_id: assignmentId,
        performance_rating: rating,
        status: currentStatus,
      },
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
          ? { ...e, rating, updatedAt: new Date().toISOString() }
          : e
      );
      next.set(assignmentId, entries);
      return next;
    });
  }

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));

  const ratingSelectStyle = (rating: PerformanceRating | null): React.CSSProperties => {
    const display = rating ? RATING_DISPLAY[rating] : null;
    return {
      fontSize: "0.8rem",
      fontWeight: 800,
      fontFamily: "inherit",
      padding: "0.4rem 0.6rem",
      borderRadius: radius.pill,
      border: "none",
      outline: "none",
      background: display?.bg ?? colors.neutralGray,
      color: colors.white,
      cursor: "pointer",
      width: "140px",
    };
  };

  if (loading) {
    return <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading student progress...</p>;
  }

  if (error) {
    return <p style={{ color: colors.coralText, fontSize: "0.9rem", fontWeight: 600 }}>{error}</p>;
  }

  if (classes.length === 0) {
    return (
      <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>
        You don't have any classes yet.
      </p>
    );
  }

  if (assignments.length === 0) {
    return (
      <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>
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
              borderRadius: radius.card,
              padding: "1.25rem",
              background: colors.white,
              boxShadow: solidShadow(4, colors.rosterCardShadow),
              textAlign: "left",
            }}
          >
            <div style={{ marginBottom: "0.85rem" }}>
              <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{title}</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.7 }}>
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
              <p style={{ opacity: 0.6, fontWeight: 600, fontSize: "0.85rem" }}>
                No students to show for this assignment.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {entries.map((entry, i) => {
                  const key = `${a.id}:${entry.studentId}`;
                  const { icon, label, badgeBg } = STATUS_DISPLAY[entry.status];
                  const avatar = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  return (
                    <div
                      key={entry.studentId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.6rem",
                        padding: "0.6rem 0.75rem",
                        borderRadius: radius.iconSquare,
                        background: "#FCFAF3",
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
                        {entry.studentName.charAt(0).toUpperCase()}
                      </span>
                      <span style={{ fontWeight: 700, marginRight: "auto" }}>
                        {entry.studentName}
                      </span>

                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: "0.7rem",
                          padding: "0.3rem 0.6rem",
                          borderRadius: radius.pill,
                          background: badgeBg,
                          color: colors.white,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {icon} {label}
                      </span>

                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <input
                          type="number"
                          value={scoreInputs[key] ?? ""}
                          onChange={(e) =>
                            setScoreInputs((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          onBlur={() => saveScore(a.id, entry.studentId)}
                          disabled={savingKey === key}
                          placeholder="—"
                          style={{
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            fontFamily: "inherit",
                            width: "44px",
                            height: "32px",
                            padding: 0,
                            borderRadius: "10px",
                            border: "none",
                            outline: "none",
                            textAlign: "center",
                            background: colors.scoreBoxBg,
                            boxShadow: solidShadow(3, colors.scoreBoxShadow),
                          }}
                        />
                        {saveError[key] && (
                          <div style={{ color: colors.coralText, fontSize: "0.7rem" }}>
                            {saveError[key]}
                          </div>
                        )}
                      </span>

                      <select
                        value={entry.rating ?? ""}
                        onChange={(e) =>
                          saveRating(
                            a.id,
                            entry.studentId,
                            e.target.value === ""
                              ? null
                              : (e.target.value as PerformanceRating)
                          )
                        }
                        disabled={savingKey === key}
                        style={ratingSelectStyle(entry.rating)}
                      >
                        <option value="">Rate…</option>
                        {RATING_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {RATING_DISPLAY[r].label}
                          </option>
                        ))}
                      </select>

                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          opacity: 0.55,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.updatedAt
                          ? new Date(entry.updatedAt).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
