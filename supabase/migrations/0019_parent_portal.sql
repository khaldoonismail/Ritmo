-- Parent portal: a read-only view of one student's progress, reachable via
-- an unguessable link (/parent/<token>) rather than a login — no parent
-- accounts, no passwords, matching the app's existing lightweight
-- capability-link security model (join_code + PIN for students). The token
-- is a random uuid (122 bits), same order of security as a session id.
--
-- Deliberately NOT exposed through RLS to the anon/authenticated key: the
-- parent page is a server component reading via the service-role client
-- (same pattern as every student-facing route), since "know the token" is
-- the only credential a parent has.

alter table public.students
  add column if not exists parent_token uuid not null default gen_random_uuid();

create unique index if not exists students_parent_token_idx on public.students (parent_token);
