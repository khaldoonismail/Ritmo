import { NextResponse } from "next/server";
import { STUDENT_SESSION_COOKIE } from "@/lib/studentSession";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(STUDENT_SESSION_COOKIE);
  return response;
}
