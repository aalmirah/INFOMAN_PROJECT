# HOPE Inc. ERP — Sprint 1 QA Test Plan

**Target branch:** `docs/S1-QA-01-test-plan`  
**Sprint scope:** Registration, login, and database setup  
**Status:** Test plan; not a feature sign-off

## 1. Purpose

Define the test strategy, scope, environments, and release criteria for Sprint 1. Use this plan to verify implemented behavior; a design wireframe or source inspection alone is not evidence that a functional test passed.

## 2. Scope

### In scope

- Registration form validation, account creation, and the agreed approval/confirmation flow.
- Email/password login, Google OAuth sign-in, session behavior, and logout/protected routes if included in Sprint 1.
- Supabase configuration and connectivity from the Next.js application.
- Database schema, setup order, seed data, constraints, and row-level security (RLS) relevant to Sprint 1.
- Authentication error states, keyboard/accessibility checks, and supported desktop/mobile layouts.

### Out of scope

- ERP workflows not delivered in Sprint 1.
- Production migrations, load testing, disaster recovery, and a full penetration test.
- Authorization behavior without an approved role and RLS policy matrix.

## 3. Current baseline and assumptions

- The project uses Next.js, TypeScript, and Supabase. `.env.example` documents `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `app/page.tsx` provides a Supabase connection check against `reports`.
- Registration and login are currently represented by HTML wireframes in `design/wireframes/`; functional auth screens were not found in the application code during repository inspection.
- The registration wireframe describes new accounts as `User / Inactive` pending Superadmin approval. Google sign-in is enabled only after activation.
- The database setup scripts are `database/schema.sql` and `database/users_rights.sql`. The former drops tables with `CASCADE`; the latter enables RLS but does not define policies.

Confirm these product decisions before acceptance: registration eligibility, Google account linking, password policy, email confirmation, duplicate-account messaging, redirect destinations, session persistence, role/profile mapping, and RLS policies.

## 4. Test strategy

1. Review approved Sprint 1 requirements, auth-provider settings, database baseline, and RLS/role matrix.
2. Verify local configuration without exposing credentials. Start the app and smoke-test its Supabase connection check.
3. Set up and validate SQL only in an isolated, disposable/resettable QA Supabase project.
4. Execute registration and authentication happy paths, negative/boundary cases, OAuth cases, and applicable session/authorization cases.
5. Test supported browsers and mobile/desktop viewports. Check labels, keyboard operation, focus visibility, and announced validation/errors.
6. Record each result as **Not Run**, **Pass**, **Fail**, or **Blocked**, with environment, build/commit, steps, expected/actual results, and sanitized evidence. Retest fixes and run focused regression.

Project checks: `npm run lint`, `npm run typecheck`, and `npm run build`. These do not replace browser or QA-database integration testing.

## 5. Environments and test data

| Environment | Use | Requirements |
| --- | --- | --- |
| Local development | Build, lint, typecheck, and developer smoke tests | Node.js 20.9+, npm, dependencies installed, `.env.local` configured with QA Supabase URL and publishable key |
| Isolated QA Supabase | Auth, SQL, seed, RLS, and integration tests | Test project separate from production; known schema; test-only accounts; configured OAuth redirect URLs and email settings; approved RLS policies |
| Production-like preview, if available | Release-candidate smoke test | Production-equivalent settings without production credentials or personal data |

Use synthetic identities and unique QA email addresses. Keep test credentials in the approved vault; never add passwords, tokens, or secrets to this plan, screenshots, logs, or Git. Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable.

**Database safety:** Never run `database/schema.sql` against production or a shared database with data to retain. It drops tables with `CASCADE`; use a disposable or explicitly resettable QA database. Verify the setup order and backup/reset procedure before execution.

## 6. Acceptance criteria

### Registration and login

- Required fields, formats, and password boundaries match approved requirements; invalid or incomplete input creates no account.
- Valid registration creates exactly one account and produces the expected confirmation/approval state.
- Pending/inactive accounts cannot access protected ERP features; approved active accounts can authenticate using the configured method.
- Invalid credentials, cancelled/failed OAuth, provider outages, and expired/invalid confirmation flows fail safely and leave no false authenticated state.
- Sessions, logout, protected routes, and account linking behave according to approved requirements.
- Forms are usable by keyboard and at supported viewport sizes; errors are understandable and do not expose secrets or sensitive account existence.

### Database and integration

- Setup completes in an isolated QA project in the approved order and matches the reviewed schema baseline.
- Required tables, keys, constraints, seed data, and RLS settings are verified; `users_rights.sql` can be re-run without duplicate seed records.
- Access through the publishable client matches the approved RLS matrix. Do not weaken RLS to make a smoke test pass.
- The application reports successful and failed connectivity accurately, without exposing credentials.

### Sprint exit

- All applicable criteria pass and every case has a result, build/commit, and evidence reference.
- No open Critical or High defects remain; accepted lower-severity defects have a documented owner and disposition.
- Product and technical decisions above are resolved or recorded as explicit blockers/deferred scope.
- Lint, typecheck, build, and the QA environment smoke test pass; evidence is linked from the Sprint issue and the team Definition of Done in `docs/team_agreement.md` is met.

## 7. Risks and blockers

- Registration and login are not implemented in the application baseline inspected for this plan; functional acceptance remains blocked until delivered.
- `schema.sql` is destructive, and `users_rights.sql` does not define RLS policies.
- Supabase Auth identities may not be linked to seeded rows in the application `users` table.
- OAuth provider setup, account-linking behavior, policy decisions, and an isolated QA project are prerequisites for integration sign-off.

## 8. Execution record

Repository inspection on 2026-11-02 found the connection-check scaffold and auth wireframes, but no implemented app auth flow. `.env.local` was absent; Node.js/npm, `psql`, and QA Supabase access were unavailable in the inspection environment. Consequently, lint/typecheck/build and live auth/database checks were not run. See [`QA_EXECUTION_REPORT.md`](./QA_EXECUTION_REPORT.md) for the recorded execution status.
