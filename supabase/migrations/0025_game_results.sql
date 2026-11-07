-- One row per student per completed game play — the single source the class
-- leaderboard reads from. Fed from two places:
--   * Team Battle: recorded automatically when a session's status becomes
--     'final' (End Game, the last question, or ending a stale session), by
--     the trigger below — so it also covers sessions ended by older code.
--   * Assigned games: written by app/api/student/submit-game/route.ts.
-- Additive only: a new table, policy, functions and trigger. No existing
-- table's columns or rows are changed; the backfill at the end only inserts
-- into this new table.

create table if not exists public.game_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  source text not null check (source in ('team_battle', 'assignment')),
  session_id uuid references public.game_sessions (id) on delete cascade,
  assignment_id uuid references public.assignments (id) on delete cascade,
  points integer not null default 0,
  correct_count integer not null default 0,
  total_questions integer not null default 0,
  -- 0–100, the leaderboard's primary ranking value.
  accuracy numeric(5, 2) not null default 0,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint game_results_one_source check (
    (source = 'team_battle' and session_id is not null and assignment_id is null)
    or (source = 'assignment' and assignment_id is not null and session_id is null)
  )
);

-- One row per student per session / per assignment; re-recording updates it.
-- Plain (not partial) unique indexes so the submit-game route's upsert can
-- target them; NULLs never collide, so each only constrains its own source.
create unique index if not exists game_results_session_student_idx
  on public.game_results (session_id, student_id);
create unique index if not exists game_results_assignment_student_idx
  on public.game_results (assignment_id, student_id);
create index if not exists game_results_class_game_idx
  on public.game_results (class_id, game_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Teachers can read results for students in their own classes (same
-- ownership chain as student_progress_select_own). There are no insert/
-- update/delete policies: writes only happen through the service role
-- (submit-game route) or the security-definer function below. Students
-- never read this table directly — their leaderboard is built server-side.
alter table public.game_results enable row level security;

create policy "game_results_select_own" on public.game_results
  for select using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Team Battle → game_results
-- ---------------------------------------------------------------------------
-- Records (or re-records) one row per participant who answered at least
-- once. total_questions counts the questions actually played in that
-- session (skipped questions have no answer rows left — see
-- skip_team_battle_question — so they don't count against anyone).
create or replace function public.record_team_battle_results(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  with played as (
    select count(distinct question_index)::int as total
    from public.game_answers
    where session_id = p_session_id
  ),
  per_student as (
    select gp.student_id,
           gp.score,
           count(ga.id) filter (where ga.is_correct)::int as correct
    from public.game_participants gp
    join public.game_answers ga on ga.participant_id = gp.id
    where gp.session_id = p_session_id
    group by gp.student_id, gp.score
  )
  insert into public.game_results (
    student_id, class_id, game_id, source, session_id,
    points, correct_count, total_questions, accuracy, completed_at
  )
  select ps.student_id,
         st.class_id,
         gs.game_id,
         'team_battle',
         gs.id,
         ps.score,
         ps.correct,
         played.total,
         case when played.total > 0 then round(100.0 * ps.correct / played.total, 2) else 0 end,
         coalesce(gs.ended_at, now())
  from per_student ps
  join public.students st on st.id = ps.student_id
  join public.game_sessions gs on gs.id = p_session_id
  cross join played
  where gs.play_mode = 'team_battle'
  on conflict (session_id, student_id)
  do update set
    points = excluded.points,
    correct_count = excluded.correct_count,
    total_questions = excluded.total_questions,
    accuracy = excluded.accuracy,
    completed_at = excluded.completed_at;
$$;

-- Only the trigger and this migration's backfill call it.
revoke execute on function public.record_team_battle_results(uuid) from public, anon, authenticated;

-- Recording results must never block ending a session: any error is caught
-- here (the exception block rolls back only the failed insert) and logged as
-- a warning, and the status change to 'final' still goes through.
create or replace function public.game_sessions_record_results_on_final()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.record_team_battle_results(new.id);
  exception when others then
    raise warning 'record_team_battle_results failed for session %: % (%)', new.id, sqlerrm, sqlstate;
  end;
  return new;
end;
$$;

create trigger game_sessions_record_results_on_final
  after update of status on public.game_sessions
  for each row
  when (new.status = 'final' and old.status is distinct from 'final' and new.play_mode = 'team_battle')
  execute function public.game_sessions_record_results_on_final();

-- ---------------------------------------------------------------------------
-- Backfill (inserts into game_results only)
-- ---------------------------------------------------------------------------
-- Team Battle sessions that already finished.
select public.record_team_battle_results(id)
from public.game_sessions
where status = 'final' and play_mode = 'team_battle';

-- Assigned games already graded. student_progress only kept the 0–100
-- score, so correct_count is derived from it; points use the flat
-- 1000-per-correct-answer rate (no speed bonus outside Team Battle).
insert into public.game_results (
  student_id, class_id, game_id, source, assignment_id,
  points, correct_count, total_questions, accuracy, completed_at
)
select sp.student_id,
       st.class_id,
       a.game_id,
       'assignment',
       a.id,
       round(sp.score / 100.0 * jsonb_array_length(g.questions))::int * 1000,
       round(sp.score / 100.0 * jsonb_array_length(g.questions))::int,
       jsonb_array_length(g.questions),
       sp.score,
       sp.updated_at
from public.student_progress sp
join public.assignments a on a.id = sp.assignment_id
join public.games g on g.id = a.game_id
join public.students st on st.id = sp.student_id
where a.game_id is not null
  and sp.score is not null
on conflict (assignment_id, student_id) do nothing;
