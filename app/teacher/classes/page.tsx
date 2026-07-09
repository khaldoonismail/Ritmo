"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          maxWidth: "600px",
          marginTop: "1rem",
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
