-- Stage 2 of Note Runner and Up or Down: both become shared Community
-- Games that teachers can assign, like the shared Note Reading game
-- (0028_note_reading_single_game.sql).
--
--   * games.generator gains 'note_runner' and 'up_or_down': endless runs
--     whose notes are made in the browser, so the game has no saved
--     questions. The teacher's chosen settings go in
--     assignments.game_settings (already there since 0028), tagged with
--     "game": "note_runner" / "up_or_down".
--   * game_runs: one row per run a student starts on an assigned runner
--     game. The server stamps started_at when the run begins and checks the
--     submitted answers against the elapsed time when it ends (service role
--     only, like assignment_question_sets).
--   * students.runner_character: the runner a signed-in student picked
--     (kind / skin / outfit), so it follows them to any device.
--   * Results go to game_results as before (source 'assignment', one row
--     per student per assignment = their best run), with game_results.variant
--     set to the level, e.g. 'treble-easy' or 'hard'.
--
-- Additive only: a widened check constraint (every existing value stays
-- valid), one new nullable column, one new table, two new private game
-- rows. No existing row is changed and no function or policy is replaced,
-- so the deployed code keeps working exactly as it does now: it never sees
-- the new games (private, and owned by the main account only) and never
-- reads the new column or table.

-- ---------------------------------------------------------------------------
-- games.generator: allow the two runner games
-- ---------------------------------------------------------------------------
-- 0028 added the check inline, so its name was picked by Postgres (normally
-- games_generator_check). Drop whichever check constraint covers
-- generator, then add the wider one under a fixed name.
do $$
declare
  v_name text;
begin
  for v_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.games'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%generator%'
  loop
    execute format('alter table public.games drop constraint %I', v_name);
  end loop;
end;
$$;
alter table public.games add constraint games_generator_check
  check (generator in ('note_reading', 'note_runner', 'up_or_down'));

-- ---------------------------------------------------------------------------
-- students.runner_character
-- ---------------------------------------------------------------------------
-- Written only by app/api/student/character (service role, after checking
-- the student's signed session cookie).
alter table public.students add column if not exists runner_character jsonb;

-- ---------------------------------------------------------------------------
-- game_runs: server-timed runs (service role only)
-- ---------------------------------------------------------------------------
create table if not exists public.game_runs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  started_at timestamptz not null default now(),
  -- Set once, when the run is submitted; a finished run can't be reused.
  finished_at timestamptz,
  points integer,
  correct_count integer,
  answer_count integer
);

create index if not exists game_runs_student_started_idx
  on public.game_runs (student_id, started_at desc);

-- RLS on with no policies: only the service-role routes
-- (app/api/student/runs/*) can read or write it.
alter table public.game_runs enable row level security;

-- ---------------------------------------------------------------------------
-- The two shared games
-- ---------------------------------------------------------------------------
-- Owned by an explicit teacher (Khaldoon, the main account). Fails loudly
-- if that teacher doesn't exist, and does nothing for a game that already
-- exists. Created private: they're made public only once the app code that
-- plays and grades them is deployed (a separate statement, run then).
do $$
declare
  v_owner uuid := 'b564f2b4-38b5-4a5b-ad57-43e1c90098f8';
begin
  if not exists (select 1 from public.teachers where id = v_owner) then
    raise exception 'Runner games owner teacher % not found', v_owner;
  end if;
  if not exists (select 1 from public.games where generator = 'note_runner') then
    insert into public.games (teacher_id, title, questions, tags, is_public, generator)
    values (v_owner, 'Note Runner', '[]'::jsonb, '{note-reading}', false, 'note_runner');
  end if;
  if not exists (select 1 from public.games where generator = 'up_or_down') then
    insert into public.games (teacher_id, title, questions, tags, is_public, generator)
    values (v_owner, 'Up or Down', '[]'::jsonb, '{ear-training}', false, 'up_or_down');
  end if;
end;
$$;
