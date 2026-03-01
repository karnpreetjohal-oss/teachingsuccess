-- Seed curriculum objectives from supabase/seeds/curriculum_seed.json
-- This migration also ensures objective_id supports code IDs like ENG.Y11.AQA...

-- 1) Ensure objective_id columns are text (not uuid)
alter table public.assignment_objectives
  drop constraint if exists assignment_objectives_objective_id_fkey;

alter table public.objective_mastery
  drop constraint if exists objective_mastery_objective_id_fkey;

alter table public.curriculum_objectives
  alter column objective_id type text using objective_id::text;

alter table public.assignment_objectives
  alter column objective_id type text using objective_id::text;

alter table public.objective_mastery
  alter column objective_id type text using objective_id::text;

alter table public.assignment_objectives
  add constraint assignment_objectives_objective_id_fkey
  foreign key (objective_id)
  references public.curriculum_objectives(objective_id)
  on delete cascade;

alter table public.objective_mastery
  add constraint objective_mastery_objective_id_fkey
  foreign key (objective_id)
  references public.curriculum_objectives(objective_id)
  on delete cascade;

-- 2) Upsert seed objectives
with seed(objective_id, year_group, subject, strand, exam_board, objective_text) as (
  values
    ('ENG.Y2.READ.01', 2, 'english', 'reading', null, 'Decode words accurately using phonics and common exception words; read with increasing fluency.'),
    ('MAT.Y2.NUM.01', 2, 'maths', 'number_place_value', null, 'Understand place value to 100; compare and order numbers; use number lines.'),
    ('SCI.Y4.PHY.ELEC.01', 4, 'science', 'electricity', null, 'Construct simple series circuits and identify conductors and insulators.'),
    ('ENG.Y9.WRT.ARG.01', 9, 'english', 'writing_argument', null, 'Write a clear argument using logical paragraphing, evidence, and rhetorical devices appropriate to audience and purpose.'),
    ('MAT.Y10.ALG.QUAD.01', 10, 'maths', 'algebra_quadratics', null, 'Expand, factorise and solve quadratic equations in simple cases; interpret quadratic graphs.'),
    ('ENG.Y11.AQA.LANG.P1.Q2', 11, 'english', 'gcse_language_paper1', 'aqa', 'AQA English Language Paper 1 Q2: analyse how writers use language (methods + effects) with embedded quotations.'),
    ('MAT.Y11.EDEXCEL.EXAM.NP', 11, 'maths', 'gcse_exam_nonnegs', 'edexcel', 'Edexcel GCSE Maths: solve non-routine multi-step problems across topics, showing full reasoning and accuracy under exam conditions.'),
    ('SCI.Y11.OCR.GWY.CHE.C6.01', 11, 'science', 'gcse_chemistry', 'ocr', 'OCR Gateway Chemistry: apply chemical analysis concepts (e.g., tests for gases/ions) and interpret results using scientific reasoning.')
)
insert into public.curriculum_objectives (objective_id, year_group, subject, strand, exam_board, objective_text)
select objective_id, year_group, subject, strand, exam_board, objective_text
from seed
on conflict (objective_id) do update
set
  year_group = excluded.year_group,
  subject = excluded.subject,
  strand = excluded.strand,
  exam_board = excluded.exam_board,
  objective_text = excluded.objective_text;

-- 3) Remove old sample objectives not in this seed list
with seed_ids(objective_id) as (
  values
    ('ENG.Y2.READ.01'),
    ('MAT.Y2.NUM.01'),
    ('SCI.Y4.PHY.ELEC.01'),
    ('ENG.Y9.WRT.ARG.01'),
    ('MAT.Y10.ALG.QUAD.01'),
    ('ENG.Y11.AQA.LANG.P1.Q2'),
    ('MAT.Y11.EDEXCEL.EXAM.NP'),
    ('SCI.Y11.OCR.GWY.CHE.C6.01')
),
remove_ids as (
  select c.objective_id
  from public.curriculum_objectives c
  left join seed_ids s on s.objective_id = c.objective_id
  where s.objective_id is null
)
delete from public.assignment_objectives ao
using remove_ids r
where ao.objective_id = r.objective_id;

with seed_ids(objective_id) as (
  values
    ('ENG.Y2.READ.01'),
    ('MAT.Y2.NUM.01'),
    ('SCI.Y4.PHY.ELEC.01'),
    ('ENG.Y9.WRT.ARG.01'),
    ('MAT.Y10.ALG.QUAD.01'),
    ('ENG.Y11.AQA.LANG.P1.Q2'),
    ('MAT.Y11.EDEXCEL.EXAM.NP'),
    ('SCI.Y11.OCR.GWY.CHE.C6.01')
),
remove_ids as (
  select c.objective_id
  from public.curriculum_objectives c
  left join seed_ids s on s.objective_id = c.objective_id
  where s.objective_id is null
)
delete from public.objective_mastery om
using remove_ids r
where om.objective_id = r.objective_id;

with seed_ids(objective_id) as (
  values
    ('ENG.Y2.READ.01'),
    ('MAT.Y2.NUM.01'),
    ('SCI.Y4.PHY.ELEC.01'),
    ('ENG.Y9.WRT.ARG.01'),
    ('MAT.Y10.ALG.QUAD.01'),
    ('ENG.Y11.AQA.LANG.P1.Q2'),
    ('MAT.Y11.EDEXCEL.EXAM.NP'),
    ('SCI.Y11.OCR.GWY.CHE.C6.01')
)
delete from public.curriculum_objectives c
where not exists (
  select 1
  from seed_ids s
  where s.objective_id = c.objective_id
);
