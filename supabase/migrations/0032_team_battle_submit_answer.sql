-- Team Battle: grade and save a student's answer in ONE database call.
--
-- The answer route (app/api/student/session/[sessionId]/answer/route.ts)
-- used to make 5-7 calls one after another: read the session, read the
-- participant, read the questions (session_questions, else the game's own),
-- insert the answer, award the points (award_team_battle_points, 0020) and
-- try the auto-advance reveal (team_battle_reveal_internal, 0026). From a
-- server far from the database each call is a full round trip, so an
-- answer took ~5 s. This function does all of it inside the database, so
-- the route makes a single call wherever it runs.
--
-- Same rules as the route had (lib/teamBattleTiming.ts, lib/scoring.ts):
--   * the session must be on this question (status 'question');
--   * the student must be a participant with a team;
--   * correctIndex comes from the session's generated questions, else the
--     game's own questions; the browser is never trusted for it;
--   * speed is measured on the server-anchored question clock
--     (question_started_at, paused_at, paused_seconds, extra time); with the
--     timer on, an answer more than 2 s after time is up is rejected (the
--     late-answer grace, LATE_ANSWER_GRACE_SECONDS). Sessions from before
--     0024 (no question_started_at) keep the client-reported time left;
--   * points: wrong 0; timer off 1000; else 500 + 500 x (time left / limit),
--     time left clamped to [0, limit], limit = time limit + extra time;
--   * one answer per student per question (the existing unique constraint);
--   * the points go to the team and the participant atomically, and with
--     auto-advance on the last answer in moves everyone to the reveal.
-- The clock is now the database's own (now()), the same clock
-- question_started_at is stamped with.
--
-- Returns jsonb: { "status": 200, "correct": bool, "points": int } or
-- { "status": 404 | 409 | 403, "error": "..." } (the route passes these on
-- unchanged).
--
-- Additive only: one new function, callable by the service role only (the
-- student's identity comes from the route's signed session cookie, so the
-- function must never be callable from a browser). No table, column,
-- policy or existing function changes; the old route keeps working until
-- the new code is deployed.

create or replace function public.team_battle_submit_answer(
  p_session_id uuid,
  p_student_id uuid,
  p_question_index integer,
  p_selected_index integer,
  p_client_time_left numeric
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.game_sessions%rowtype;
  v_participant_id uuid;
  v_team_id uuid;
  v_questions jsonb;
  v_question jsonb;
  v_correct boolean;
  v_timer boolean;
  v_limit numeric;
  v_total numeric;
  v_left numeric;
  v_points integer;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if not found then
    return jsonb_build_object('status', 404, 'error', 'Game not found');
  end if;
  if v_session.status <> 'question' or p_question_index is distinct from v_session.current_question_index then
    return jsonb_build_object('status', 409, 'error', 'This question is no longer active');
  end if;

  select gp.id, gp.team_id into v_participant_id, v_team_id
  from public.game_participants gp
  where gp.session_id = v_session.id and gp.student_id = p_student_id;
  if v_participant_id is null or v_team_id is null then
    return jsonb_build_object('status', 403, 'error', 'You''re not part of this game');
  end if;

  -- The session's generated questions (shared Note Reading game), else the
  -- game's own.
  select sq.questions into v_questions from public.session_questions sq where sq.session_id = v_session.id;
  if v_questions is null or jsonb_typeof(v_questions) <> 'array' then
    select g.questions into v_questions from public.games g where g.id = v_session.game_id;
  end if;
  if v_questions is null or jsonb_typeof(v_questions) <> 'array' or p_question_index < 0 then
    return jsonb_build_object('status', 404, 'error', 'No question available');
  end if;
  v_question := v_questions -> p_question_index;
  if v_question is null then
    return jsonb_build_object('status', 404, 'error', 'No question available');
  end if;

  v_correct := p_selected_index is not null
    and jsonb_typeof(v_question -> 'correctIndex') = 'number'
    and p_selected_index = (v_question ->> 'correctIndex')::numeric;
  v_timer := coalesce((v_session.settings ->> 'timerEnabled')::boolean, true);
  v_limit := coalesce((v_session.settings ->> 'timeLimitSeconds')::numeric, 20);
  v_total := v_limit + coalesce(v_session.time_extension_seconds, 0);

  if v_session.question_started_at is not null then
    v_left := v_total - (
      extract(epoch from (coalesce(v_session.paused_at, now()) - v_session.question_started_at))
      - coalesce(v_session.paused_seconds, 0)
    );
    if v_timer and v_left < -2 then
      return jsonb_build_object('status', 409, 'error', 'Time''s up for this question');
    end if;
  else
    v_left := coalesce(p_client_time_left, 0);
  end if;

  if not v_correct then
    v_points := 0;
  elsif not v_timer then
    v_points := 1000;
  else
    v_points := round(500 + 500 * (greatest(0, least(v_left, v_total)) / v_total));
  end if;

  begin
    insert into public.game_answers (session_id, participant_id, question_index, selected_index, is_correct, points_earned)
    values (v_session.id, v_participant_id, p_question_index, p_selected_index, v_correct, v_points);
  exception when unique_violation then
    return jsonb_build_object('status', 409, 'error', 'You already answered this question');
  end;

  if v_points > 0 then
    perform public.award_team_battle_points(v_team_id, v_participant_id, v_points);
  end if;

  -- With auto-advance on, the last answer in moves everyone to the reveal
  -- (the function re-checks everything itself).
  if coalesce((v_session.settings ->> 'autoAdvance')::boolean, false) then
    perform public.team_battle_reveal_internal(v_session.id, p_question_index, 'all_answered');
  end if;

  return jsonb_build_object('status', 200, 'correct', v_correct, 'points', v_points);
end;
$$;

revoke execute on function public.team_battle_submit_answer(uuid, uuid, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.team_battle_submit_answer(uuid, uuid, integer, integer, numeric) to service_role;
