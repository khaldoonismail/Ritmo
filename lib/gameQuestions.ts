import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NOTE_READING_GENERATOR, generateFromConfig, normalizeNoteReadingConfig } from "@/lib/noteReading";

// Where a play's questions live (supabase/migrations/0028_note_reading_single_game.sql):
//   * Team Battle: session_questions for a generated game (shared Note
//     Reading), else the game's own saved questions.
//   * Assignment: assignment_question_sets for a generated game (one set per
//     student), else the game's own saved questions.
// Both tables are server-only, so these take the service-role client.

export async function teamBattleQuestions<T>(
  admin: SupabaseClient,
  sessionId: string,
  gameId: string
): Promise<T[]> {
  const { data: sq } = await admin
    .from("session_questions")
    .select("questions")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (sq && Array.isArray(sq.questions)) return sq.questions as T[];
  const { data: game } = await admin.from("games").select("questions").eq("id", gameId).maybeSingle();
  return Array.isArray(game?.questions) ? (game!.questions as T[]) : [];
}

// An assigned game's questions for one student. For the shared Note Reading
// game each student gets their own set, generated from the assignment's
// settings the first time they open it and kept, so reloading never rerolls
// easier notes and the server can grade against it. `create: false` (the
// submit route) only reads an existing set.
export async function assignmentQuestions<T>(
  admin: SupabaseClient,
  opts: {
    assignmentId: string;
    studentId: string;
    game: { questions: unknown; generator?: string | null };
    gameSettings: unknown;
    create: boolean;
  }
): Promise<T[]> {
  if (opts.game.generator !== NOTE_READING_GENERATOR) {
    return Array.isArray(opts.game.questions) ? (opts.game.questions as T[]) : [];
  }

  const read = async () => {
    const { data } = await admin
      .from("assignment_question_sets")
      .select("questions")
      .eq("assignment_id", opts.assignmentId)
      .eq("student_id", opts.studentId)
      .maybeSingle();
    return data && Array.isArray(data.questions) ? (data.questions as T[]) : null;
  };

  const existing = await read();
  if (existing || !opts.create) return existing ?? [];

  const questions = generateFromConfig(normalizeNoteReadingConfig(opts.gameSettings));
  // ignoreDuplicates: if two tabs open at once, the first set wins and both
  // read it back below.
  await admin
    .from("assignment_question_sets")
    .upsert(
      { assignment_id: opts.assignmentId, student_id: opts.studentId, questions },
      { onConflict: "assignment_id,student_id", ignoreDuplicates: true }
    );
  return (await read()) ?? [];
}
