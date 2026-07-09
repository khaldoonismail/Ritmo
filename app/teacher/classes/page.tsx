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

        {classes?.map((c) => (
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
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 700 }}>{c.name}</div>
              <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
              </div>
            </div>
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
          </div>
        ))}
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
    </main>
  );
}
