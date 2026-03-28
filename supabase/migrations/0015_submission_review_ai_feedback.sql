alter table public.submissions
  add column if not exists review_ai_comment text,
  add column if not exists review_ai_grade text,
  add column if not exists review_ai_score numeric(5,2),
  add column if not exists review_ai_generated_at timestamptz,
  add column if not exists review_ai_provider text,
  add column if not exists review_ai_payload jsonb;

alter table public.submissions
  drop constraint if exists submissions_review_ai_score_range;

alter table public.submissions
  add constraint submissions_review_ai_score_range
  check (review_ai_score is null or (review_ai_score >= 0 and review_ai_score <= 100));

create index if not exists idx_submissions_review_ai_generated_at
  on public.submissions(review_ai_generated_at desc nulls last);
