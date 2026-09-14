-- Team Battle mode: real live multi-device sessions with pooled team
-- scoring. Builds on the dormant game_sessions/game_participants/game_answers
-- schema from 0009_games_schema.sql (created but never wired up).
--
-- Individual mode (the existing single-device "Play Demo") is untouched by
-- this migration and keeps working exactly as before — it never reads or
-- writes any of these tables.

alter table public.game_sessions
  add column if not exists play_mode text not null default 'individual'
    check (play_mode in ('individual', 'team_battle')),
  add column if not exists class_id uuid references public.classes (id) on delete set null,
  add column if not exists settings jsonb not null default '{}'::jsonb;

-- A live PIN must be unambiguous while a session is still joinable/running;
-- it's fine for a finished session's PIN to be reused later.
create unique index if not exists game_sessions_active_pin_idx
  on public.game_sessions (pin)
  where status <> 'final';

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  name text not null,
  color text not null,
  score integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.game_participants
  add column if not exists team_id uuid references public.teams (id) on delete set null,
  -- Distinguishes a teacher's pre-assignment (before the student has
  -- actually logged in and joined) from a real join. joined_at keeps its
  -- existing not-null/default-now behavior for both cases.
  add column if not exists join_status text not null default 'pending'
    check (join_status in ('pending', 'joined'));

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.teams enable row level security;

-- teams: full CRUD for the teacher who owns the parent session.
create policy "teams_select_own" on public.teams
  for select using (
    session_id in (
      select gs.id from public.game_sessions gs
      where gs.teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
    )
  );

create policy "teams_insert_own" on public.teams
  for insert with check (
    session_id in (
      select gs.id from public.game_sessions gs
      where gs.teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
    )
  );

create policy "teams_update_own" on public.teams
  for update using (
    session_id in (
      select gs.id from public.game_sessions gs
      where gs.teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
    )
  );

create policy "teams_delete_own" on public.teams
  for delete using (
    session_id in (
      select gs.id from public.game_sessions gs
      where gs.teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
    )
  );

-- Students authenticate with a signed JWT cookie, not Supabase Auth, so
-- their browser has no auth.uid() for the owner-scoped policies above to
-- key off. A live Team Battle round needs their (anon-key) browser to
-- receive Realtime updates for session status, team scores, and the roster
-- — none of which is sensitive (no correct answers, no PINs beyond the
-- session row itself, which is only reachable by a random uuid a student
-- already holds after joining). So reads are opened up entirely; every
-- write from a student still goes through a service-role API route
-- (app/api/student/session/*), exactly like the rest of the student flow.
create policy "game_sessions_select_all" on public.game_sessions
  for select using (true);

create policy "game_participants_select_all" on public.game_participants
  for select using (true);

-- Pre-assigning students to teams before the session starts is a teacher
-- action (Team Setup screen), done from their own authenticated browser
-- client — same pattern as every other teacher-facing write in the app.
create policy "game_participants_insert_own" on public.game_participants
  for insert with check (
    session_id in (
      select gs.id from public.game_sessions gs
      where gs.teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
    )
  );

create policy "game_participants_update_own" on public.game_participants
  for update using (
    session_id in (
      select gs.id from public.game_sessions gs
      where gs.teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.game_sessions;
alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.game_participants;

-- ---------------------------------------------------------------------------
-- Scoring
-- ---------------------------------------------------------------------------

-- Atomically pools a correct answer's points onto both the team total and
-- the individual participant's own score (the latter powers "top scorer per
-- team" on the final screen). Called from the service-role answer route
-- rather than a client read-modify-write, so concurrent teammates answering
-- at the same instant can't race and drop points.
create or replace function public.award_team_battle_points(
  p_team_id uuid,
  p_participant_id uuid,
  p_points integer
) returns void
language sql
security definer
set search_path = public
as $$
  update public.teams set score = score + p_points where id = p_team_id;
  update public.game_participants set score = score + p_points where id = p_participant_id;
$$;
