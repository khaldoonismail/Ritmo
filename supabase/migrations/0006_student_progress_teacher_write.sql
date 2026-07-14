-- The Assessment page lets a teacher edit a student's score, but
-- student_progress only had a SELECT policy for teachers (0001_init.sql) —
-- no INSERT/UPDATE, so a browser-side save would be silently blocked by RLS.
-- Adds write access scoped the same way as the existing select policy: only
-- for progress rows belonging to assignments in the teacher's own classes.
--
-- INSERT is included (not just UPDATE) to cover the rare fallback case in
-- the spec where a progress row is missing (e.g. the auto-create trigger in
-- 0005 failed) and the teacher's first score edit needs to create it.

create policy "student_progress_update_own" on public.student_progress
  for update using (
    assignment_id in (
      select a.id from public.assignments a
      join public.classes c on c.id = a.class_id
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  ) with check (
    assignment_id in (
      select a.id from public.assignments a
      join public.classes c on c.id = a.class_id
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

create policy "student_progress_insert_own" on public.student_progress
  for insert with check (
    assignment_id in (
      select a.id from public.assignments a
      join public.classes c on c.id = a.class_id
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );
