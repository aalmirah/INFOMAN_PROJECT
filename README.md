# HOPE Inc. ERP

Foundational project scaffold for the HOPE Inc. ERP application, built with the
Next.js App Router, TypeScript, and Supabase.

## Local-only development

- Node.js 20.9 or later
- npm
- Access to the team's Supabase development project

The Next.js app runs on each developer's computer at `http://localhost:3000`.
No hosted app or PR preview is required. Supabase remains a remote service used
by the local app for Auth and database access.

### Environment setup

Each developer must create their own `.env.local` in the repository root:

```powershell
Copy-Item .env.example .env.local
```

Set the values using credentials supplied through the team's approved secure
process:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SECRET_KEY=your-supabase-secret-key
```

The URL and publishable key are available in the Supabase project's Connect
panel. Registration also requires the server-only `SUPABASE_SECRET_KEY` for
Supabase Admin Auth operations. Never put a secret/service-role key in a
`NEXT_PUBLIC_` variable, commit it, or send it in chat. `.env.local` is ignored
by Git. Use the team's development Supabase project and test accounts, not
production credentials or real user data.

## Local development

From the repository root, install dependencies and start the local server:

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your own computer.
Other team members should clone/pull the PR branch, create their own
`.env.local`, and run the same commands locally. `localhost` is not shared
between computers. Restart `npm run dev` after changing `.env.local`.

For Google sign-in, configure the local callback URL
`http://localhost:3000/auth/callback` in the team's Supabase Auth redirect
allowlist and Google provider settings. Do not change shared project settings
without coordinating with the DB Admin.

### DEV03 database setup

Before testing login, logout, blocked/pending-user checks, or first-login
password changes, the DB Admin must review and apply
[`supabase/migration/dev03_auth_fields.sql`](./supabase/migration/dev03_auth_fields.sql)
to the development Supabase project. This adds `profiles.is_blocked`,
`profiles.is_active`, and `profiles.must_change_password`. An Auth trigger
clears the password-change flag only after Supabase Auth changes the user's
password.
The app deliberately denies sign-in when required profile fields cannot be
verified.

The password-change trigger clears `profiles.must_change_password` when the
password is changed through Supabase Auth. Newly registered users remain
subject to the existing `approval_status` check. Supabase Auth applies its
configured password and request rate limits; do not implement password hashing
in the app. Until the Dashboard exists, approved users who finish setup are
sent to `/session`, a temporary page with a Logout button. Until a Superadmin UI
exists, the DB Admin may review
[`supabase/migration/dev03_approve_pending_user.sql`](./supabase/migration/dev03_approve_pending_user.sql)
as a per-user approval template. After registration, the browser establishes a
Supabase Auth session without sending email and remains on the existing
`/register` page. While that page stays open, it checks the profile every five
seconds. When the DB Admin changes the profile from `pending` to `approved`,
it routes the user to `/set-password`; after saving a password, the user signs
out and signs in normally. Approval detection requires the user to return to
the same browser where registration was completed if that page/session was
closed. No email is sent by this flow.

Run the available project checks with:

```powershell
npm run lint
npm run typecheck
npm run build
```
