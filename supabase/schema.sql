-- Teaching Success portal schema (Supabase)
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- 1) Profiles tied to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role text not null default 'student' check (role in ('tutor','student')),
  year_group text,
  created_at timestamptz not null default now()
);

-- Auto-create profile when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'student'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 2) Assignments managed by tutors
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subject text not null default 'General',
  description text,
  due_date date,
  status text not null default 'assigned' check (status in ('assigned','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_assignments_tutor on public.assignments(tutor_id);
create index if not exists idx_assignments_student on public.assignments(student_id);
create index if not exists idx_assignments_status on public.assignments(status);

-- 3) Student submissions/evidence
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  notes text,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index if not exists idx_submissions_assignment on public.submissions(assignment_id);
create index if not exists idx_submissions_student on public.submissions(student_id);

-- 4) RLS
alter table public.profiles enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

-- Helper check: current user is tutor
create or replace function public.is_tutor()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.role = 'tutor'
  );
$$;

-- Profiles policies
create policy if not exists "profiles_select_own_or_tutor"
on public.profiles
for select
using (id = auth.uid() or public.is_tutor());

create policy if not exists "profiles_insert_own"
on public.profiles
for insert
with check (id = auth.uid());

create policy if not exists "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

-- Assignments policies
create policy if not exists "assignments_select_tutor_or_student"
on public.assignments
for select
using (tutor_id = auth.uid() or student_id = auth.uid());

create policy if not exists "assignments_insert_tutor_only"
on public.assignments
for insert
with check (public.is_tutor() and tutor_id = auth.uid());

create policy if not exists "assignments_update_tutor_or_assigned_student"
on public.assignments
for update
using (tutor_id = auth.uid() or student_id = auth.uid())
with check (tutor_id = auth.uid() or student_id = auth.uid());

create policy if not exists "assignments_delete_tutor_only"
on public.assignments
for delete
using (public.is_tutor() and tutor_id = auth.uid());

-- Submissions policies
create policy if not exists "submissions_select_own_or_assignment_tutor"
on public.submissions
for select
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.assignments a
    where a.id = submissions.assignment_id
      and a.tutor_id = auth.uid()
  )
);

create policy if not exists "submissions_insert_own_for_own_assignment"
on public.submissions
for insert
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.assignments a
    where a.id = submissions.assignment_id
      and a.student_id = auth.uid()
  )
);

create policy if not exists "submissions_update_own"
on public.submissions
for update
using (student_id = auth.uid())
with check (student_id = auth.uid());

-- 5) Promote your tutor account after signup/signin
-- Replace with your tutor email:
-- update public.profiles set role = 'tutor' where email = 'you@example.com';
