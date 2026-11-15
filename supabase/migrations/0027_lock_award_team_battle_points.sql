-- Locks award_team_battle_points (0020_team_battle.sql) to the server.
--
-- It is security definer and adds any number of points to any team and
-- participant, but 0020 never revoked the default EXECUTE grant, so any
-- browser holding the public anon key (or any signed-in teacher) could
-- call it directly through PostgREST and give a team as many points as it
-- liked. Its only legitimate caller is the answer route
-- (app/api/student/session/[sessionId]/answer/route.ts), which uses the
-- service-role client, so service_role keeps EXECUTE and nothing else does.
--
-- No table, column, row, policy or function body changes; only who may
-- call this one function. Functions that run as their owner (security
-- definer) are unaffected either way.

revoke execute on function public.award_team_battle_points(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.award_team_battle_points(uuid, uuid, integer) to service_role;
