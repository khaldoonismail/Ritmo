-- Lets a teacher attach a photo to each student in their roster.
--
-- avatar_url stores the *path* of the object inside the private
-- "student-avatars" Storage bucket (e.g. "<student_id>/avatar"), not a
-- public URL — the bucket is not public, so viewing requires a signed URL
-- generated on the fly by a teacher who is allowed to see it (see below).
-- The bucket itself is created separately via the Storage API (not SQL),
-- since bucket creation isn't a table-level operation.

alter table public.students
  add column if not exists avatar_url text;

-- storage.objects already has RLS enabled by default on Supabase projects.
-- These policies scope every operation to objects whose first path segment
-- (the student id) belongs to a class owned by the requesting teacher —
-- the same ownership chain used by student_progress_select_own etc.

create policy "teacher_select_own_student_avatars"
on storage.objects for select
using (
  bucket_id = 'student-avatars'
  and (storage.foldername(name))[1]::uuid in (
    select s.id from public.students s
    join public.classes c on c.id = s.class_id
    join public.teachers t on t.id = c.teacher_id
    where t.auth_user_id = auth.uid()
  )
);

create policy "teacher_insert_own_student_avatars"
on storage.objects for insert
with check (
  bucket_id = 'student-avatars'
  and (storage.foldername(name))[1]::uuid in (
    select s.id from public.students s
    join public.classes c on c.id = s.class_id
    join public.teachers t on t.id = c.teacher_id
    where t.auth_user_id = auth.uid()
  )
);

create policy "teacher_update_own_student_avatars"
on storage.objects for update
using (
  bucket_id = 'student-avatars'
  and (storage.foldername(name))[1]::uuid in (
    select s.id from public.students s
    join public.classes c on c.id = s.class_id
    join public.teachers t on t.id = c.teacher_id
    where t.auth_user_id = auth.uid()
  )
)
with check (
  bucket_id = 'student-avatars'
  and (storage.foldername(name))[1]::uuid in (
    select s.id from public.students s
    join public.classes c on c.id = s.class_id
    join public.teachers t on t.id = c.teacher_id
    where t.auth_user_id = auth.uid()
  )
);

create policy "teacher_delete_own_student_avatars"
on storage.objects for delete
using (
  bucket_id = 'student-avatars'
  and (storage.foldername(name))[1]::uuid in (
    select s.id from public.students s
    join public.classes c on c.id = s.class_id
    join public.teachers t on t.id = c.teacher_id
    where t.auth_user_id = auth.uid()
  )
);
