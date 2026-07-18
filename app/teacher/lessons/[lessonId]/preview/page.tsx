"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { LessonBlockData } from "@/lib/lessonBlocks";
import LessonView from "@/app/student/lesson/[assignmentId]/LessonView";
import { colors } from "@/lib/theme";

export default function LessonPreviewPage() {
  const params = useParams();
  const lessonId = params?.lessonId as string;
  const router = useRouter();

  const [lesson, setLesson] = useState<{ title: string; blocks: LessonBlockData[] } | null>(
    null
  );
  const [notFound, setNotFound] = useState(false);

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

      const { data, error } = await supabase
        .from("lessons")
        .select("title, blocks")
        .eq("id", lessonId)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        return;
      }

      setLesson({ title: data.title, blocks: data.blocks });
    }

    if (lessonId) load();
  }, [lessonId, router]);

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
          Lesson not found
        </h1>
        <Link href="/teacher/lessons" style={{ color: "inherit", textDecoration: "underline", fontWeight: 700 }}>
          ← Back to My Lessons
        </Link>
      </main>
    );
  }

  if (!lesson) {
    return <main style={{ minHeight: "100vh", background: colors.background }} />;
  }

  return (
    <LessonView title={lesson.title} blocks={lesson.blocks} backHref="/teacher/lessons" />
  );
}
