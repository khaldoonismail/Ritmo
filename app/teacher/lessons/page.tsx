"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { forkLesson } from "@/lib/forkLesson";
import type { LessonBlockData } from "@/lib/lessonBlocks";
import { colors, radius, solidShadow } from "@/lib/theme";

interface MyLesson {
  id: string;
  title: string;
  is_public: boolean;
  usage_count: number;
  blocks: LessonBlockData[];
}

interface CommunityLesson {
  id: string;
  title: string;
  usage_count: number;
  blocks: LessonBlockData[];
  teachers: { name: string } | { name: string }[] | null;
}

function ownerNameOf(row: CommunityLesson): string | null {
  if (Array.isArray(row.teachers)) return row.teachers[0]?.name ?? null;
  return row.teachers?.name ?? null;
}

export default function MyLessonsPage() {
  const router = useRouter();
  const [myTeacherId, setMyTeacherId] = useState<string | null>(null);
  const [myLessons, setMyLessons] = useState<MyLesson[] | null>(null);
  const [communityLessons, setCommunityLessons] = useState<CommunityLesson[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copyBusyId, setCopyBusyId] = useState<string | null>(null);

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

      if (!teacherRow) {
        setLoadError("Could not load your teacher account.");
        return;
      }
      setMyTeacherId(teacherRow.id);

      const { data: mine, error: mineError } = await supabase
        .from("lessons")
        .select("id, title, is_public, usage_count, blocks")
        .eq("teacher_id", teacherRow.id)
        .order("created_at", { ascending: false });

      if (mineError) {
        setLoadError(mineError.message);
      } else {
        setMyLessons(mine || []);
      }

      const { data: community, error: communityError } = await supabase
        .from("lessons")
        .select("id, title, usage_count, blocks, teachers(name)")
        .eq("is_public", true)
        .neq("teacher_id", teacherRow.id)
        .order("created_at", { ascending: false });

      if (communityError) {
        setLoadError(communityError.message);
      } else {
        setCommunityLessons((community as unknown as CommunityLesson[]) || []);
      }
    }

    load();
  }, [router]);

  async function handleCopyAndEdit(lesson: CommunityLesson) {
    if (!myTeacherId) return;
    setCopyError("");
    setCopyBusyId(lesson.id);

    const supabase = createBrowserSupabaseClient();
    const result = await forkLesson(supabase, myTeacherId, lesson);

    setCopyBusyId(null);

    if ("error" in result) {
      setCopyError(result.error);
      return;
    }

    router.push(`/academy/teacher/create-lesson?lessonId=${result.id}`);
  }

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "0.9rem 1.1rem",
    borderRadius: radius.card,
    background: colors.white,
    boxShadow: solidShadow(4, colors.rosterCardShadow),
  };

  const primaryButtonStyle: React.CSSProperties = {
    fontSize: "0.85rem",
    fontWeight: 800,
    padding: "0.5rem 0.9rem",
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
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>
        My Lessons
      </h1>

      {loadError && <p style={{ color: colors.coralText, fontSize: "0.9rem", fontWeight: 600 }}>{loadError}</p>}

      <Link
        href="/academy/teacher/create-lesson"
        style={{
          fontSize: "1rem",
          fontWeight: 800,
          padding: "0.85rem 1.4rem",
          borderRadius: radius.button,
          border: "none",
          background: colors.orange,
          boxShadow: solidShadow(5, colors.orangeShadow),
          color: colors.white,
          textDecoration: "none",
        }}
      >
        Create New Lesson +
      </Link>

      <section style={{ width: "100%", maxWidth: "650px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.75rem" }}>
          My Lessons
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {myLessons === null && !loadError && (
            <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading...</p>
          )}
          {myLessons?.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600 }}>
              You haven't created any lessons yet.
            </p>
          )}
          {myLessons?.map((l) => (
            <div key={l.id} style={rowStyle}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 800 }}>{l.title}</div>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, opacity: 0.6 }}>
                  {l.is_public ? "Public" : "Private"} · used {l.usage_count} time
                  {l.usage_count === 1 ? "" : "s"}
                </div>
              </div>
              <Link
                href={`/academy/teacher/create-lesson?lessonId=${l.id}`}
                style={secondaryButtonStyle}
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section style={{ width: "100%", maxWidth: "650px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.75rem" }}>
          Community Lessons
        </h2>

        {copyError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            {copyError}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {communityLessons === null && !loadError && (
            <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading...</p>
          )}
          {communityLessons?.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600 }}>
              No public lessons from other teachers yet.
            </p>
          )}
          {communityLessons?.map((l) => (
            <div key={l.id} style={rowStyle}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 800 }}>{l.title}</div>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, opacity: 0.6 }}>
                  by {ownerNameOf(l) || "another teacher"} · used {l.usage_count} time
                  {l.usage_count === 1 ? "" : "s"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                <Link href={`/teacher/lessons/${l.id}/preview`} style={secondaryButtonStyle}>
                  View
                </Link>
                <button
                  onClick={() => handleCopyAndEdit(l)}
                  disabled={copyBusyId === l.id}
                  style={primaryButtonStyle}
                >
                  {copyBusyId === l.id ? "Copying..." : "Copy & Edit"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Link
        href="/academy/teacher"
        style={{
          fontSize: "0.9rem",
          fontWeight: 700,
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
        }}
      >
        ← Back to Teacher Dashboard
      </Link>
    </main>
  );
}
