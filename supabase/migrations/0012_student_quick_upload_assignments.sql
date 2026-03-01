-- 0012: allow students to create constrained "Quick Upload" assignments
-- so ad-hoc worksheet submissions can still be tracked by subject/topic.

drop policy if exists assignments_insert_student_quick_upload on public.assignments;
create policy assignments_insert_student_quick_upload
on public.assignments for insert
to authenticated
with check (
  student_id = auth.uid()
  and status = 'submitted'
  and title like 'Quick Upload:%'
  and (
    exists (
      select 1
      from public.assignments a
      where a.student_id = auth.uid()
        and a.tutor_id = assignments.tutor_id
    )
    or exists (
      select 1
      from public.student_progress_reviews spr
      where spr.student_id = auth.uid()
        and spr.tutor_id = assignments.tutor_id
    )
  )
);
