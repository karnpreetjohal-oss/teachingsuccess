-- 0016: optional structured context for quick-upload universal marking

alter table public.assignments
  add column if not exists marking_context jsonb;
