-- Curriculum units + lessons
-- Run after 0001_portal.sql

create table if not exists public.curriculum_units (
  id uuid primary key default gen_random_uuid(),
  year_group int not null,
  subject text not null,
  exam_board text,
  course text not null,
  unit_title text not null,
  unit_order int not null,
  created_at timestamptz not null default now()
);

create unique index if not exists curriculum_units_uq
on public.curriculum_units (year_group, subject, exam_board, course, unit_title);

create index if not exists curriculum_units_lookup_idx
on public.curriculum_units (year_group, subject, course, unit_order);

create table if not exists public.curriculum_lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.curriculum_units(id) on delete cascade,
  lesson_title text not null,
  lesson_order int not null,
  created_at timestamptz not null default now()
);

create unique index if not exists curriculum_lessons_unit_order_uq
on public.curriculum_lessons (unit_id, lesson_order);

create index if not exists curriculum_lessons_unit_idx
on public.curriculum_lessons (unit_id, lesson_order);

alter table public.curriculum_units enable row level security;
alter table public.curriculum_lessons enable row level security;

drop policy if exists curriculum_units_select_all_auth on public.curriculum_units;
create policy curriculum_units_select_all_auth
on public.curriculum_units for select
to authenticated
using (true);

drop policy if exists curriculum_units_write_tutor on public.curriculum_units;
create policy curriculum_units_write_tutor
on public.curriculum_units for all
to authenticated
using (public.is_tutor())
with check (public.is_tutor());

drop policy if exists curriculum_lessons_select_all_auth on public.curriculum_lessons;
create policy curriculum_lessons_select_all_auth
on public.curriculum_lessons for select
to authenticated
using (true);

drop policy if exists curriculum_lessons_write_tutor on public.curriculum_lessons;
create policy curriculum_lessons_write_tutor
on public.curriculum_lessons for all
to authenticated
using (public.is_tutor())
with check (public.is_tutor());
