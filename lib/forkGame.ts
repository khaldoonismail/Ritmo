import type { SupabaseClient } from "@supabase/supabase-js";

interface ForkableGame {
  id: string;
  title: string;
  questions: unknown[];
}

// Copies a game into a new row owned by `teacherId`, records forked_from,
// and bumps the original game's usage_count via the increment_game_usage
// RPC (which works even when the original belongs to a different teacher,
// since ordinary RLS would otherwise block that update). Mirrors
// lib/forkLesson.ts.
export async function forkGame(
  supabase: SupabaseClient,
  teacherId: string,
  original: ForkableGame
): Promise<{ id: string } | { error: string }> {
  const { data: newGame, error } = await supabase
    .from("games")
    .insert({
      teacher_id: teacherId,
      title: original.title,
      questions: original.questions,
      is_public: false,
      forked_from: original.id,
    })
    .select("id")
    .single();

  if (error || !newGame) {
    return { error: error?.message || "Could not copy game." };
  }

  await supabase.rpc("increment_game_usage", { game_id: original.id });

  return { id: newGame.id };
}
