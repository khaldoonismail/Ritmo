import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Fill in .env.local first."
  );
  process.exit(1);
}

const TEACHER_EMAIL = "teacher.demo@ritmo.test";
const TEACHER_PASSWORD = "Demo1234!";

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`PASS - ${label}`);
    passed++;
  } else {
    console.log(`FAIL - ${label}`);
    failed++;
  }
}

async function main() {
  const anon = createClient(supabaseUrl, anonKey);

  const { data: signInData, error: signInError } =
    await anon.auth.signInWithPassword({
      email: TEACHER_EMAIL,
      password: TEACHER_PASSWORD,
    });
  check("teacher can sign in", !signInError && !!signInData?.session);

  const { data: classes, error: classesError } = await anon
    .from("classes")
    .select("*");
  check(
    "teacher sees exactly their own seeded class via RLS",
    !classesError && classes?.length === 1 && classes[0].name === "Demo Class"
  );

  const classId = classes?.[0]?.id;
  const { data: students, error: studentsError } = await anon
    .from("students")
    .select("*")
    .eq("class_id", classId);
  check(
    "teacher sees exactly 3 students via RLS",
    !studentsError && students?.length === 3
  );

  const { data: assignments } = await anon
    .from("assignments")
    .select("*")
    .eq("class_id", classId);
  check("teacher sees the seeded assignment", assignments?.length === 1);

  const { data: progress } = await anon
    .from("student_progress")
    .select("*")
    .eq("assignment_id", assignments?.[0]?.id);
  check(
    "teacher sees progress rows for all 3 students",
    progress?.length === 3
  );

  // RLS isolation: a signed-out anon client must see nothing.
  const unauth = createClient(supabaseUrl, anonKey);
  const { data: blockedClasses } = await unauth.from("classes").select("*");
  check(
    "unauthenticated client is blocked from classes by RLS",
    (blockedClasses?.length ?? 0) === 0
  );

  // Student login flow, exercised against the running Next.js dev server.
  const joinCode = classes?.[0]?.join_code;
  const student = students?.[0];
  if (joinCode && student) {
    const res = await fetch("http://localhost:3000/api/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: student.name, joinCode, pin: student.pin }),
    });
    const json = await res.json().catch(() => null);
    check(
      "student login API succeeds with correct name/join_code/pin",
      res.ok && json?.studentId === student.id
    );
    const setCookie = res.headers.get("set-cookie") || "";
    check(
      "student login API sets a session cookie",
      setCookie.includes("ritmo_student_session")
    );

    const badRes = await fetch("http://localhost:3000/api/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: student.name, joinCode, pin: "0000" }),
    });
    check("student login API rejects a wrong PIN", badRes.status === 401);
  } else {
    console.log("SKIP - student login API checks (no seeded data found)");
  }

  await anon.auth.signOut();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\nVerify failed:", err);
  process.exit(1);
});
