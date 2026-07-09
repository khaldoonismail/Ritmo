import type { SupabaseClient } from "@supabase/supabase-js";
import type { LessonBlockData } from "@/lib/lessonBlocks";

interface ForkableLesson {
  id: string;
  title: string;
  blocks: LessonBlockData[];
}

// Copies a lesson into a new row owned by `teacherId`, records forked_from,
// and bumps the original lesson's usage_count via the increment_lesson_usage
// RPC (which works even when the original belongs to a different teacher,
// since ordinary RLS would otherwise block that update).
export async function forkLesson(
  supabase: SupabaseClient,
  teacherId: string,
  original: ForkableLesson
): Promise<{ id: string } | { error: string }> {
  const { data: newLesson, error } = await supabase
    .from("lessons")
    .insert({
      teacher_id: teacherId,
      title: original.title,
      blocks: original.blocks,
      is_public: false,
      forked_from: original.id,
    })
    .select("id")
    .single();

  if (error || !newLesson) {
    return { error: error?.message || "Could not copy lesson." };
  }

  await supabase.rpc("increment_lesson_usage", { lesson_id: original.id });

  return { id: newLesson.id };
}
