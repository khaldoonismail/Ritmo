-- Category tags for games (e.g. "theory", "instrument-id", "scales",
-- "rhythm", "ear-training", "dynamics"), so the Community Games list in
-- the Games Library can be filtered by category. The allowed set of tags
-- lives in application code (lib/gameTags.ts), same pattern as the cover
-- icon gallery in lib/gameCover.ts — kept as a plain text[] here rather
-- than a Postgres enum so the vocabulary can grow without a migration.

alter table public.games add column if not exists tags text[] not null default '{}';

-- Lets Community Games be filtered/searched by tag efficiently.
create index if not exists games_tags_idx on public.games using gin (tags);
