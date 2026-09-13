-- Lightweight one-way notes from a teacher to either a whole class or a
-- single student — not a chat (no replies, no read receipts), matching the
-- "simple, not a full chat" scope. Students read these via a service-role
-- API route (same pattern as every other student-facing read) since they
-- have no auth.uid() for RLS to key off.

create table if not exists public.teacher_notes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade, -- null = whole class
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_notes_class_id_idx on public.teacher_notes (class_id);
create index if not exists teacher_notes_student_id_idx on public.teacher_notes (student_id);

alter table public.teacher_notes enable row level security;

drop policy if exists "teacher_notes_select_own" on public.teacher_notes;
create policy "teacher_notes_select_own" on public.teacher_notes
  for select using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

drop policy if exists "teacher_notes_insert_own" on public.teacher_notes;
create policy "teacher_notes_insert_own" on public.teacher_notes
  for insert with check (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

drop policy if exists "teacher_notes_delete_own" on public.teacher_notes;
create policy "teacher_notes_delete_own" on public.teacher_notes
  for delete using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );
