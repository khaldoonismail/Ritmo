-- Adds a quick-select performance rating alongside the existing free-form
-- numeric score on student_progress. Purely additive — score is untouched,
-- teachers can use either or both.
--
-- No new RLS policy needed: student_progress_update_own (0006) already
-- authorizes UPDATE on the whole row for a teacher's own students, which
-- covers this new column automatically.

create type public.performance_rating as enum ('excellent', 'very_good', 'good', 'needs_practice');

alter table public.student_progress
  add column if not exists performance_rating public.performance_rating;
