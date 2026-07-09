import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error("Missing Supabase env vars. Fill in .env.local first.");
  process.exit(1);
}

const TEACHER_EMAIL = "teacher.demo@ritmo.test";
const TEACHER_PASSWORD = "Demo1234!";
const PUBLIC_LESSON_TITLE = "Community Rhythm Basics";

let passed = 0;
let failed = 0;
function check(label, condition) {
  console.log((condition ? "PASS" : "FAIL") + ` - ${label}`);
  condition ? passed++ : failed++;
}

async function main() {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Sign in as Demo Teacher (owner of Demo Class, NOT owner of the public lesson).
  const asDemoTeacher = createClient(supabaseUrl, anonKey);
  const { data: signInData, error: signInError } =
    await asDemoTeacher.auth.signInWithPassword({
      email: TEACHER_EMAIL,
      password: TEACHER_PASSWORD,
    });
  check("Demo Teacher can sign in", !signInError && !!signInData?.session);

  const { data: myTeacherRow } = await asDemoTeacher
    .from("teachers")
    .select("id")
    .eq("auth_user_id", signInData.session.user.id)
    .maybeSingle();
  const { data: myClass } = await asDemoTeacher
    .from("classes")
    .select("id, name")
    .eq("name", "Demo Class")
    .maybeSingle();
  check("Demo Teacher's own class is visible", !!myClass);

  const { data: publicLesson, error: publicLessonError } = await asDemoTeacher
    .from("lessons")
    .select("id, title, blocks, teacher_id, usage_count")
    .eq("title", PUBLIC_LESSON_TITLE)
    .maybeSingle();
  check(
    "Demo Teacher can see the OTHER teacher's public lesson via RLS",
    !publicLessonError && !!publicLesson && publicLesson.teacher_id !== myTeacherRow.id
  );

  const originalTitle = publicLesson.title;
  const originalBlocks = JSON.stringify(publicLesson.blocks);
  const originalOwner = publicLesson.teacher_id;

  // --- Scenario 1: Assign as-is -------------------------------------------
  const { data: baselineLesson } = await admin
    .from("lessons")
    .select("usage_count")
    .eq("id", publicLesson.id)
    .single();
  const usageBeforeAssign = baselineLesson.usage_count;

  const { data: assignment, error: assignError } = await asDemoTeacher
    .from("assignments")
    .insert({ class_id: myClass.id, lesson_id: publicLesson.id, is_active: true })
    .select("id, lesson_id")
    .single();
  check("Scenario 1: Assign as-is creates an assignment", !assignError && !!assignment);

  const { error: rpcError1 } = await asDemoTeacher.rpc("increment_lesson_usage", {
    lesson_id: publicLesson.id,
  });
  check("Scenario 1: increment_lesson_usage RPC succeeds for a non-owned lesson", !rpcError1);

  const { data: afterAssign } = await admin
    .from("lessons")
    .select("usage_count, title, blocks, teacher_id")
    .eq("id", publicLesson.id)
    .single();
  check(
    "Scenario 1: original lesson's usage_count increased by 1",
    afterAssign.usage_count === usageBeforeAssign + 1
  );
  check(
    "Scenario 1: original lesson's content/owner is untouched",
    afterAssign.title === originalTitle &&
      JSON.stringify(afterAssign.blocks) === originalBlocks &&
      afterAssign.teacher_id === originalOwner
  );

  // --- Scenario 2: Copy & Edit ---------------------------------------------
  const { data: forkedLesson, error: forkError } = await asDemoTeacher
    .from("lessons")
    .insert({
      teacher_id: myTeacherRow.id,
      title: publicLesson.title,
      blocks: publicLesson.blocks,
      is_public: false,
      forked_from: publicLesson.id,
    })
    .select("id, teacher_id, forked_from, title")
    .single();
  check(
    "Scenario 2: fork creates a new lesson owned by Demo Teacher",
    !forkError && forkedLesson?.teacher_id === myTeacherRow.id
  );
  check(
    "Scenario 2: forked lesson records forked_from = original id",
    forkedLesson?.forked_from === publicLesson.id
  );

  const { error: rpcError2 } = await asDemoTeacher.rpc("increment_lesson_usage", {
    lesson_id: publicLesson.id,
  });
  check("Scenario 2: increment_lesson_usage RPC succeeds again for the fork source", !rpcError2);

  const { data: afterFork } = await admin
    .from("lessons")
    .select("usage_count")
    .eq("id", publicLesson.id)
    .single();
  check(
    "Scenario 2: original lesson's usage_count increased again (now +2 total)",
    afterFork.usage_count === usageBeforeAssign + 2
  );

  const editedTitle = "Community Rhythm Basics (My Edited Copy)";
  const { data: editResult, error: editError } = await asDemoTeacher
    .from("lessons")
    .update({ title: editedTitle })
    .eq("id", forkedLesson.id)
    .select("id, title");
  check(
    "Scenario 2: Demo Teacher CAN edit their own forked copy",
    !editError && editResult?.length === 1 && editResult[0].title === editedTitle
  );

  const { data: originalAfterForkEdit } = await admin
    .from("lessons")
    .select("title")
    .eq("id", publicLesson.id)
    .single();
  check(
    "Scenario 2: original lesson is unaffected by editing the fork",
    originalAfterForkEdit.title === originalTitle
  );

  // --- Scenario 3: Cannot edit or delete the original ----------------------
  const { data: blockedUpdate, error: blockedUpdateError } = await asDemoTeacher
    .from("lessons")
    .update({ title: "Hijacked title" })
    .eq("id", publicLesson.id)
    .select("id");
  check(
    "Scenario 3: Demo Teacher CANNOT update the original lesson (RLS blocks it)",
    !blockedUpdateError && (blockedUpdate?.length ?? 0) === 0
  );

  const { data: blockedDelete, error: blockedDeleteError } = await asDemoTeacher
    .from("lessons")
    .delete()
    .eq("id", publicLesson.id)
    .select("id");
  check(
    "Scenario 3: Demo Teacher CANNOT delete the original lesson (RLS blocks it)",
    !blockedDeleteError && (blockedDelete?.length ?? 0) === 0
  );

  const { data: stillThere } = await admin
    .from("lessons")
    .select("id, title, teacher_id")
    .eq("id", publicLesson.id)
    .maybeSingle();
  check(
    "Scenario 3: original lesson still exists, unchanged, still owned by Teacher Two",
    !!stillThere && stillThere.title === originalTitle && stillThere.teacher_id === originalOwner
  );

  // Cleanup the assignment + fork this run created, so re-runs stay clean.
  await admin.from("assignments").delete().eq("id", assignment.id);
  await admin.from("lessons").delete().eq("id", forkedLesson.id);

  await asDemoTeacher.auth.signOut();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\nVerify failed:", err);
  process.exit(1);
});
