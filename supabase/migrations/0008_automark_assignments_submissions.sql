-- Auto-mark support for text submissions
alter table public.assignments
  add column if not exists automark_enabled boolean not null default false,
  add column if not exists automark_keywords text[] not null default '{}',
  add column if not exists automark_target_words integer null;

alter table public.submissions
  add column if not exists auto_mark numeric(5,2) check (auto_mark is null or (auto_mark >= 0 and auto_mark <= 100)),
  add column if not exists auto_grade text,
  add column if not exists auto_feedback text,
  add column if not exists auto_graded_at timestamptz;
