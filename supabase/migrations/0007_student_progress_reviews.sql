-- Tutor progress reviews (predicted grade + strengths/support plan)
create table if not exists public.student_progress_reviews (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  period_label text,
  predicted_grade text not null,
  confidence_pct numeric(5,2) check (confidence_pct is null or (confidence_pct >= 0 and confidence_pct <= 100)),
  doing_well text,
  needs_help text,
  action_plan text,
  created_at timestamptz not null default now()
);

create index if not exists spr_tutor_idx on public.student_progress_reviews(tutor_id, created_at desc);
create index if not exists spr_student_idx on public.student_progress_reviews(student_id, created_at desc);

alter table public.student_progress_reviews enable row level security;

-- Tutor can create/read/update reviews they own
drop policy if exists "spr_tutor_select_own" on public.student_progress_reviews;
create policy "spr_tutor_select_own"
on public.student_progress_reviews
for select
using (tutor_id = auth.uid());

drop policy if exists "spr_tutor_insert_own" on public.student_progress_reviews;
create policy "spr_tutor_insert_own"
on public.student_progress_reviews
for insert
with check (tutor_id = auth.uid());

drop policy if exists "spr_tutor_update_own" on public.student_progress_reviews;
create policy "spr_tutor_update_own"
on public.student_progress_reviews
for update
using (tutor_id = auth.uid())
with check (tutor_id = auth.uid());

-- Student read-only access to own reviews
drop policy if exists "spr_student_select_own" on public.student_progress_reviews;
create policy "spr_student_select_own"
on public.student_progress_reviews
for select
using (student_id = auth.uid());

-- Parent read-only access for linked students
drop policy if exists "spr_parent_select_linked" on public.student_progress_reviews;
create policy "spr_parent_select_linked"
on public.student_progress_reviews
for select
using (
  exists (
    select 1
    from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = student_progress_reviews.student_id
  )
);
