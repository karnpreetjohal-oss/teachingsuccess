# Teaching Success App

Mobile-first Next.js app scaffold for the Teaching Success student, parent, and tutor experience.

## What is included

- Next.js app-router shell under `/app`
- Tailwind CSS setup
- shadcn/ui-compatible component structure
- role-based route folders for student, parent, and tutor
- Supabase browser/server client scaffolding
- first-pass mobile screens for:
  - student PIN login
  - student dashboard / upload / results / progress
  - parent dashboard / homework / mistakes / reports / curriculum
  - tutor dashboard / students / assignment builder / review queue / reports

## Install

```bash
cd apps/teaching-success-app
npm install
cp .env.example .env.local
```

Add your current Supabase project values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TEACHING_SUCCESS_APP_SESSION_SECRET`

## Run

```bash
npm run dev
```

With the configured `basePath`, the app will live under:

- `http://localhost:3000`

## Notes

- This scaffold is designed to reuse the existing Teaching Success Supabase backend.
- Parent and tutor auth should continue to use Supabase email/password.
- Student PIN login still needs a dedicated access-code flow and backend exchange step.
- Student PIN routes in this scaffold expect a `student_access_codes` table and the matching Supabase migration.
- The current environment used to create this scaffold did not have Node.js installed, so dependencies were not installed and no runtime verification was possible here.
