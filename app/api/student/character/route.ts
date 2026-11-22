import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizeCharacter } from "@/components/characters/choice";

// The runner a signed-in student plays as (students.runner_character,
// 0029_runner_games.sql), so it follows them to any device. Not signed in:
// 401, and the games keep the choice saved on the device instead.

async function studentId(): Promise<string | null> {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;
  return session?.studentId ?? null;
}

export async function GET() {
  const id = await studentId();
  if (!id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data } = await createAdminSupabaseClient()
    .from("students")
    .select("runner_character")
    .eq("id", id)
    .maybeSingle();
  const character = data?.runner_character ? normalizeCharacter(data.runner_character) : null;
  return NextResponse.json({ character });
}

export async function POST(request: NextRequest) {
  const id = await studentId();
  if (!id) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const character = normalizeCharacter(body?.character);
  if (!character) return NextResponse.json({ error: "Not a runner" }, { status: 400 });
  const { error } = await createAdminSupabaseClient()
    .from("students")
    .update({ runner_character: character })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ character });
}
