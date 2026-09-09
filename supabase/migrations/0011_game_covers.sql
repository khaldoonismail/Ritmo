-- Lets a teacher attach a cover image (or a token for a picked icon, e.g.
-- "icon:drum") to a game, shown in the Games Library list.
--
-- cover_image stores either:
--   * a public URL into the "game-covers" Storage bucket (uploaded image)
--   * "icon:<key>" for a gallery icon chosen instead of uploading
--   * null, meaning "auto-generate a default from the title" at render time
--
-- Unlike student-avatars, this bucket is public (public: true) — games are
-- already listable/copyable across teachers via the community library, same
-- as the dynamics/instrument question media buckets, so there's no privacy
-- reason to gate reads. storage.buckets is an ordinary table the migration
-- role can insert into directly, so the bucket is created here rather than
-- requiring the separate scripts/create_game_covers_bucket.mjs step
-- (kept as a fallback for setups where this insert isn't permitted).

alter table public.games add column if not exists cover_image text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-covers', 'game-covers', true, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "teacher_insert_own_game_covers" on storage.objects;
create policy "teacher_insert_own_game_covers"
on storage.objects for insert
with check (
  bucket_id = 'game-covers'
  and (storage.foldername(name))[1]::uuid in (
    select id from public.teachers where auth_user_id = auth.uid()
  )
);

drop policy if exists "teacher_update_own_game_covers" on storage.objects;
create policy "teacher_update_own_game_covers"
on storage.objects for update
using (
  bucket_id = 'game-covers'
  and (storage.foldername(name))[1]::uuid in (
    select id from public.teachers where auth_user_id = auth.uid()
  )
)
with check (
  bucket_id = 'game-covers'
  and (storage.foldername(name))[1]::uuid in (
    select id from public.teachers where auth_user_id = auth.uid()
  )
);

drop policy if exists "teacher_delete_own_game_covers" on storage.objects;
create policy "teacher_delete_own_game_covers"
on storage.objects for delete
using (
  bucket_id = 'game-covers'
  and (storage.foldername(name))[1]::uuid in (
    select id from public.teachers where auth_user_id = auth.uid()
  )
);
