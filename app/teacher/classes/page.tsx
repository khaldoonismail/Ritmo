"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { randomJoinCode } from "@/lib/joinCode";

interface ClassRow {
  id: string;
  name: string;
  join_code: string;
  studentCount: number;
}

export default function TeacherClassesPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [error, setError] = useState("");
  const [myTeacherId, setMyTeacherId] = useState<string | null>(null);

  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [createError, setCreateError] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      if (teacherRow) setMyTeacherId(teacherRow.id);

      const { data, error: fetchError } = await supabase
        .from("classes")
        .select("id, name, join_code, students(count)")
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setClasses(
        (data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          join_code: c.join_code,
          studentCount: c.students?.[0]?.count ?? 0,
        }))
      );
    }

    load();
  }, [router]);

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!myTeacherId || !newClassName.trim()) return;
    setCreateError("");
    setCreateBusy(true);

    const supabase = createBrowserSupabaseClient();

    let lastError: { code?: string; message: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase
        .from("classes")
        .insert({
          teacher_id: myTeacherId,
          name: newClassName.trim(),
          join_code: randomJoinCode(),
        })
        .select("id")
        .single();

      if (!error && data) {
        router.push(`/teacher/classes/${data.id}`);
        return;
      }

      lastError = error;
      // 23505 = unique_violation; only a join_code collision is worth
      // retrying with a freshly generated code. Anything else, stop.
      if (error?.code !== "23505") break;
    }

    setCreateBusy(false);
    setCreateError(lastError?.message || "Could not create class.");
  }

  function startEditClass(c: ClassRow) {
    setEditingClassId(c.id);
    setEditClassName(c.name);
    setEditError("");
  }

  function cancelEditClass() {
    setEditingClassId(null);
    setEditClassName("");
    setEditError("");
  }

  async function saveClassName(classId: string) {
    if (!editClassName.trim()) return;
    setEditBusy(true);
    setEditError("");

    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase
      .from("classes")
      .update({ name: editClassName.trim() })
      .eq("id", classId)
      .select("id, name")
      .single();

    setEditBusy(false);

    if (error || !data) {
      setEditError(error?.message || "Could not rename class.");
      return;
    }

    setClasses(
      (prev) =>
        prev?.map((c) => (c.id === classId ? { ...c, name: data.name } : c)) ?? prev
    );
    setEditingClassId(null);
  }

  async function performDeleteClass() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError("");

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("classes")
      .delete()
      .eq("id", deleteTarget.id);

    setDeleteBusy(false);

    if (error) {
      setDeleteError(error.message);
      return;
    }

    setClasses((prev) => prev?.filter((c) => c.id !== deleteTarget.id) ?? prev);
    setDeleteTarget(null);
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

  const smallButtonStyle: React.CSSProperties = {
    fontSize: "0.8rem",
    fontWeight: 700,
    padding: "0.4rem 0.7rem",
    borderRadius: "6px",
    border: "1px solid #ddd",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        gap: "1rem",
      }}
    >
      <h1 style={{ fontSize: "2.25rem", fontWeight: 800, margin: 0 }}>
        My Classes
      </h1>

      {error && (
        <p style={{ color: "#c00", fontSize: "0.9rem" }}>{error}</p>
      )}

      <div style={{ width: "100%", maxWidth: "600px" }}>
        <button
          onClick={() => setShowCreateClass((v) => !v)}
          style={{
            fontSize: "0.95rem",
            fontWeight: 700,
            padding: "0.6rem 1rem",
            borderRadius: "8px",
            border: "1px dashed #999",
            background: "#fafafa",
            color: "#111",
            cursor: "pointer",
          }}
        >
          Create Class +
        </button>

        {showCreateClass && (
          <form
            onSubmit={handleCreateClass}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "0.9rem",
              marginTop: "0.6rem",
              background: "#fff",
              textAlign: "left",
            }}
          >
            <input
              type="text"
              placeholder="Class name"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              style={inputStyle}
              required
              autoFocus
            />
            {createError && (
              <p style={{ color: "#c00", fontSize: "0.85rem", margin: 0 }}>
                {createError}
              </p>
            )}
            <button
              type="submit"
              disabled={createBusy}
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                border: "none",
                background: "#111",
                color: "#fff",
                cursor: createBusy ? "default" : "pointer",
                opacity: createBusy ? 0.6 : 1,
              }}
            >
              {createBusy ? "Creating..." : "Create Class"}
            </button>
          </form>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          maxWidth: "600px",
          marginTop: "0.5rem",
        }}
      >
        {classes === null && !error && (
          <p style={{ opacity: 0.5, textAlign: "center" }}>Loading...</p>
        )}

        {classes?.length === 0 && (
          <p style={{ opacity: 0.5, textAlign: "center" }}>
            You don't have any classes yet.
          </p>
        )}

        {classes?.map((c) => {
          const isEditing = editingClassId === c.id;
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                padding: "0.9rem 1.1rem",
                border: "1px solid #ddd",
                borderRadius: "10px",
                background: "#fff",
              }}
            >
              {isEditing ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                    flex: 1,
                    textAlign: "left",
                  }}
                >
                  <input
                    type="text"
                    value={editClassName}
                    onChange={(e) => setEditClassName(e.target.value)}
                    style={inputStyle}
                    autoFocus
                  />
                  {editError && (
                    <p style={{ color: "#c00", fontSize: "0.8rem", margin: 0 }}>
                      {editError}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      onClick={() => saveClassName(c.id)}
                      disabled={editBusy}
                      style={{
                        ...smallButtonStyle,
                        background: "#111",
                        color: "#fff",
                        border: "none",
                      }}
                    >
                      {editBusy ? "Saving..." : "Save"}
                    </button>
                    <button onClick={cancelEditClass} style={smallButtonStyle}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                      {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                    <Link
                      href={`/teacher/classes/${c.id}`}
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        padding: "0.5rem 0.9rem",
                        borderRadius: "8px",
                        border: "none",
                        background: "#111",
                        color: "#fff",
                        textDecoration: "none",
                      }}
                    >
                      Manage
                    </Link>
                    <button onClick={() => startEditClass(c)} style={smallButtonStyle}>
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDeleteError("");
                        setDeleteTarget(c);
                      }}
                      style={{ ...smallButtonStyle, color: "#c00" }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <Link
        href="/academy/teacher"
        style={{
          fontSize: "0.9rem",
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
          marginTop: "0.5rem",
        }}
      >
        ← Back to Teacher Dashboard
      </Link>

      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "1.5rem",
              maxWidth: "380px",
              width: "100%",
              textAlign: "center",
            }}
          >
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 0.5rem" }}>
              Delete "{deleteTarget.name}"?
            </h2>
            <p style={{ fontSize: "0.85rem", opacity: 0.7, margin: "0 0 1.25rem" }}>
              This will permanently delete this class, all {deleteTarget.studentCount}{" "}
              student{deleteTarget.studentCount === 1 ? "" : "s"} in it, and all lesson
              assignments for it. This cannot be undone.
            </p>
            {deleteError && (
              <p style={{ color: "#c00", fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
                {deleteError}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <button
                onClick={performDeleteClass}
                disabled={deleteBusy}
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  padding: "0.7rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#c00",
                  color: "#fff",
                  cursor: deleteBusy ? "default" : "pointer",
                  opacity: deleteBusy ? 0.6 : 1,
                }}
              >
                {deleteBusy ? "Deleting..." : "Delete Class"}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
                style={{
                  fontSize: "0.85rem",
                  opacity: 0.7,
                  background: "none",
                  border: "none",
                  color: "inherit",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
