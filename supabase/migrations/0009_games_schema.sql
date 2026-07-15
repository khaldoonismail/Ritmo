-- Kahoot-style multiplayer games — Phase 1 (storage only, see spec doc
-- "مواصفات - نظام ألعاب Kahoot-style (Ear Training MVP).md" on Desktop).
--
-- Phase 1 scope is just moving game creation/listing off localStorage onto
-- `games`. The other three tables (game_sessions, game_participants,
-- game_answers) are created now too since they're part of this single
-- migration, but no application code writes to them yet — that's the
-- hosting/join/realtime work of Phase 2+. Their RLS below is deliberately
-- limited to what's decidable today (teacher ownership); student-facing
-- write policies for joining a session / submitting an answer are left for
-- Phase 2, once the actual join mechanism (likely a service-role API route,
-- matching the existing student-auth pattern, since students authenticate
-- via a signed JWT cookie rather than Supabase Auth and so have no
-- auth.uid()) is designed and built.

create type public.session_status as enum ('lobby', 'question', 'reveal', 'leaderboard', 'final');

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  title text not null,
  -- Same Question[] shape the editor already works with (id, mediaType, x,
  -- y, width, height, prompt, mediaContent, options, correctIndex,
  -- timeLimit) — stored as-is, matching how it was serialized to
  -- localStorage before, so the editor needs minimal changes.
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  pin text not null,
  status public.session_status not null default 'lobby',
  current_question_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.game_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  score integer not null default 0,
  joined_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create table if not exists public.game_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  participant_id uuid not null references public.game_participants (id) on delete cascade,
  question_index integer not null,
  selected_index integer,
  is_correct boolean not null default false,
  points_earned integer not null default 0,
  answered_at timestamptz not null default now(),
  unique (session_id, participant_id, question_index)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.games enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_participants enable row level security;
alter table public.game_answers enable row level security;

-- games: full CRUD for the owning teacher only (Phase 1 read/write path)
create policy "games_select_own" on public.games
  for select using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

create policy "games_insert_own" on public.games
  for insert with check (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

create policy "games_update_own" on public.games
  for update using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  ) with check (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

create policy "games_delete_own" on public.games
  for delete using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

-- game_sessions: host (teacher) can fully manage their own sessions. No
-- code creates sessions yet (Phase 2), but the policy is ready for it.
create policy "game_sessions_select_own" on public.game_sessions
  for select using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

create policy "game_sessions_insert_own" on public.game_sessions
  for insert with check (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

create policy "game_sessions_update_own" on public.game_sessions
  for update using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  ) with check (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

create policy "game_sessions_delete_own" on public.game_sessions
  for delete using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

-- game_participants / game_answers: only the read side is decidable now
-- (a teacher viewing their own session's roster/answers). Student-facing
-- INSERT policies are intentionally deferred to Phase 2 — see note above.
create policy "game_participants_select_own" on public.game_participants
  for select using (
    session_id in (
      select gs.id from public.game_sessions gs
      where gs.teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
    )
  );

create policy "game_answers_select_own" on public.game_answers
  for select using (
    session_id in (
      select gs.id from public.game_sessions gs
      where gs.teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
    )
  );
