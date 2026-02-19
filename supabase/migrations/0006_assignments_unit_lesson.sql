-- Link assignments to curriculum units/lessons
alter table public.assignments
  add column if not exists unit_id uuid null references public.curriculum_units(id) on delete set null,
  add column if not exists lesson_id uuid null references public.curriculum_lessons(id) on delete set null;

create index if not exists assignments_unit_id_idx on public.assignments(unit_id);
create index if not exists assignments_lesson_id_idx on public.assignments(lesson_id);
