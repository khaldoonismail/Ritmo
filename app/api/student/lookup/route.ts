import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Confirms a class + student name combination exists before the client
// advances to the PIN step. Deliberately returns no student data (no id,
// no count) so it can't be used to enumerate students or PINs.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const joinCode =
    typeof body?.joinCode === "string" ? body.joinCode.trim().toUpperCase() : "";

  if (!name || !joinCode) {
    return NextResponse.json(
      { error: "Enter your name and class join code." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();

  const { data: classRow } = await supabase
    .from("classes")
    .select("id")
    .eq("join_code", joinCode)
    .maybeSingle();

  if (!classRow) {
    return NextResponse.json(
      { error: "No class found with that join code." },
      { status: 404 }
    );
  }

  const { data: studentRow } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", classRow.id)
    .ilike("name", name)
    .maybeSingle();

  if (!studentRow) {
    return NextResponse.json(
      { error: "No student with that name in this class." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
