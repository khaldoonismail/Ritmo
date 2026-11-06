-- Team Battle hardening: a server-anchored question clock (so the speed
-- bonus no longer trusts the student's own countdown), reload recovery for
-- the host, an explicit End Game, and the answer-reveal step between
-- questions. Additive only: new nullable/defaulted columns and new
-- functions — no existing column, row, policy or function is changed.
--
-- The 'reveal' status this uses already exists on public.session_status
-- (0009_games_schema.sql); it was just never set until now.

alter table public.game_sessions
  -- When the current question went live (database clock). Null for
  -- sessions started before this migration, which fall back to the old
  -- client-reported timing in the answer route.
  add column if not exists question_started_at timestamptz,
  -- Set while status = 'paused'; folded into paused_seconds on resume.
  add column if not exists paused_at timestamptz,
  -- Total time the current question has spent paused, so it doesn't count
  -- against the timer. Reset whenever a new question starts.
  add column if not exists paused_seconds numeric not null default 0,
  -- When the host ended the session (End Game, or after the last question).
  add column if not exists ended_at timestamptz;

-- Starts (or restarts) a question: Start Game, Next Question, and the
-- advance after Skip all go through this, so every question's clock is
-- stamped by the database rather than any one device. Returns the
-- database's now() so the host can correct for its own clock skew.
create or replace function public.team_battle_start_question(
  p_session_id uuid,
  p_question_index integer
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if not exists (
    select 1 from public.game_sessions gs
    where gs.id = p_session_id
      and gs.teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  ) then
    raise exception 'Not authorized to modify this session';
  end if;

  update public.game_sessions
  set status = 'question',
      current_question_index = p_question_index,
      question_started_at = v_now,
      paused_at = null,
      paused_seconds = 0,
      time_extension_seconds = 0
  where id = p_session_id;

  return v_now;
end;
$$;

-- Pauses or resumes the current question. Pausing stamps paused_at;
-- resuming adds the paused stretch to paused_seconds, so the server-side
-- time-left calculation skips it. Each branch only fires from the matching
-- status, so a double-click can't double-count a pause.
create or replace function public.team_battle_set_paused(
  p_session_id uuid,
  p_paused boolean
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if not exists (
    select 1 from public.game_sessions gs
    where gs.id = p_session_id
      and gs.teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  ) then
    raise exception 'Not authorized to modify this session';
  end if;

  if p_paused then
    update public.game_sessions
    set status = 'paused',
        paused_at = v_now
    where id = p_session_id and status = 'question';
  else
    update public.game_sessions
    set status = 'question',
        paused_seconds = paused_seconds + coalesce(extract(epoch from (v_now - paused_at)), 0),
        paused_at = null
    where id = p_session_id and status = 'paused';
  end if;

  return v_now;
end;
$$;

grant execute on function public.team_battle_start_question(uuid, integer) to authenticated;
grant execute on function public.team_battle_set_paused(uuid, boolean) to authenticated;
