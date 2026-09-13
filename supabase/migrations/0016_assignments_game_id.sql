-- Lets a teacher assign a game (not just a lesson) to a class/student, so
-- it shows up on the student dashboard and can be auto-graded on
-- submission. lesson_id becomes nullable and a new nullable game_id is
-- added, with a check constraint that exactly one of the two is set —
-- an assignment is either a lesson or a game, never both/neither.
--
-- The existing auto-progress triggers (0005_auto_student_progress.sql)
-- key off assignment id/class_id/student_id only, never lesson_id, so they
-- keep working unchanged for game assignments too.

alter table public.assignments alter column lesson_id drop not null;
alter table public.assignments add column if not exists game_id uuid references public.games (id) on delete cascade;

alter table public.assignments drop constraint if exists assignments_lesson_or_game;
alter table public.assignments add constraint assignments_lesson_or_game
  check ((lesson_id is not null)::int + (game_id is not null)::int = 1);

create index if not exists assignments_game_id_idx on public.assignments (game_id);
