# Supabase Setup (Teaching Success Portal)

This project now includes a real backend-powered portal:
- `portal.html`
- `portal.js`
- `supabase/schema.sql`

## 1) Create Supabase project
1. Go to Supabase and create a new project.
2. In project settings, copy:
   - Project URL
   - Anon public key

## 2) Run database schema
1. Open **SQL Editor** in Supabase.
2. Paste the contents of `supabase/schema.sql`.
3. Run it.

## 3) Add Supabase keys to the portal
Open `portal.js` and replace:
- `YOUR_SUPABASE_URL`
- `YOUR_SUPABASE_ANON_KEY`

## 4) Create your tutor account
1. Open `portal.html`.
2. Sign up with your own email.
3. In Supabase SQL Editor, run:

```sql
update public.profiles
set role = 'tutor'
where email = 'your-email@example.com';
```

4. Sign out and sign back in.

You should now see the Tutor Dashboard and be able to assign work.

## 5) Student accounts
- Students can create their own account from `portal.html` using the signup form.
- Once signed in, they will automatically see assignments assigned to them.

## 6) Assignment flow
- Tutor creates assignment for a selected student.
- Student logs in, opens assignment, submits notes/evidence.
- Assignment status updates to `completed`.

## 7) Optional auth settings
In Supabase Auth settings, decide whether email confirmation is required.
- If ON: users must confirm email before sign in.
- If OFF: users can sign in immediately after signup.

## 8) Publish
After editing files:

```bash
git add portal.html portal.js supabase/schema.sql SUPABASE_SETUP.md
git commit -m "Add Supabase portal scaffold for tutor/student assignments"
git push origin main
```
