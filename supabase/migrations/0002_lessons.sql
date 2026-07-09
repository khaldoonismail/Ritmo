-- Ritmo schema: lessons library, with fork/copy support.
-- Run this once in the Supabase SQL Editor after 0001_init.sql.

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  title text not null,
  blocks jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  usage_count integer not null default 0,
  forked_from uuid references public.lessons (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reuses the same trigger function defined in 0001_init.sql; re-created here
-- with `or replace` so this migration is runnable on its own too.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_lessons_updated_at on public.lessons;
create trigger set_lessons_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

alter table public.lessons enable row level security;

-- Any teacher can browse the public library plus their own private lessons.
create policy "lessons_select_own_or_public" on public.lessons
  for select using (
    is_public = true
    or teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

create policy "lessons_insert_own" on public.lessons
  for insert with check (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

-- Only the owner can edit or delete a lesson, whether it's original or a
-- fork of someone else's — forking makes an independent copy you own.
create policy "lessons_update_own" on public.lessons
  for update using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  ) with check (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

create policy "lessons_delete_own" on public.lessons
  for delete using (
    teacher_id in (select id from public.teachers where auth_user_id = auth.uid())
  );

-- Attribution needs the public lesson owner's name. The base "teachers_select_own"
-- policy (from 0001) only lets a teacher see their own row, so add a second
-- policy exposing teachers who own at least one public lesson.
create policy "teachers_select_public_lesson_owners" on public.teachers
  for select using (
    id in (select teacher_id from public.lessons where is_public = true)
  );

-- usage_count increments whenever a lesson is directly assigned to a class,
-- or forked/copied — including by teachers who don't own it, which the
-- ordinary RLS update policy above would otherwise block. This function
-- runs with elevated privileges but only ever does one narrow thing:
-- bump the counter for a specific lesson id by 1.
create or replace function public.increment_lesson_usage(lesson_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.lessons set usage_count = usage_count + 1 where id = lesson_id;
end;
$$;

grant execute on function public.increment_lesson_usage(uuid) to authenticated;
