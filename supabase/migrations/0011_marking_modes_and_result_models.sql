-- 0011: assignment marking modes + structured auto/tutor assessment payloads

alter table public.assignments
  add column if not exists marking_mode text not null default 'generic_completion_review';

alter table public.assignments
  drop constraint if exists assignments_marking_mode_check;

alter table public.assignments
  add constraint assignments_marking_mode_check
  check (marking_mode in (
    'maths_question_marking',
    'english_writing_feedback',
    'gcse_english_ao',
    'science_short_answer',
    'generic_completion_review'
  ));

alter table public.submissions
  add column if not exists auto_result jsonb,
  add column if not exists auto_confidence numeric(5,2),
  add column if not exists tutor_result jsonb;

alter table public.submissions
  drop constraint if exists submissions_auto_confidence_range;

alter table public.submissions
  add constraint submissions_auto_confidence_range
  check (auto_confidence is null or (auto_confidence >= 0 and auto_confidence <= 100));

create index if not exists idx_assignments_marking_mode on public.assignments(marking_mode);
