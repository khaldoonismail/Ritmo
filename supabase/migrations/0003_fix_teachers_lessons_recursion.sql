-- Fixes "infinite recursion detected in policy for relation teachers"
-- (Postgres error 42P17). 0002's teachers_select_public_lesson_owners
-- policy queries lessons directly, but lessons' own SELECT policy queries
-- teachers back — a genuine cycle Postgres refuses to evaluate.
--
-- The fix: look up "which teachers own a public lesson" through a
-- SECURITY DEFINER function instead of a raw subquery. The function runs
-- with elevated privileges, so its internal query against lessons bypasses
-- lessons' RLS entirely (rather than re-triggering it), breaking the cycle.
-- This is the standard Supabase pattern for mutually-referencing policies.

create or replace function public.teacher_ids_with_public_lessons()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select distinct teacher_id from public.lessons where is_public = true;
$$;

grant execute on function public.teacher_ids_with_public_lessons() to authenticated;

drop policy if exists "teachers_select_public_lesson_owners" on public.teachers;
create policy "teachers_select_public_lesson_owners" on public.teachers
  for select using (
    id in (select public.teacher_ids_with_public_lessons())
  );
