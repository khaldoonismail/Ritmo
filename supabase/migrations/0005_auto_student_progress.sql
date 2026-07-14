-- Automatically links students to assignments via student_progress, so the
-- Assessment page always has data to show without manual backfilling.
--
-- Two triggers, both idempotent via the existing unique constraint on
-- student_progress(student_id, assignment_id) (added in 0001_init.sql as
-- `unique (student_id, assignment_id)`):
--
-- 1. New assignment -> create a not_started progress row for every student
--    it applies to (the whole class, or just the targeted student if
--    assignments.student_id is set — see 0004_assignment_student_id.sql).
-- 2. New student -> backfill a not_started progress row for every active,
--    whole-class assignment already in their class. Per-student assignments
--    are deliberately excluded since they were never meant for this student.

create or replace function public.fn_create_progress_for_new_assignment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.student_id is not null then
    insert into public.student_progress (student_id, assignment_id, status)
    values (new.student_id, new.id, 'not_started')
    on conflict (student_id, assignment_id) do nothing;
  else
    insert into public.student_progress (student_id, assignment_id, status)
    select s.id, new.id, 'not_started'
    from public.students s
    where s.class_id = new.class_id
    on conflict (student_id, assignment_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assignment_created on public.assignments;
create trigger trg_assignment_created
  after insert on public.assignments
  for each row execute function public.fn_create_progress_for_new_assignment();

create or replace function public.fn_backfill_progress_for_new_student()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.student_progress (student_id, assignment_id, status)
  select new.id, a.id, 'not_started'
  from public.assignments a
  where a.class_id = new.class_id
    and a.is_active = true
    and a.student_id is null
  on conflict (student_id, assignment_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_student_created on public.students;
create trigger trg_student_created
  after insert on public.students
  for each row execute function public.fn_backfill_progress_for_new_student();
