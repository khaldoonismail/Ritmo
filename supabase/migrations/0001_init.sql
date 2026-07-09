-- Ritmo schema: teachers, classes, students, assignments, student_progress
-- Run this once in the Supabase SQL Editor (or via `psql`) on a fresh project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null,
  pin char(4) not null check (pin ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);

-- lesson_id is stored as text (matches the app's lesson slugs, e.g. "1")
-- rather than a foreign key, since there is no lessons table yet.
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  lesson_id text not null,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  is_active boolean not null default true
);

create type public.progress_status as enum ('not_started', 'in_progress', 'completed');

create table if not exists public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  status public.progress_status not null default 'not_started',
  score numeric,
  updated_at timestamptz not null default now(),
  unique (student_id, assignment_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_student_progress_updated_at on public.student_progress;
create trigger set_student_progress_updated_at
  before update on public.student_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a teachers row whenever a Supabase Auth user signs up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_teacher()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.teachers (auth_user_id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_teacher();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Teachers authenticate via Supabase Auth, so RLS is keyed off auth.uid().
-- Students authenticate via a custom name + join_code + pin flow (no Supabase
-- Auth identity), so all student-facing reads/writes go through server-side
-- Route Handlers using the service role key, which bypasses RLS entirely.
-- These policies only govern access via the anon/authenticated (teacher) key.

alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.assignments enable row level security;
alter table public.student_progress enable row level security;

-- teachers: a teacher can see and update only their own row
create policy "teachers_select_own" on public.teachers
  for select using (auth_user_id = auth.uid());

create policy "teachers_update_own" on public.teachers
  for update using (auth_user_id = auth.uid());

-- classes: a teacher can fully manage only their own classes
create policy "classes_select_own" on public.classes
  for select using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

create policy "classes_insert_own" on public.classes
  for insert with check (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

create policy "classes_update_own" on public.classes
  for update using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

create policy "classes_delete_own" on public.classes
  for delete using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

-- students: a teacher can manage only students in their own classes
create policy "students_select_own" on public.students
  for select using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

create policy "students_insert_own" on public.students
  for insert with check (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

create policy "students_update_own" on public.students
  for update using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

create policy "students_delete_own" on public.students
  for delete using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

-- assignments: a teacher can manage only assignments in their own classes
create policy "assignments_select_own" on public.assignments
  for select using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

create policy "assignments_insert_own" on public.assignments
  for insert with check (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

create policy "assignments_update_own" on public.assignments
  for update using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

create policy "assignments_delete_own" on public.assignments
  for delete using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

-- student_progress: a teacher can view progress for students in their own
-- classes. Writes happen server-side via the service role key (student flow).
create policy "student_progress_select_own" on public.student_progress
  for select using (
    assignment_id in (
      select a.id from public.assignments a
      join public.classes c on c.id = a.class_id
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );
