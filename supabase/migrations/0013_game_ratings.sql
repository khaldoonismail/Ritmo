-- Star ratings (1-5) teachers can leave on a community game, so the Games
-- Library can show an average + count next to each public game. A teacher
-- can rate any public game they don't own, once (unique per game+teacher;
-- re-rating is an update, done client-side via upsert). Mirrors the
-- ownership-check style of 0009/0010's policies.

create table if not exists public.game_ratings (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, teacher_id)
);

create index if not exists game_ratings_game_id_idx on public.game_ratings (game_id);

alter table public.game_ratings enable row level security;

-- Anyone can read ratings for a game they can already see (public, or
-- their own) — same visibility rule as games_select_own_or_public.
drop policy if exists "game_ratings_select_visible" on public.game_ratings;
create policy "game_ratings_select_visible" on public.game_ratings
  for select using (
    game_id in (
      select id from public.games
      where is_public = true
      or teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
    )
  );

-- A teacher may only rate public games they don't own themselves.
drop policy if exists "game_ratings_insert_own" on public.game_ratings;
create policy "game_ratings_insert_own" on public.game_ratings
  for insert with check (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
    and game_id in (
      select id from public.games
      where is_public = true
      and teacher_id not in (select id from public.teachers where auth_user_id = auth.uid())
    )
  );

-- A teacher can change or remove only their own rating.
drop policy if exists "game_ratings_update_own" on public.game_ratings;
create policy "game_ratings_update_own" on public.game_ratings
  for update using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  ) with check (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

drop policy if exists "game_ratings_delete_own" on public.game_ratings;
create policy "game_ratings_delete_own" on public.game_ratings
  for delete using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );
