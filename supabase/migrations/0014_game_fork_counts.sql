-- "Copied by N teachers" counter for the Games Library. forked_from
-- (0010_public_games.sql) already records lineage, but a forked copy is
-- private (is_public = false) to its new owner, so an ordinary teacher
-- can't SELECT-count other teachers' copies under games_select_own_or_public.
-- This mirrors increment_game_usage: a security-definer function that
-- counts across all teachers regardless of RLS, taking a batch of game
-- ids so the Games Library can fetch counts for a whole list in one call.
-- Games with zero forks simply have no row in the result; callers default
-- missing ids to 0.

create or replace function public.game_fork_counts(game_ids uuid[])
returns table (game_id uuid, fork_count integer)
language sql
security definer
set search_path = public
stable
as $$
  select forked_from as game_id, count(*)::integer as fork_count
  from public.games
  where forked_from = any(game_ids)
  group by forked_from;
$$;

grant execute on function public.game_fork_counts(uuid[]) to authenticated;
