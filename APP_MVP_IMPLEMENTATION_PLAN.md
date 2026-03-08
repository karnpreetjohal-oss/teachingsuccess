# Teaching Success App MVP Implementation Plan

This file bridges the proposed Teaching Success app UI spec with the current repo and Supabase setup.

## Current repo shape

- Marketing site is static HTML at repo root:
  - `index.html`
  - `blog.html`
  - `resources.html`
- Existing portal scaffold is plain HTML + one shared JS file:
  - `portal.html` for parent-facing portal
  - `portal-student.html` for student portal
  - `portal-tutor.html` for tutor portal
  - `portal.js` for shared auth, dashboard, upload, review, and Supabase logic
- Supabase backend already exists in-repo:
  - schema and migrations under `supabase/`
  - OCR / automark edge function at `supabase/functions/ocr_mark_submission/index.ts`

## Current auth flow

Current auth is email/password through Supabase Auth.

- `profiles` are auto-created from `auth.users` by `handle_new_user()`.
- Roles are stored in `profiles.role` and routed to:
  - `portal-tutor.html`
  - `portal-student.html`
  - `portal.html`
- Parent access is linked through `parent_student_links`.
- Tutor and parent logins are workable for MVP.

Current limitation:

- There is no PIN-based student login.
- Student access still assumes a full Supabase Auth account.
- There is no lightweight "enter code, open app, upload work" flow yet.

## Current Supabase usage

The repo already contains more than a basic scaffold. Migrations go up to `0012`.

### Core tables already present

- `profiles`
- `assignments`
- `submissions`
- `parent_student_links`
- `curriculum_objectives`
- `assignment_objectives`
- `objective_mastery`
- `curriculum_units`
- `curriculum_lessons`
- `student_progress_reviews`
- `submission_files`

### Current storage buckets

- `assignment-files`
- `submission-files`

### Current backend features already implemented

- Row-level security for tutor, student, and parent access
- Assignment linking to curriculum units and lessons
- Student progress reviews
- OCR processing for uploaded work
- Draft automarking with structured result payloads
- Quick-upload flow for student ad-hoc submissions

## Current homework upload flow

### Standard assignment flow

1. Tutor creates an assignment in the portal.
2. Assignment can include:
   - subject
   - due date
   - description
   - curriculum unit / lesson
   - marking mode
3. Student opens the assignment.
4. Student uploads notes and photos.
5. Photos are stored in `submission-files`.
6. `submission_files` rows are created.
7. `ocr_mark_submission` is invoked.
8. OCR text is extracted and stored.
9. `submissions` is updated with:
   - `auto_mark`
   - `auto_grade`
   - `auto_feedback`
   - `auto_result`
   - `auto_confidence`

### Quick-upload flow

1. Student chooses quick upload.
2. System creates a constrained "Quick Upload" assignment.
3. Student uploads photos against that generated assignment.
4. OCR / automark runs the same way as for normal assignments.

## What already maps well to the app spec

The current backend already supports a meaningful part of the proposed MVP:

- tutor-created assignments
- student submissions
- photo uploads
- OCR and draft AI marking
- parent-to-student linking
- curriculum-linked assignments
- progress reviews for parents and students

This means the new app should reuse the existing Supabase project rather than replace it.

## Missing pieces for the parent portal MVP

These are the main gaps between the current system and the proposed parent/student/tutor app.

### 1. No real app shell yet

- Current portals are large static HTML pages.
- There is no mobile-first app shell, shared layout, bottom nav, or route-based UI.

### 2. No PIN login for students

Needed:

- `student_access_codes` table
- hashed PIN storage
- short student login flow
- secure exchange from PIN to a usable session

### 3. No attempt / redo model

Current system has one main submission record plus uploaded files.

Needed:

- `submission_attempts`
- attempt numbering
- redo tracking
- before/after score improvement
- "needs redo" vs "redo completed" state

### 4. No generated follow-up task model

Current OCR function returns marking output, but the repo does not yet store:

- follow-up tasks
- scaffolded redo tasks
- generated worksheets
- downloadable AI-produced PDF tasks

Needed:

- `ai_generated_tasks`
- PDF generation pipeline

### 5. Parent dashboard is not yet KPI-driven

Parents can view linked work and progress reviews in the current scaffold, but there is no dedicated dashboard for:

- average score
- redo completion rate
- recent activity feed
- current priorities
- mistakes by topic
- progress trends by subject

### 6. Mastery model is not rich enough for the new UX

Current table:

- `objective_mastery(student_id, objective_id, rating, evidence_assignment_id, updated_at)`

Needed for the proposed UX:

- confidence score
- last evidence submission
- more explicit mastery progression
- easier charting for parent and tutor dashboards

### 7. Tutor review workflow needs approval states

Current system supports draft automarking and tutor review, but not a clear publish pipeline.

Needed:

- review queue status
- draft / approved / published states
- tutor override logging
- visibility state for parent and student

## Recommended build approach for this repo

Build a new app in the same repo and keep the current marketing site intact.

Recommended structure:

- marketing site stays at repo root
- new app code lives in `apps/teaching-success-app`
- deploy app under `/app`
- keep the same Supabase project, tables, buckets, and edge functions

## Recommended technical stack

- Next.js app router
- Tailwind CSS
- shadcn/ui
- Supabase JS client
- OpenAI access through server routes or Supabase edge functions

## Recommended route structure

Inside the Next.js app:

- `/app/login`
- `/app/student`
- `/app/student/assignments/[id]`
- `/app/student/upload`
- `/app/student/results/[submissionId]`
- `/app/student/practice`
- `/app/student/progress`
- `/app/parent`
- `/app/parent/homework`
- `/app/parent/mistakes`
- `/app/parent/reports`
- `/app/parent/curriculum`
- `/app/tutor`
- `/app/tutor/students`
- `/app/tutor/assignments/new`
- `/app/tutor/submissions`
- `/app/tutor/reports`

## Auth recommendation

### Parent and tutor

Keep Supabase Auth email/password for:

- tutors
- parents

### Students

Add a PIN-based access layer:

- `student_access_codes`
- edge function or server route to validate PIN
- short-lived student session or exchange token
- optional first-name confirmation

Do not force young students through full email/password login for the app MVP.

## Data model additions recommended

Add these next:

### New tables

- `student_access_codes`
- `submission_attempts`
- `ai_generated_tasks`

### Refine existing mastery model

Either:

- extend `objective_mastery`

or:

- replace it with a richer `student_mastery` model

Preferred direction:

- extend the existing table instead of duplicating mastery concepts unless there is a clear migration need

## Suggested MVP delivery order

### Sprint 1

- scaffold Next.js app shell in `apps/teaching-success-app`
- set up design tokens and mobile navigation
- connect Supabase client
- add role-aware route guards

### Sprint 2

- build student PIN login
- build student home screen
- build quick upload screen
- connect uploads to `submission-files`

### Sprint 3

- connect OCR / automark results screen
- show strengths, mistakes, and next steps
- persist structured review state

### Sprint 4

- add redo task generation and storage
- add PDF export pipeline
- add attempt tracking

### Sprint 5

- build parent dashboard
- build mistakes and redo screen
- add trend summaries and activity feed

### Sprint 6

- build tutor assignment builder
- build tutor review queue
- add approve / override / publish workflow

## First implementation step

The highest-value next coding step is:

1. create the new Next.js app shell
2. wire Supabase client and role-aware layouts
3. build the first three screens:
   - student PIN login
   - student quick upload
   - parent dashboard shell

## Notes for future Codex / ChatGPT coordination

When using this repo with ChatGPT Projects or Codex:

- use this file as the repo-specific app brief
- use the UI spec as the product brief
- use the current `portal.js` and Supabase migrations as the source of truth for what already exists
- avoid rebuilding the backend from scratch unless the current schema becomes a blocker
