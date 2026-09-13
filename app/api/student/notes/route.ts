import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyStudentSessionToken, STUDENT_SESSION_COOKIE } from "@/lib/studentSession";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Notes for the signed-in student: whole-class notes (student_id is null)
// plus any note aimed directly at them. Read-only, service-role (students
// have no auth.uid() for RLS), same pattern as every other student route.
export async function GET() {
  const token = cookies().get(STUDENT_SESSION_COOKIE)?.value;
  const session = token ? await verifyStudentSessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("teacher_notes")
    .select("id, student_id, message, created_at")
    .eq("class_id", session.classId)
    .or(`student_id.is.null,student_id.eq.${session.studentId}`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: data || [] });
}
