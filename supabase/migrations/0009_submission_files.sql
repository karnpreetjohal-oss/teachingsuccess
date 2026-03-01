-- 0009: photo submission files + OCR status fields + storage policies

create extension if not exists pgcrypto;

create table if not exists public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  file_path text not null,
  ocr_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_submission_files_submission_id on public.submission_files(submission_id);
create index if not exists idx_submission_files_assignment_id on public.submission_files(assignment_id);
create index if not exists idx_submission_files_student_id on public.submission_files(student_id);

alter table public.submission_files enable row level security;

-- Students: create/read only own rows
DROP POLICY IF EXISTS students_insert_own_files ON public.submission_files;
create policy students_insert_own_files
on public.submission_files for insert
to authenticated
with check (student_id = auth.uid());

DROP POLICY IF EXISTS students_select_own_files ON public.submission_files;
create policy students_select_own_files
on public.submission_files for select
to authenticated
using (student_id = auth.uid());

-- Tutors: read rows for assignments they own
DROP POLICY IF EXISTS tutors_select_assignment_files ON public.submission_files;
create policy tutors_select_assignment_files
on public.submission_files for select
to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = submission_files.assignment_id
      and a.tutor_id = auth.uid()
  )
);

-- Parents: read rows for linked students
DROP POLICY IF EXISTS parents_select_linked_student_files ON public.submission_files;
create policy parents_select_linked_student_files
on public.submission_files for select
to authenticated
using (
  exists (
    select 1
    from public.parent_student_links psl
    where psl.parent_id = auth.uid()
      and psl.student_id = submission_files.student_id
  )
);

-- Ensure auto-mark OCR fields exist on submissions
alter table public.submissions
  add column if not exists ocr_processing boolean not null default false,
  add column if not exists auto_mark numeric(5,2),
  add column if not exists auto_grade text,
  add column if not exists auto_feedback text,
  add column if not exists auto_graded_at timestamptz;

-- Private storage bucket for student-submitted photos
insert into storage.buckets (id, name, public)
values ('submission-files', 'submission-files', false)
on conflict (id) do update set public = false;

-- Students upload/read only under root folder: <student_id>/...
DROP POLICY IF EXISTS submission_files_insert_student_own_folder ON storage.objects;
create policy submission_files_insert_student_own_folder
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submission-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS submission_files_select_student_own_folder ON storage.objects;
create policy submission_files_select_student_own_folder
on storage.objects for select
to authenticated
using (
  bucket_id = 'submission-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Tutors can read photos for assignments they own
DROP POLICY IF EXISTS submission_files_select_tutor_owned_assignment ON storage.objects;
create policy submission_files_select_tutor_owned_assignment
on storage.objects for select
to authenticated
using (
  bucket_id = 'submission-files'
  and exists (
    select 1
    from public.assignments a
    where a.tutor_id = auth.uid()
      and a.student_id::text = (storage.foldername(name))[1]
      and a.id::text = (storage.foldername(name))[2]
  )
);

-- Parents can read photos for linked students
DROP POLICY IF EXISTS submission_files_select_parent_linked_student ON storage.objects;
create policy submission_files_select_parent_linked_student
on storage.objects for select
to authenticated
using (
  bucket_id = 'submission-files'
  and exists (
    select 1
    from public.parent_student_links l
    where l.parent_id = auth.uid()
      and l.student_id::text = (storage.foldername(name))[1]
  )
);
