-- Public/community games library, mirroring the lessons pattern from
-- 0002_lessons.sql + 0003_fix_teachers_lessons_recursion.sql. Lets a
-- teacher publish a game (is_public = true) so every other teacher can see
-- and copy it into their own account, while keeping edit/delete restricted
-- to the owner.

alter table public.games add column if not exists is_public boolean not null default false;
alter table public.games add column if not exists usage_count integer not null default 0;
alter table public.games add column if not exists forked_from uuid references public.games (id) on delete set null;

-- Replace the owner-only SELECT policy with one that also allows public games.
drop policy if exists "games_select_own" on public.games;
create policy "games_select_own_or_public" on public.games
  for select using (
    is_public = true
    or teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

-- insert/update/delete policies from 0009 stay owner-only as-is (forking
-- makes an independent copy you own, same as lessons).

-- Attribution needs the public game owner's name. Uses a security definer
-- function to avoid the teachers <-> games RLS recursion (same fix as
-- 0003 for lessons).
create or replace function public.teacher_ids_with_public_games()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select distinct teacher_id from public.games where is_public = true;
$$;

grant execute on function public.teacher_ids_with_public_games() to authenticated;

drop policy if exists "teachers_select_public_game_owners" on public.teachers;
create policy "teachers_select_public_game_owners" on public.teachers
  for select using (
    id in (select public.teacher_ids_with_public_games())
  );

-- usage_count increments when a game is copied by a teacher who doesn't own
-- it, which the ordinary owner-only update policy would otherwise block.
create or replace function public.increment_game_usage(game_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.games set usage_count = usage_count + 1 where id = game_id;
end;
$$;

grant execute on function public.increment_game_usage(uuid) to authenticated;
