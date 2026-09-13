"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { colors, radius, solidShadow } from "@/lib/theme";

type Status = "present" | "absent" | "late";

interface StudentLite {
  id: string;
  name: string;
}

interface AttendanceRow {
  student_id: string;
  date: string;
  status: Status;
}

interface HistoryDay {
  date: string;
  present: number;
  absent: number;
  late: number;
}

const STATUS_LABEL: Record<Status, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
};

const STATUS_COLOR: Record<Status, { bg: string; text: string }> = {
  present: { bg: colors.completedCardBg, text: colors.lessonsText },
  absent: { bg: colors.coralBackground, text: colors.coralText },
  late: { bg: colors.inProgressCardBg, text: colors.classesText },
};

function todayIso(): string {
  return new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd, local time
}

export default function Attendance({
  classId,
  students,
}: {
  classId: string;
  students: StudentLite[];
}) {
  const [date, setDate] = useState(todayIso());
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<HistoryDay[]>([]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    async function loadForDate() {
      setLoading(true);
      setSaved(false);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("attendance")
        .select("student_id, date, status")
        .eq("class_id", classId)
        .eq("date", date);

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const existing: Record<string, Status> = {};
      for (const row of (data || []) as AttendanceRow[]) {
        existing[row.student_id] = row.status;
      }
      // Default anyone with no row yet to "present" so a normal day is a
      // single click, not N clicks.
      const next: Record<string, Status> = {};
      for (const s of students) {
        next[s.id] = existing[s.id] ?? "present";
      }
      setMarks(next);
      setLoading(false);
    }

    if (students.length > 0) {
      loadForDate();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date, students.length]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;

    async function loadHistory() {
      const { data } = await supabase
        .from("attendance")
        .select("date, status")
        .eq("class_id", classId)
        .order("date", { ascending: false })
        .limit(200);

      if (cancelled || !data) return;

      const byDate = new Map<string, HistoryDay>();
      for (const row of data as { date: string; status: Status }[]) {
        const entry = byDate.get(row.date) || { date: row.date, present: 0, absent: 0, late: 0 };
        entry[row.status] += 1;
        byDate.set(row.date, entry);
      }
      setHistory(
        [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)
      );
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [classId, saved]);

  function setMark(studentId: string, status: Status) {
    setMarks((prev) => ({ ...prev, [studentId]: status }));
    setSaved(false);
  }

  async function saveAttendance() {
    setSaving(true);
    setError("");
    setSaved(false);

    const supabase = createBrowserSupabaseClient();
    const rows = students.map((s) => ({
      class_id: classId,
      student_id: s.id,
      date,
      status: marks[s.id] ?? "present",
    }));

    const { error: upsertError } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict: "class_id,student_id,date" });

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setSaved(true);
  }

  const inputStyle: React.CSSProperties = {
    fontSize: "0.9rem",
    fontWeight: 700,
    padding: "0.5rem 0.75rem",
    borderRadius: radius.button,
    border: `1px solid ${colors.inputBorder}`,
    background: colors.white,
    color: colors.textPrimary,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => setDate(e.target.value)}
          style={inputStyle}
        />
        {saved && (
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: colors.lessonsText }}>
            ✓ Saved
          </span>
        )}
      </div>

      {error && <p style={{ color: colors.coralText, fontSize: "0.85rem", margin: 0 }}>{error}</p>}

      {loading && <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading...</p>}

      {!loading && students.length === 0 && (
        <p style={{ opacity: 0.6, fontWeight: 600 }}>No students in this class yet.</p>
      )}

      {!loading && students.length > 0 && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {students.map((s) => {
              const status = marks[s.id] ?? "present";
              return (
                <div
                  key={s.id}
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
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>{s.name}</span>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    {(["present", "late", "absent"] as Status[]).map((opt) => {
                      const active = status === opt;
                      const c = STATUS_COLOR[opt];
                      return (
                        <button
                          key={opt}
                          onClick={() => setMark(s.id, opt)}
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            padding: "0.3rem 0.6rem",
                            borderRadius: radius.pill,
                            border: active ? "none" : `1px solid ${colors.inputBorder}`,
                            background: active ? c.bg : colors.white,
                            color: active ? c.text : colors.textPrimary,
                            cursor: "pointer",
                          }}
                        >
                          {STATUS_LABEL[opt]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={saveAttendance}
            disabled={saving}
            style={{
              alignSelf: "flex-start",
              fontSize: "0.9rem",
              fontWeight: 800,
              padding: "0.6rem 1.2rem",
              borderRadius: radius.button,
              border: "none",
              background: colors.orange,
              boxShadow: saving ? "none" : solidShadow(3, colors.orangeShadow),
              color: colors.white,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        </>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: "0.25rem" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 800, marginBottom: "0.4rem" }}>
            Recent history
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {history.map((h) => (
              <div
                key={h.date}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  opacity: 0.75,
                }}
              >
                <span>{new Date(h.date + "T00:00:00").toLocaleDateString()}</span>
                <span>
                  {h.present} present
                  {h.late > 0 && ` · ${h.late} late`}
                  {h.absent > 0 && ` · ${h.absent} absent`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
