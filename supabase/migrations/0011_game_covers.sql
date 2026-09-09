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
-- reason to gate reads. The bucket itself is created separately via the
-- Storage API (not SQL), same note as 0007_student_avatars.sql.

alter table public.games add column if not exists cover_image text;

create policy "teacher_insert_own_game_covers"
on storage.objects for insert
with check (
  bucket_id = 'game-covers'
  and (storage.foldername(name))[1]::uuid in (
    select id from public.teachers where auth_user_id = auth.uid()
  )
);

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

create policy "teacher_delete_own_game_covers"
on storage.objects for delete
using (
  bucket_id = 'game-covers'
  and (storage.foldername(name))[1]::uuid in (
    select id from public.teachers where auth_user_id = auth.uid()
  )
);
