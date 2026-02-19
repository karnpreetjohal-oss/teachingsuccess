-- Portal + roles + assignments + submissions + parent access + curriculum + private storage policies
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- =========================
-- Profiles + role handling
-- =========================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'student' check (role in ('student','tutor','parent')),
  year_group text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student','tutor','parent'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, year_group)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case
      when coalesce(new.raw_user_meta_data->>'signup_role','student') = 'parent' then 'parent'
      when coalesce(new.raw_user_meta_data->>'signup_role','student') = 'tutor' then 'tutor'
      else 'student'
    end,
    nullif(new.raw_user_meta_data->>'year_group','')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    year_group = coalesce(public.profiles.year_group, excluded.year_group);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- helper role checks
create or replace function public.is_tutor()
returns boolean
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'user_metadata' ->> 'signup_role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    ''
  ) = 'tutor';
$$;

create or replace function public.is_parent()
returns boolean
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'user_metadata' ->> 'signup_role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    ''
  ) = 'parent';
$$;

-- =========================
-- Core tables
-- =========================

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null default 'General',
  title text not null,
  description text,
  due_date date,
  status text not null default 'assigned' check (status in ('assigned','submitted','marked','completed')),
  resource_title text,
  resource_url text,
  file_path text,
  file_url text,
  year_group int,
  exam_board text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.assignments
  drop constraint if exists assignments_status_check;

alter table public.assignments
  add constraint assignments_status_check
  check (status in ('assigned','submitted','marked','completed'));

alter table public.assignments
  add column if not exists resource_title text,
  add column if not exists resource_url text,
  add column if not exists file_path text,
  add column if not exists file_url text,
  add column if not exists year_group int,
  add column if not exists exam_board text;

create index if not exists idx_assignments_tutor on public.assignments(tutor_id);
create index if not exists idx_assignments_student on public.assignments(student_id);
create index if not exists idx_assignments_status on public.assignments(status);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  notes text,
  submitted_at timestamptz not null default now(),
  mark numeric(5,2),
  grade text,
  tutor_feedback text,
  graded_at timestamptz,
  unique (assignment_id, student_id)
);

alter table public.submissions
  add column if not exists mark numeric(5,2),
  add column if not exists grade text,
  add column if not exists tutor_feedback text,
  add column if not exists graded_at timestamptz;

alter table public.submissions
  drop constraint if exists submissions_mark_range;

alter table public.submissions
  add constraint submissions_mark_range
  check (mark is null or (mark >= 0 and mark <= 100));

create index if not exists idx_submissions_assignment on public.submissions(assignment_id);
create index if not exists idx_submissions_student on public.submissions(student_id);

create table if not exists public.parent_student_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

create index if not exists idx_parent_links_parent on public.parent_student_links(parent_id);
create index if not exists idx_parent_links_student on public.parent_student_links(student_id);

-- =========================
-- Curriculum MVP
-- =========================

create table if not exists public.curriculum_objectives (
  objective_id uuid primary key default gen_random_uuid(),
  year_group int not null,
  subject text not null,
  strand text,
  exam_board text,
  objective_text text not null
);

create table if not exists public.assignment_objectives (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  objective_id uuid not null references public.curriculum_objectives(objective_id) on delete cascade,
  primary key (assignment_id, objective_id)
);

create table if not exists public.objective_mastery (
  student_id uuid not null references public.profiles(id) on delete cascade,
  objective_id uuid not null references public.curriculum_objectives(objective_id) on delete cascade,
  rating text not null check (rating in ('secure','developing','not_yet')),
  evidence_assignment_id uuid references public.assignments(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (student_id, objective_id)
);

-- =========================
-- RLS policies
-- =========================

alter table public.profiles enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.parent_student_links enable row level security;
alter table public.curriculum_objectives enable row level security;
alter table public.assignment_objectives enable row level security;
alter table public.objective_mastery enable row level security;

-- profiles

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
on public.profiles for select
using (id = auth.uid());

drop policy if exists profiles_select_tutor_all on public.profiles;
create policy profiles_select_tutor_all
on public.profiles for select
using (public.is_tutor());

drop policy if exists profiles_select_parent_linked on public.profiles;
create policy profiles_select_parent_linked
on public.profiles for select
using (
  exists (
    select 1
    from public.parent_student_links l
    where l.parent_id = auth.uid()
      and l.student_id = profiles.id
  )
);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- assignments

drop policy if exists assignments_select_student on public.assignments;
create policy assignments_select_student
on public.assignments for select
using (student_id = auth.uid());

drop policy if exists assignments_select_tutor on public.assignments;
create policy assignments_select_tutor
on public.assignments for select
using (tutor_id = auth.uid());

drop policy if exists assignments_select_parent_linked on public.assignments;
create policy assignments_select_parent_linked
on public.assignments for select
using (
  exists (
    select 1
    from public.parent_student_links l
    where l.parent_id = auth.uid()
      and l.student_id = assignments.student_id
  )
);

drop policy if exists assignments_insert_tutor_own on public.assignments;
create policy assignments_insert_tutor_own
on public.assignments for insert
with check (public.is_tutor() and tutor_id = auth.uid());

drop policy if exists assignments_update_tutor_own on public.assignments;
create policy assignments_update_tutor_own
on public.assignments for update
using (public.is_tutor() and tutor_id = auth.uid())
with check (public.is_tutor() and tutor_id = auth.uid());

-- submissions

drop policy if exists submissions_select_student_own on public.submissions;
create policy submissions_select_student_own
on public.submissions for select
using (student_id = auth.uid());

drop policy if exists submissions_insert_student_own on public.submissions;
create policy submissions_insert_student_own
on public.submissions for insert
with check (student_id = auth.uid());

drop policy if exists submissions_update_student_own on public.submissions;
create policy submissions_update_student_own
on public.submissions for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop policy if exists submissions_select_tutor_owned_assignment on public.submissions;
create policy submissions_select_tutor_owned_assignment
on public.submissions for select
using (
  exists (
    select 1
    from public.assignments a
    where a.id = submissions.assignment_id
      and a.tutor_id = auth.uid()
  )
);

drop policy if exists submissions_update_tutor_owned_assignment on public.submissions;
create policy submissions_update_tutor_owned_assignment
on public.submissions for update
using (
  exists (
    select 1
    from public.assignments a
    where a.id = submissions.assignment_id
      and a.tutor_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    where a.id = submissions.assignment_id
      and a.tutor_id = auth.uid()
  )
);

drop policy if exists submissions_select_parent_linked on public.submissions;
create policy submissions_select_parent_linked
on public.submissions for select
using (
  exists (
    select 1
    from public.assignments a
    join public.parent_student_links l on l.student_id = a.student_id
    where a.id = submissions.assignment_id
      and l.parent_id = auth.uid()
  )
);

-- parent links

drop policy if exists parent_links_select_own on public.parent_student_links;
create policy parent_links_select_own
on public.parent_student_links for select
using (parent_id = auth.uid());

drop policy if exists parent_links_select_tutor on public.parent_student_links;
create policy parent_links_select_tutor
on public.parent_student_links for select
using (public.is_tutor());

drop policy if exists parent_links_insert_tutor on public.parent_student_links;
create policy parent_links_insert_tutor
on public.parent_student_links for insert
with check (public.is_tutor());

drop policy if exists parent_links_delete_tutor on public.parent_student_links;
create policy parent_links_delete_tutor
on public.parent_student_links for delete
using (public.is_tutor());

-- curriculum MVP policies

drop policy if exists curriculum_objectives_select_all_auth on public.curriculum_objectives;
create policy curriculum_objectives_select_all_auth
on public.curriculum_objectives for select
using (auth.uid() is not null);

drop policy if exists curriculum_objectives_write_tutor on public.curriculum_objectives;
create policy curriculum_objectives_write_tutor
on public.curriculum_objectives for all
using (public.is_tutor())
with check (public.is_tutor());

drop policy if exists assignment_objectives_select_visible_assignments on public.assignment_objectives;
create policy assignment_objectives_select_visible_assignments
on public.assignment_objectives for select
using (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_objectives.assignment_id
      and (
        a.student_id = auth.uid()
        or a.tutor_id = auth.uid()
        or exists (
          select 1
          from public.parent_student_links l
          where l.parent_id = auth.uid()
            and l.student_id = a.student_id
        )
      )
  )
);

drop policy if exists assignment_objectives_write_tutor_owned on public.assignment_objectives;
create policy assignment_objectives_write_tutor_owned
on public.assignment_objectives for all
using (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_objectives.assignment_id
      and a.tutor_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_objectives.assignment_id
      and a.tutor_id = auth.uid()
  )
);

drop policy if exists objective_mastery_select_student_tutor_parent on public.objective_mastery;
create policy objective_mastery_select_student_tutor_parent
on public.objective_mastery for select
using (
  student_id = auth.uid()
  or public.is_tutor()
  or exists (
    select 1
    from public.parent_student_links l
    where l.parent_id = auth.uid()
      and l.student_id = objective_mastery.student_id
  )
);

drop policy if exists objective_mastery_write_tutor on public.objective_mastery;
create policy objective_mastery_write_tutor
on public.objective_mastery for all
using (public.is_tutor())
with check (public.is_tutor());

-- =========================
-- Storage: private files
-- =========================

insert into storage.buckets (id, name, public)
values ('assignment-files', 'assignment-files', false)
on conflict (id) do update set public = false;

alter table storage.objects enable row level security;

-- Students can upload only to own root folder: <student_id>/...
drop policy if exists assignment_files_insert_student_own_folder on storage.objects;
create policy assignment_files_insert_student_own_folder
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'assignment-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Students can read only from own root folder (for their assignment files)
drop policy if exists assignment_files_select_student_own_folder on storage.objects;
create policy assignment_files_select_student_own_folder
on storage.objects for select
to authenticated
using (
  bucket_id = 'assignment-files'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Tutors can read if folder segments map to assignment they own
drop policy if exists assignment_files_select_tutor_owned_assignment on storage.objects;
create policy assignment_files_select_tutor_owned_assignment
on storage.objects for select
to authenticated
using (
  bucket_id = 'assignment-files'
  and exists (
    select 1
    from public.assignments a
    where a.tutor_id = auth.uid()
      and a.student_id::text = (storage.foldername(name))[1]
      and a.id::text = (storage.foldername(name))[2]
  )
);

-- Parents can read for linked students
drop policy if exists assignment_files_select_parent_linked_student on storage.objects;
create policy assignment_files_select_parent_linked_student
on storage.objects for select
to authenticated
using (
  bucket_id = 'assignment-files'
  and exists (
    select 1
    from public.parent_student_links l
    where l.parent_id = auth.uid()
      and l.student_id::text = (storage.foldername(name))[1]
  )
);
