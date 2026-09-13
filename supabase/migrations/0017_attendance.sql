-- Per-session attendance, one row per (class, student, date). Not tied to a
-- specific class_schedule row id (a class might meet ad-hoc or the slot may
-- later be edited/deleted) — just the calendar date the teacher is marking,
-- which is enough to build a history and daily/weekly summaries.

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'absent', 'late')),
  marked_at timestamptz not null default now(),
  unique (class_id, student_id, date)
);

create index if not exists attendance_class_id_idx on public.attendance (class_id);
create index if not exists attendance_student_id_idx on public.attendance (student_id);

alter table public.attendance enable row level security;

drop policy if exists "attendance_select_own" on public.attendance;
create policy "attendance_select_own" on public.attendance
  for select using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

drop policy if exists "attendance_insert_own" on public.attendance;
create policy "attendance_insert_own" on public.attendance
  for insert with check (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

drop policy if exists "attendance_update_own" on public.attendance;
create policy "attendance_update_own" on public.attendance
  for update using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

drop policy if exists "attendance_delete_own" on public.attendance;
create policy "attendance_delete_own" on public.attendance
  for delete using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );
