import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudentSessionPayload } from "@/lib/studentSession";
import { isRunnerGenerator, normalizeRunnerSettings, type RunnerGenerator, type RunnerSettings } from "@/lib/runnerGames";

// An assigned runner game (lib/runnerGames.ts), as seen by one signed-in
// student: null unless the assignment is in their class, is for them (or
// the whole class), is active, and is one of the runner games. Takes the
// service-role client (students have no Supabase Auth session).
export interface RunnerAssignment {
  assignmentId: string;
  classId: string;
  gameId: string;
  gameTitle: string;
  generator: RunnerGenerator;
  settings: RunnerSettings;
}

export async function loadRunnerAssignment(
  admin: SupabaseClient,
  session: Pick<StudentSessionPayload, "studentId" | "classId">,
  assignmentId: string
): Promise<RunnerAssignment | null> {
  if (!assignmentId) return null;
  const { data: a } = await admin
    .from("assignments")
    .select("id, class_id, game_id, student_id, game_settings, is_active")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!a || a.class_id !== session.classId || !a.game_id || a.is_active === false) return null;
  if (a.student_id && a.student_id !== session.studentId) return null;
  const { data: game } = await admin.from("games").select("id, title, generator").eq("id", a.game_id).maybeSingle();
  if (!game || !isRunnerGenerator(game.generator)) return null;
  return {
    assignmentId: a.id,
    classId: a.class_id,
    gameId: game.id,
    gameTitle: game.title,
    generator: game.generator,
    settings: normalizeRunnerSettings(game.generator, a.game_settings),
  };
}
