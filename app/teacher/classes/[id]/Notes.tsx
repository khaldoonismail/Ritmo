"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { colors, radius, solidShadow } from "@/lib/theme";

interface StudentLite {
  id: string;
  name: string;
}

interface NoteRow {
  id: string;
  student_id: string | null;
  message: string;
  created_at: string;
}

// One-way notes from a teacher to a whole class or one student — no replies,
// no read receipts, deliberately simpler than a chat. Students see these on
// their dashboard via /api/student/notes.
export default function Notes({
  classId,
  teacherId,
  students,
}: {
  classId: string;
  teacherId: string;
  students: StudentLite[];
}) {
  const [notes, setNotes] = useState<NoteRow[] | null>(null);
  const [target, setTarget] = useState<string>("class"); // "class" or a student id
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  async function load() {
    const supabase = createBrowserSupabaseClient();
    const { data, error: fetchError } = await supabase
      .from("teacher_notes")
      .select("id, student_id, message, created_at")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setNotes(data || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function sendNote() {
    const trimmed = message.trim();
    if (!trimmed) return;

    setSending(true);
    setError("");

    const supabase = createBrowserSupabaseClient();
    const { error: insertError } = await supabase.from("teacher_notes").insert({
      class_id: classId,
      teacher_id: teacherId,
      student_id: target === "class" ? null : target,
      message: trimmed,
    });

    setSending(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setMessage("");
    load();
  }

  async function deleteNote(id: string) {
    setDeleteBusyId(id);
    const supabase = createBrowserSupabaseClient();
    const { error: deleteError } = await supabase.from("teacher_notes").delete().eq("id", id);
    setDeleteBusyId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotes((prev) => (prev || []).filter((n) => n.id !== id));
  }

  function studentName(id: string | null): string {
    if (id === null) return "Whole class";
    return students.find((s) => s.id === id)?.name ?? "A student";
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          borderRadius: radius.card,
          padding: "0.9rem",
          background: colors.white,
          boxShadow: solidShadow(4, colors.rosterCardShadow),
        }}
      >
        <select value={target} onChange={(e) => setTarget(e.target.value)} style={inputStyle}>
          <option value="class">Whole class</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a note for your student(s)..."
          rows={2}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
        {error && <p style={{ color: colors.coralText, fontSize: "0.85rem", margin: 0 }}>{error}</p>}
        <button
          onClick={sendNote}
          disabled={sending || !message.trim()}
          style={{
            alignSelf: "flex-start",
            fontSize: "0.9rem",
            fontWeight: 800,
            padding: "0.55rem 1.1rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.orange,
            boxShadow: sending || !message.trim() ? "none" : solidShadow(3, colors.orangeShadow),
            color: colors.white,
            cursor: sending || !message.trim() ? "default" : "pointer",
            opacity: sending || !message.trim() ? 0.6 : 1,
          }}
        >
          {sending ? "Sending..." : "Send Note"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {notes === null && <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading...</p>}
        {notes?.length === 0 && (
          <p style={{ opacity: 0.6, fontWeight: 600 }}>No notes sent yet.</p>
        )}
        {notes?.map((n) => (
          <div
            key={n.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "0.6rem",
              padding: "0.6rem 0.9rem",
              borderRadius: radius.iconSquare,
              background: colors.white,
              boxShadow: solidShadow(3, colors.rosterCardShadow),
              textAlign: "left",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 800, opacity: 0.6, marginBottom: "0.15rem" }}>
                {studentName(n.student_id)} · {new Date(n.created_at).toLocaleDateString()}
              </div>
              <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{n.message}</div>
            </div>
            <button
              onClick={() => deleteNote(n.id)}
              disabled={deleteBusyId === n.id}
              style={{
                fontSize: "0.7rem",
                fontWeight: 800,
                padding: "0.3rem 0.6rem",
                borderRadius: radius.button,
                border: "none",
                background: colors.coralText,
                color: colors.white,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
