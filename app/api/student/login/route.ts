import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  createStudentSessionToken,
  STUDENT_SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
} from "@/lib/studentSession";

const GENERIC_ERROR = "Invalid name, join code, or PIN";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const joinCode =
    typeof body?.joinCode === "string" ? body.joinCode.trim().toUpperCase() : "";
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

  if (!name || !joinCode || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("join_code", joinCode)
    .maybeSingle();

  if (classError || !classRow) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const { data: studentRow, error: studentError } = await supabase
    .from("students")
    .select("id, name")
    .eq("class_id", classRow.id)
    .eq("pin", pin)
    .ilike("name", name)
    .maybeSingle();

  if (studentError || !studentRow) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const token = await createStudentSessionToken({
    studentId: studentRow.id,
    classId: classRow.id,
    name: studentRow.name,
  });

  const response = NextResponse.json({
    studentId: studentRow.id,
    name: studentRow.name,
  });
  response.cookies.set(STUDENT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  return response;
}
