create or replace function public.student_has_tutor_history(target_student uuid, target_tutor uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assignments a
    where a.student_id = target_student
      and a.tutor_id = target_tutor
  )
  or exists (
    select 1
    from public.student_progress_reviews spr
    where spr.student_id = target_student
      and spr.tutor_id = target_tutor
  )
  or exists (
    select 1
    from public.student_access_codes sac
    where sac.student_id = target_student
      and sac.created_by = target_tutor
  );
$$;

revoke all on function public.student_has_tutor_history(uuid, uuid) from public;
grant execute on function public.student_has_tutor_history(uuid, uuid) to authenticated;

drop policy if exists assignments_insert_student_quick_upload on public.assignments;
create policy assignments_insert_student_quick_upload
on public.assignments for insert
to authenticated
with check (
  student_id = auth.uid()
  and status = 'submitted'
  and title like 'Quick Upload:%'
  and public.student_has_tutor_history(auth.uid(), tutor_id)
);
