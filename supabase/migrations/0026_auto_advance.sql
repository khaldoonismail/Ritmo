-- Team Battle auto-reveal + auto-advance. When a question's time is up (or
-- every joined student has answered) the session moves to 'reveal' by
-- itself; after a reveal countdown (settings.revealSeconds, default 5) it
-- moves to the next question, or to 'final' after the last one. The teacher
-- can pause the countdown or skip it ("Next now").
--
-- All timing uses the database clock, and every transition is a single
-- conditional UPDATE keyed on (status, current_question_index), so two
-- triggers at once (time up + all answered, two host tabs, a reload) can
-- only ever move the session one step: the second UPDATE matches no row.
--
-- Settings live in game_sessions.settings (jsonb), no new column:
--   autoAdvance   boolean  (missing = false, so older sessions keep today's
--                           manual Show Answer / Next behaviour)
--   revealSeconds integer  3 / 5 / 10 (missing = 5)
--
-- Additive except for team_battle_set_paused (0024), which is replaced with
-- the same signature: its question-phase behaviour is unchanged, and it now
-- also pauses/resumes the reveal countdown.

alter table public.game_sessions
  -- When the current reveal began (database clock). Null outside 'reveal'.
  add column if not exists reveal_started_at timestamptz,
  -- Time the current reveal has spent paused (paused_at is reused as the
  -- "paused since" stamp while status = 'reveal').
  add column if not exists reveal_paused_seconds numeric not null default 0;

-- ---------------------------------------------------------------------------
-- Reveal (shared core)
-- ---------------------------------------------------------------------------

-- Moves question p_question_index to 'reveal' if the reason holds:
--   'manual'       teacher clicked Show Answer (always allowed, even paused)
--   'time_up'      auto-advance on, not paused, and the question clock has
--                  run past the limit plus the 2s late-answer grace
--                  (LATE_ANSWER_GRACE_SECONDS in lib/teamBattleTiming.ts)
--   'all_answered' auto-advance on, not paused, and every joined student on
--                  a team has an answer row for this question
-- Returns true only for the call that actually made the change.
-- Not callable from browsers: the teacher wrapper below and the
-- service-role answer route are the only callers.
create or replace function public.team_battle_reveal_internal(
  p_session_id uuid,
  p_question_index integer,
  p_reason text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_rows integer;
begin
  update public.game_sessions gs
  set status = 'reveal',
      reveal_started_at = v_now,
      reveal_paused_seconds = 0,
      -- Fold any open question pause in, then clear it for the reveal.
      paused_seconds = gs.paused_seconds + coalesce(extract(epoch from (v_now - gs.paused_at)), 0),
      paused_at = null
  where gs.id = p_session_id
    and gs.current_question_index = p_question_index
    and gs.status in ('question', 'paused')
    and (
      p_reason = 'manual'
      or (
        p_reason = 'time_up'
        and gs.status = 'question'
        and coalesce((gs.settings ->> 'autoAdvance')::boolean, false)
        and coalesce((gs.settings ->> 'timerEnabled')::boolean, true)
        and gs.question_started_at is not null
        and extract(epoch from (v_now - gs.question_started_at)) - gs.paused_seconds
            >= coalesce((gs.settings ->> 'timeLimitSeconds')::numeric, 20) + gs.time_extension_seconds + 2
      )
      or (
        p_reason = 'all_answered'
        and gs.status = 'question'
        and coalesce((gs.settings ->> 'autoAdvance')::boolean, false)
        and exists (
          select 1 from public.game_participants gp
          where gp.session_id = gs.id and gp.join_status = 'joined' and gp.team_id is not null
        )
        and not exists (
          select 1 from public.game_participants gp
          where gp.session_id = gs.id and gp.join_status = 'joined' and gp.team_id is not null
            and not exists (
              select 1 from public.game_answers ga
              where ga.session_id = gs.id
                and ga.participant_id = gp.id
                and ga.question_index = p_question_index
            )
        )
      )
    );
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke execute on function public.team_battle_reveal_internal(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.team_battle_reveal_internal(uuid, integer, text) to service_role;

-- Teacher-facing reveal: Show Answer ('manual') and the host's auto time-up
-- check ('time_up'). Returns the database's now() for clock-skew correction.
create or replace function public.team_battle_reveal(
  p_session_id uuid,
  p_question_index integer,
  p_reason text
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.game_sessions gs
    where gs.id = p_session_id
      and gs.teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  ) then
    raise exception 'Not authorized to modify this session';
  end if;
  if p_reason not in ('manual', 'time_up') then
    raise exception 'Invalid reveal reason';
  end if;

  perform public.team_battle_reveal_internal(p_session_id, p_question_index, p_reason);
  return now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Advance
-- ---------------------------------------------------------------------------

-- Leaves the reveal of question p_from_index: starts the next question, or
-- ends the session after the last one (which fires the 0025 results
-- trigger). p_skip_countdown = true is Next Question / Next now (allowed
-- any time during the reveal, even paused); false is the auto-advance,
-- which only fires once the reveal countdown is over on the database clock
-- and the reveal isn't paused.
create or replace function public.team_battle_advance(
  p_session_id uuid,
  p_from_index integer,
  p_skip_countdown boolean
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_total integer;
begin
  if not exists (
    select 1 from public.game_sessions gs
    where gs.id = p_session_id
      and gs.teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  ) then
    raise exception 'Not authorized to modify this session';
  end if;

  select jsonb_array_length(g.questions) into v_total
  from public.game_sessions gs
  join public.games g on g.id = gs.game_id
  where gs.id = p_session_id;

  update public.game_sessions gs
  set status = case when p_from_index + 1 >= v_total then 'final'::public.session_status
                    else 'question'::public.session_status end,
      current_question_index = case when p_from_index + 1 >= v_total then gs.current_question_index
                                    else p_from_index + 1 end,
      question_started_at = case when p_from_index + 1 >= v_total then gs.question_started_at else v_now end,
      paused_seconds = case when p_from_index + 1 >= v_total then gs.paused_seconds else 0 end,
      time_extension_seconds = case when p_from_index + 1 >= v_total then gs.time_extension_seconds else 0 end,
      ended_at = case when p_from_index + 1 >= v_total then v_now else gs.ended_at end,
      paused_at = null,
      reveal_started_at = null,
      reveal_paused_seconds = 0
  where gs.id = p_session_id
    and gs.status = 'reveal'
    and gs.current_question_index = p_from_index
    and (
      p_skip_countdown
      or (
        coalesce((gs.settings ->> 'autoAdvance')::boolean, false)
        and gs.paused_at is null
        and gs.reveal_started_at is not null
        and extract(epoch from (v_now - gs.reveal_started_at)) - gs.reveal_paused_seconds
            >= coalesce((gs.settings ->> 'revealSeconds')::numeric, 5)
      )
    );

  return v_now;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pause / resume (replaces 0024's version, same signature)
-- ---------------------------------------------------------------------------

-- Question phase: unchanged ('question' <-> 'paused', paused stretch added
-- to paused_seconds). Reveal phase: status stays 'reveal'; paused_at marks
-- the pause and the stretch is added to reveal_paused_seconds on resume.
-- Each branch only fires from its matching state, so double clicks are
-- harmless.
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

    update public.game_sessions
    set paused_at = v_now
    where id = p_session_id and status = 'reveal' and paused_at is null;
  else
    update public.game_sessions
    set status = 'question',
        paused_seconds = paused_seconds + coalesce(extract(epoch from (v_now - paused_at)), 0),
        paused_at = null
    where id = p_session_id and status = 'paused';

    update public.game_sessions
    set reveal_paused_seconds = reveal_paused_seconds + extract(epoch from (v_now - paused_at)),
        paused_at = null
    where id = p_session_id and status = 'reveal' and paused_at is not null;
  end if;

  return v_now;
end;
$$;

grant execute on function public.team_battle_reveal(uuid, integer, text) to authenticated;
grant execute on function public.team_battle_advance(uuid, integer, boolean) to authenticated;
grant execute on function public.team_battle_set_paused(uuid, boolean) to authenticated;
