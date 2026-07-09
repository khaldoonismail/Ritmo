import { createClient } from "@supabase/supabase-js";
import { randomJoinCode } from "../lib/joinCode.js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Fill in .env.local first."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEACHER_EMAIL = "teacher.demo@ritmo.test";
const TEACHER_PASSWORD = "Demo1234!";
const TEACHER_NAME = "Demo Teacher";

const TEACHER2_EMAIL = "teacher2.demo@ritmo.test";
const TEACHER2_PASSWORD = "Demo1234!";
const TEACHER2_NAME = "Demo Teacher Two";

const PUBLIC_LESSON_TITLE = "Community Rhythm Basics";
const PUBLIC_LESSON_BLOCKS = [
  {
    id: "intro",
    type: "text",
    x: 40,
    y: 40,
    width: 320,
    height: 180,
    text: "This community lesson covers basic rhythm patterns every beginner should know.",
    url: "",
    topic: "",
    generated: "",
  },
  {
    id: "q1",
    type: "question",
    x: 400,
    y: 40,
    width: 320,
    height: 260,
    text: "How many beats are in a 4/4 measure?",
    options: ["2", "3", "4", "6"],
    correctIndex: 2,
  },
];

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function ensureAuthUser(email, password, name) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (!createError) return created.user.id;

  const alreadyExists =
    createError.status === 422 || /already.*registered/i.test(createError.message);
  if (!alreadyExists) throw createError;

  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw new Error(`Could not find existing auth user for ${email}`);
  return existing.id;
}

async function ensureTeacherRow(authUserId) {
  let teacher = null;
  for (let attempt = 0; attempt < 5 && !teacher; attempt++) {
    const { data, error } = await supabase
      .from("teachers")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error) throw error;
    teacher = data;
    if (!teacher) await new Promise((r) => setTimeout(r, 300));
  }
  if (!teacher) throw new Error("teachers row was not created by the trigger");
  return teacher;
}

async function main() {
  console.log("Seeding demo teacher, class, and students...\n");

  const authUserId = await ensureAuthUser(TEACHER_EMAIL, TEACHER_PASSWORD, TEACHER_NAME);
  const teacher = await ensureTeacherRow(authUserId);
  console.log(`Teacher: ${teacher.name} <${teacher.email}> (${teacher.id})`);

  const { data: existingClass } = await supabase
    .from("classes")
    .select("*")
    .eq("teacher_id", teacher.id)
    .eq("name", "Demo Class")
    .maybeSingle();

  let klass = existingClass;
  if (!klass) {
    const { data, error } = await supabase
      .from("classes")
      .insert({
        teacher_id: teacher.id,
        name: "Demo Class",
        join_code: randomJoinCode(),
      })
      .select()
      .single();
    if (error) throw error;
    klass = data;
  }
  console.log(`Class: ${klass.name} (join code ${klass.join_code})`);

  const studentNames = ["Alex", "Sam", "Riya"];
  const students = [];
  for (const name of studentNames) {
    const { data: existingStudent } = await supabase
      .from("students")
      .select("*")
      .eq("class_id", klass.id)
      .eq("name", name)
      .maybeSingle();
    if (existingStudent) {
      students.push(existingStudent);
      continue;
    }
    const { data, error } = await supabase
      .from("students")
      .insert({ class_id: klass.id, name, pin: randomPin() })
      .select()
      .single();
    if (error) throw error;
    students.push(data);
  }
  console.log(
    "Students:",
    students.map((s) => `${s.name} (pin ${s.pin})`).join(", ")
  );

  const { data: existingAssignment } = await supabase
    .from("assignments")
    .select("*")
    .eq("class_id", klass.id)
    .eq("lesson_id", "1")
    .maybeSingle();

  let assignment = existingAssignment;
  if (!assignment) {
    const { data, error } = await supabase
      .from("assignments")
      .insert({ class_id: klass.id, lesson_id: "1", is_active: true })
      .select()
      .single();
    if (error) throw error;
    assignment = data;
  }
  console.log(`Assignment: lesson "${assignment.lesson_id}" (${assignment.id})`);

  for (const student of students) {
    const { data: existingProgress } = await supabase
      .from("student_progress")
      .select("id")
      .eq("student_id", student.id)
      .eq("assignment_id", assignment.id)
      .maybeSingle();
    if (existingProgress) continue;
    const { error } = await supabase.from("student_progress").insert({
      student_id: student.id,
      assignment_id: assignment.id,
      status: "not_started",
    });
    if (error) throw error;
  }

  console.log("\nSeeding a second teacher with one public lesson...\n");

  const authUserId2 = await ensureAuthUser(TEACHER2_EMAIL, TEACHER2_PASSWORD, TEACHER2_NAME);
  const teacher2 = await ensureTeacherRow(authUserId2);
  console.log(`Teacher: ${teacher2.name} <${teacher2.email}> (${teacher2.id})`);

  const { data: existingLesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("teacher_id", teacher2.id)
    .eq("title", PUBLIC_LESSON_TITLE)
    .maybeSingle();

  let publicLesson = existingLesson;
  if (!publicLesson) {
    const { data, error } = await supabase
      .from("lessons")
      .insert({
        teacher_id: teacher2.id,
        title: PUBLIC_LESSON_TITLE,
        blocks: PUBLIC_LESSON_BLOCKS,
        is_public: true,
      })
      .select()
      .single();
    if (error) throw error;
    publicLesson = data;
  }
  console.log(`Public lesson: "${publicLesson.title}" (${publicLesson.id})`);

  console.log("\nSeed complete.");
  console.log(`Teacher 1 login: ${TEACHER_EMAIL} / ${TEACHER_PASSWORD}`);
  console.log(`Class join code: ${klass.join_code}`);
  console.log("Students:");
  for (const s of students) {
    console.log(`  - ${s.name}, PIN ${s.pin}`);
  }
  console.log(`\nTeacher 2 login: ${TEACHER2_EMAIL} / ${TEACHER2_PASSWORD}`);
  console.log(`Public lesson id: ${publicLesson.id}`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
