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

For password reset, set the Supabase Auth Site URL to the app's primary origin
and also allow this local redirect URL in Supabase Auth:
`http://localhost:3000/auth/callback?next=/reset-password/confirm`. Password
recovery email delivery requires an enabled Auth email provider and working
SMTP configuration. Keep the recovery email template's confirmation link
(`{{ .ConfirmationURL }}`) so Supabase can validate the expiring link and
return to the app. Add the equivalent callback URL for each deployed app
origin when one is available. If SMTP/email delivery is disabled or not
configured, reset requests cannot deliver a link.

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
in the app. Approved users who finish setup are sent to the dashboard at
`/session`. Until a Superadmin UI
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

### DEV08 Dashboard authorization

The dashboard and User Management require an approved, active, unblocked
profile and a linked active, unblocked ERP account with a matching active role.
Accounts without a valid link must be resolved by an administrator. The
dashboard checks active rights and modules against `v_user_effective_rights`
on the server. Module access does not grant individual actions; future module
pages and API handlers must independently call `authorizeModule` or
`authorizeRight` as appropriate, returning 401/403 for denied API requests.

Business module landing pages show the current account's active permission
assignments; module operations and reports are not yet implemented. System
Settings is restricted to Superadmins and links to the existing User Management
page; other settings controls are not implemented. User Management remains
available to eligible Admins and Superadmins. Admins and Superadmins can see
all four counts. Regular users see product and employee counts only with the
corresponding Product Master and Active Employees report rights; customer and
sales totals remain restricted until a suitable read permission is confirmed.
Count failures are shown as unavailable rather than as zero. Dashboard and
module pages refresh access on focus and every 30 seconds while visible.

### DEV07 Rights Management

Rights Management is disabled by default. Keep
`DEV07_RIGHTS_MANAGEMENT_ENABLED=false` until the database changes and
end-to-end authorization, permission changes, and audit logging have passed
isolated QA. SQL proposals in `docs/` must not be executed without separate
approval.

The [atomic rights save proposal](./docs/dev07_atomic_rights_save_proposal.sql)
uses the existing permissions and audit tables. The updated RPC definition was
applied to MAIN (project reference `ijfucrcvvuwqdfwiqtzh`) and HOPE-ERP-QA
(project reference `jlygmihiufrlqxzsfhpf`). The RPC definition was verified
in both projects. Final DEV07 behavioral testing is assigned to the Tester
on MAIN using existing test accounts only. Do not use real user accounts.
Grant/revoke, audit, concurrency, and per-action enforcement results remain
pending Tester verification.
For editable rights, the actor and target need existing linked, active,
unblocked ERP accounts with active roles matching their profiles; the
application also requires eligible active profiles. Account provisioning and
profile synchronization are outside DEV07's scope. Missing links or role
mismatches must be resolved separately, without matching accounts by email.

The [QA catalogue proposal](./docs/dev07_qa_catalogue_proposal.sql) was applied
to HOPE-ERP-QA with separate approval, replacing the synthetic placeholders
with the agreed 36-right baseline. Four QA-only profiles and ERP links were
created with separate approval; a read-only check verified one eligible linked
Superadmin, two Admins, and one User. Sign-in and User Management button
visibility was historically reported as passed by the tester; current DEV07 Rights behavioral QA remains
outstanding.
Existing module policies must also be verified for per-action enforcement:
the exported schema's customer, product, and report policies do not check
`user_permission` directly. Do not treat successful rights assignment alone as
proof that module actions are protected.

Run the focused automated UI and API tests with:

```powershell
node --test tests\rights-dialog.test.mjs tests\rights-management.test.mjs tests\user-management-visibility.test.mjs
```

Synthetic PostgreSQL fixtures exist, but require separate approval before
executing SQL and do not replace isolated Supabase QA against the actual schema,
triggers, grants, and RLS. `node tests/dev07-qa-catalogue-postgres.mjs` tests the
catalogue proposal in a disposable, network-isolated container. The existing
rights PostgreSQL test runner also exercises out-of-scope proposals, so do not
use it as a DEV07-only QA test without review.
