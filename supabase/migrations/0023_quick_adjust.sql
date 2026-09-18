-- Teacher "Quick Adjust" controls for a live Team Battle round: skipping the
-- current question (voiding any points already earned for it) and adding
-- extra time to the current question's timer. Builds on the pause/resume
-- work in 0022_pause_resume.sql — see app/games/play/[id]/TeamBattleHost.tsx
-- and app/student/play/[sessionId]/TeamBattlePlayer.tsx.

-- Cumulative extra seconds granted for the *current* question. The host
-- resets this to 0 every time current_question_index changes (Start Game,
-- Next Question, Skip Question), so it only ever describes the question
-- that's live right now. A plain teacher-owned RLS-protected update is
-- enough here (see game_sessions_update_own in 0009_games_schema.sql) — no
-- RPC needed, since it's one teacher's own browser tab incrementing one
-- row, the same way pause/resume's status flips already work.
alter table public.game_sessions
  add column if not exists time_extension_seconds integer not null default 0;

-- Voids a Team Battle question the teacher chose to skip: reverses every
-- point already pooled onto a team or participant for that question (from
-- game_answers, the same rows award_team_battle_points read when those
-- answers were first submitted) and removes the answer rows so nothing
-- about the skipped question survives — including for students who'd
-- already answered before the skip. Unlike award_team_battle_points (only
-- ever called from the trusted service-role answer route), this is called
-- directly from the teacher's own browser client, so it checks session
-- ownership itself rather than relying on RLS (which this security definer
-- function bypasses on the tables it touches).
create or replace function public.skip_team_battle_question(
  p_session_id uuid,
  p_question_index integer
) returns void
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

  update public.teams t
  set score = t.score - sub.total
  from (
    select gp.team_id, sum(ga.points_earned) as total
    from public.game_answers ga
    join public.game_participants gp on gp.id = ga.participant_id
    where ga.session_id = p_session_id
      and ga.question_index = p_question_index
      and gp.team_id is not null
    group by gp.team_id
  ) sub
  where t.id = sub.team_id;

  update public.game_participants gp
  set score = gp.score - ga.points_earned
  from public.game_answers ga
  where ga.session_id = p_session_id
    and ga.question_index = p_question_index
    and ga.participant_id = gp.id;

  delete from public.game_answers
  where session_id = p_session_id
    and question_index = p_question_index;
end;
$$;

grant execute on function public.skip_team_battle_question(uuid, integer) to authenticated;
