-- 0020_team_battle.sql added a public (anon-key) SELECT policy on
-- game_sessions and game_participants so students' browsers (which have no
-- auth.uid()) can receive Realtime updates during a live round, but missed
-- adding the equivalent policy on teams — leaving the live team leaderboard
-- unable to update in real time for anyone but the authenticated teacher.
-- Confirmed via direct testing: an anon-key client could not see existing
-- team rows at all, and Realtime's postgres_changes correctly (silently)
-- withheld team score updates as a result, since it respects the same RLS.

create policy "teams_select_all" on public.teams
  for select using (true);
