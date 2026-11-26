-- Stage 2 of Piano Hop, Happy or Sad (Weather Village), Rhythm Jump and
-- Music Train (Fast or Slow): all four become shared Community Games that
-- teachers can assign, the same way as Note Runner and Up or Down
-- (0029_runner_games.sql).
--
--   * games.generator gains 'piano_hop', 'happy_or_sad', 'rhythm_jump' and
--     'music_train': games whose questions are made in the browser, so the
--     game row has no saved questions. The teacher's chosen settings go in
--     assignments.game_settings (there since 0028), tagged with "game".
--   * Runs use the game_runs table from 0029 as it is (server-stamped
--     started_at, submitted once, service role only).
--   * Results go to game_results as before (source 'assignment', one row
--     per student per assignment = their best run), with game_results.variant
--     set to the settings label, e.g. 'rhythm-jump:custom-q.ee.qr-3:read:normal'
--     or 'music-train:hard'.
--
-- Additive only: a widened check constraint (every existing value stays
-- valid) and four new private game rows. No column, table, function or
-- policy is added, changed or removed, and no existing row is touched, so
-- the deployed code keeps working exactly as it does now. The new games are
-- private, so only their owner (the main account) sees them, under "My
-- games", until the new code is deployed; don't assign them before then.

-- ---------------------------------------------------------------------------
-- games.generator: allow the four new games
-- ---------------------------------------------------------------------------
-- 0029 named the constraint games_generator_check. Drop any check
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
    'piano_hop', 'happy_or_sad', 'rhythm_jump', 'music_train'
  ));

-- ---------------------------------------------------------------------------
-- The four shared games
-- ---------------------------------------------------------------------------
-- Owned by an explicit teacher (Khaldoon, the main account). Fails loudly
-- if that teacher doesn't exist, and does nothing for a game that already
-- exists. Created private: they're made public only once the app code that
-- plays and grades them is deployed (a separate statement, run then).
-- Tags: lib/gameTags.ts ('piano' and 'tempo' are new there; tags are plain
-- text[], 0012_game_tags.sql).
do $$
declare
  v_owner uuid := 'b564f2b4-38b5-4a5b-ad57-43e1c90098f8';
begin
  if not exists (select 1 from public.teachers where id = v_owner) then
    raise exception 'Stage 2 games owner teacher % not found', v_owner;
  end if;
  if not exists (select 1 from public.games where generator = 'piano_hop') then
    insert into public.games (teacher_id, title, questions, tags, is_public, generator)
    values (v_owner, 'Piano Hop', '[]'::jsonb, '{piano,note-reading}', false, 'piano_hop');
  end if;
  if not exists (select 1 from public.games where generator = 'happy_or_sad') then
    insert into public.games (teacher_id, title, questions, tags, is_public, generator)
    values (v_owner, 'Happy or Sad', '[]'::jsonb, '{ear-training}', false, 'happy_or_sad');
  end if;
  if not exists (select 1 from public.games where generator = 'rhythm_jump') then
    insert into public.games (teacher_id, title, questions, tags, is_public, generator)
    values (v_owner, 'Rhythm Jump', '[]'::jsonb, '{rhythm}', false, 'rhythm_jump');
  end if;
  if not exists (select 1 from public.games where generator = 'music_train') then
    insert into public.games (teacher_id, title, questions, tags, is_public, generator)
    values (v_owner, 'Music Train', '[]'::jsonb, '{tempo,ear-training}', false, 'music_train');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Run AFTER the new code is deployed (not part of this migration):
-- ---------------------------------------------------------------------------
-- update public.games set is_public = true
-- where generator in ('piano_hop', 'happy_or_sad', 'rhythm_jump', 'music_train')
--   and teacher_id = 'b564f2b4-38b5-4a5b-ad57-43e1c90098f8';
