-- 0010: ensure automark columns exist (recovery migration)

alter table public.assignments
  add column if not exists automark_enabled boolean not null default false,
  add column if not exists automark_keywords text[] not null default '{}',
  add column if not exists automark_target_words integer;

alter table public.submissions
  add column if not exists auto_mark numeric(5,2),
  add column if not exists auto_grade text,
  add column if not exists auto_feedback text,
  add column if not exists auto_graded_at timestamptz,
  add column if not exists ocr_processing boolean not null default false;
