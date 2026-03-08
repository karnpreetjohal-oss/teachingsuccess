-- 0013: student PIN / access-code login support for mobile-first app

create table if not exists public.student_access_codes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  access_code text not null unique,
  pin_hash text not null,
  is_active boolean not null default true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_access_codes_student on public.student_access_codes(student_id);
create index if not exists idx_student_access_codes_active on public.student_access_codes(is_active, expires_at);

create or replace function public.set_student_access_codes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_student_access_codes_updated_at on public.student_access_codes;
create trigger set_student_access_codes_updated_at
before update on public.student_access_codes
for each row execute function public.set_student_access_codes_updated_at();

alter table public.student_access_codes enable row level security;

drop policy if exists student_access_codes_select_tutor on public.student_access_codes;
create policy student_access_codes_select_tutor
on public.student_access_codes
for select
to authenticated
using (public.is_tutor());

drop policy if exists student_access_codes_insert_tutor on public.student_access_codes;
create policy student_access_codes_insert_tutor
on public.student_access_codes
for insert
to authenticated
with check (
  public.is_tutor()
  and (
    created_by is null
    or created_by = auth.uid()
  )
);

drop policy if exists student_access_codes_update_tutor on public.student_access_codes;
create policy student_access_codes_update_tutor
on public.student_access_codes
for update
to authenticated
using (public.is_tutor())
with check (public.is_tutor());

drop policy if exists student_access_codes_delete_tutor on public.student_access_codes;
create policy student_access_codes_delete_tutor
on public.student_access_codes
for delete
to authenticated
using (public.is_tutor());
