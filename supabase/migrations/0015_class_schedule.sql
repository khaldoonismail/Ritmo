-- Weekly recurring timetable slots for a class (e.g. "Mondays 3:00-3:45
-- PM"), so a teacher can see a schedule across all their classes and know
-- when each one meets. Recurring by day-of-week rather than dated
-- sessions, matching how a school timetable is normally described; a
-- specific one-off reschedule can just be a second row plus deleting the
-- old one, rather than a whole exceptions system.

create table if not exists public.class_schedule (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null check (end_time > start_time),
  created_at timestamptz not null default now()
);

create index if not exists class_schedule_class_id_idx on public.class_schedule (class_id);

alter table public.class_schedule enable row level security;

drop policy if exists "class_schedule_select_own" on public.class_schedule;
create policy "class_schedule_select_own" on public.class_schedule
  for select using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

drop policy if exists "class_schedule_insert_own" on public.class_schedule;
create policy "class_schedule_insert_own" on public.class_schedule
  for insert with check (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );

drop policy if exists "class_schedule_delete_own" on public.class_schedule;
create policy "class_schedule_delete_own" on public.class_schedule
  for delete using (
    class_id in (
      select c.id from public.classes c
      join public.teachers t on t.id = c.teacher_id
      where t.auth_user_id = auth.uid()
    )
  );
