-- Stage 2 of Sleepy Town (Loud or Soft): it becomes a shared Community
-- Game that teachers can assign, the same way as Piano Hop, Happy or Sad,
-- Rhythm Jump and Music Train (0030_stage2_games.sql).
--
--   * games.generator gains 'loud_or_soft': a game whose questions are made
--     in the browser, so the game row has no saved questions. The teacher's
--     chosen settings (level, dynamic markings) go in
--     assignments.game_settings, tagged with "game": "loud_or_soft".
--   * Runs use the game_runs table from 0029 as it is (server-stamped
--     started_at, submitted once, service role only).
--   * Results go to game_results as before (source 'assignment', one row
--     per student per assignment = their best round), with
--     game_results.variant set to the settings label, e.g.
--     'sleepy-town:hard'.
--
-- Additive only: a widened check constraint (every existing value stays
-- valid) and one new private game row. No column, table, function or
-- policy is added, changed or removed, and no existing row is touched, so
-- the deployed code keeps working exactly as it does now. The new game is
-- private, so only its owner (the main account) sees it, under "My games",
-- until the new code is deployed; don't assign it before then.

-- ---------------------------------------------------------------------------
-- games.generator: allow the new game
-- ---------------------------------------------------------------------------
-- 0030 named the constraint games_generator_check. Drop any check
-- constraint covering generator (in case its name differs), then add the
-- wider one under the same fixed name.
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
  check (generator in (
    'note_reading', 'note_runner', 'up_or_down',
    'piano_hop', 'happy_or_sad', 'rhythm_jump', 'music_train',
    'loud_or_soft'
  ));

-- ---------------------------------------------------------------------------
-- The shared game
-- ---------------------------------------------------------------------------
-- Owned by an explicit teacher (Khaldoon, the main account). Fails loudly
-- if that teacher doesn't exist, and does nothing if the game already
-- exists. Created private: it's made public only once the app code that
-- plays and grades it is deployed (a separate statement, run then).
-- Tags: lib/gameTags.ts ('dynamics' and 'ear-training'; the registry puts
-- it under "Tempo & dynamics").
do $$
declare
  v_owner uuid := 'b564f2b4-38b5-4a5b-ad57-43e1c90098f8';
begin
  if not exists (select 1 from public.teachers where id = v_owner) then
    raise exception 'Sleepy Town owner teacher % not found', v_owner;
  end if;
  if not exists (select 1 from public.games where generator = 'loud_or_soft') then
    insert into public.games (teacher_id, title, questions, tags, is_public, generator)
    values (v_owner, 'Sleepy Town', '[]'::jsonb, '{dynamics,ear-training}', false, 'loud_or_soft');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Run AFTER the new code is deployed (not part of this migration):
-- ---------------------------------------------------------------------------
-- update public.games set is_public = true
-- where generator = 'loud_or_soft'
--   and teacher_id = 'b564f2b4-38b5-4a5b-ad57-43e1c90098f8';
