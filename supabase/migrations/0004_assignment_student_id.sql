-- Allows an assignment to target a single student instead of the whole
-- class. NULL (the existing default) keeps today's behavior — visible to
-- every student in the class.

alter table public.assignments
  add column if not exists student_id uuid references public.students (id) on delete cascade;
