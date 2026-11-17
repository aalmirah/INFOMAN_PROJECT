# Permission Matrix Test Checklist

**Task:** Tester Task 4 — Permission matrix  
**Scope:** Superadmin, Admin, and User permissions across every granular action right; sidebar/menu, action-button, and server-endpoint enforcement.  
**Execution status:** Historical tester-reported Pass. This predates the current DEV07 implementation and is not evidence that DEV07 passed QA. The DEV07 cases below remain Not Run.

## DEV07 isolated QA setup and cases — not run

The tester-reported results below are not evidence that the current DEV07
implementation, SQL proposal, or module policies have passed QA. Keep Rights
Management disabled until the DEV07 cases and action enforcement pass.

The updated atomic save RPC is installed and verified in both MAIN
(project reference `ijfucrcvvuwqdfwiqtzh`) and HOPE-ERP-QA
(project reference `jlygmihiufrlqxzsfhpf`).

Final DEV07 behavioral testing must use MAIN, as agreed, with the existing
Admin or Superadmin test account and the existing regular User test account.
Do not create test accounts, change account roles, or test against real users.
Do not run SQL or make additional database changes as part of this test.
Record actual results and sanitized evidence; do not mark untested cases Pass.

The agreed 36-right catalogue was applied to QA with separate approval. The
QA database currently has an earlier version of the atomic save RPC; the
updated RPC definition has not yet been installed there. Review and separate
approval are required before updating the QA function. Four QA-only profiles
were approved and linked to new ERP accounts with separate approval; a
read-only check found one eligible linked Superadmin, two Admins, and one
User. The tester reported successful sign-in and expected User Management
button visibility for all four accounts in the isolated QA login app. Rights
API, grant/revoke, audit, and per-action enforcement QA remain not run.

### Minimum fixtures

- Four synthetic, sign-in-capable, approved, active and unblocked profiles:
  one Superadmin, two distinct Admins, and one User. The second Admin is needed
  to test that an Admin cannot manage another Admin.
- Each profile needs an existing active, unblocked ERP account linked by
  `app_user.auth_user_id = profiles.id`, with the corresponding active ERP
  role. `profiles.id` is an Auth UUID, not `app_user.user_id`. Use only links
  established by an independently approved process; do not infer them by email.
- Five active modules and the approved 36 active rights: Customer 3, Product 6,
  Human Resources 13, Sales 7, and Reports 7. Record the approved exact code,
  action, label, and protected endpoint or database operation for every right.
  The agreed catalogue is installed in QA, but missing action APIs and report
  definitions still prevent complete action-enforcement verification.
- For the User, choose four distinct active catalogue rights: one without an
  assignment, one `Inactive`, and two `Active`. Record their IDs and the
  initial audit and permission rows. Create this fixture only through an
  approved QA procedure; never remove permission or audit records physically.

An unmerged historical branch contains a candidate seed at Git revision
`e71981f`, path `db/seeds/001_default_roles_modules_rights.sql`. Its presence
does not establish that its codes or action-to-resource mappings are approved.

### DEV07 test cases

Run the DEV07 cases against MAIN using the existing approved test accounts.
The updated RPC is already installed in MAIN. Do not run SQL or modify database
configuration during behavioral testing. Record sanitized evidence; all cases
below remain **Not Run** until the Tester executes them.

| Case | Expected result |
|---|---|
| Grant and restore | Grant the unassigned right and reactivate the inactive right; one row per right ends `Active`. Exactly one audit row per change identifies actor ERP ID, target ERP ID, right ID, `GRANT`, and timestamp. |
| Revoke and preserve | Untick one active right while retaining the other. The revoked row remains present as `Inactive`; the retained row is unchanged. Exactly one audit row records `REVOKE` and the actor, target, right, and timestamp. |
| No-op | Save an unchanged selection. No permission row or audit record changes. |
| Atomic rollback | Arrange an approved, isolated audit failure on the second change of a multi-right save. The save fails and both earlier and later permission changes and audit inserts are rolled back. Verify the initial rows and audit count are unchanged. |
| Concurrent saves | Two editors save from the same initial snapshot with different choices. One succeeds; the stale save is rejected, with no partial changes or extra audit rows. |
| Management roles | Admin can edit the User but cannot view or edit the other Admin or Superadmin. User cannot access the Rights API. Superadmin can edit Admin/User and sees Superadmin rights checked and read-only. |
| Per-action enforcement | For every approved right and its mapped action, test direct server/database access for granted and revoked User and Admin accounts. Revoked or inactive rights must not authorize the action; Superadmin retains every active right. Preserve any stricter role restrictions. |
| Access paths | Verify underlying tables, views, RLS policy combinations, RPCs, and service-role-backed APIs cannot bypass the corresponding action check. Test inactive rights/modules and blocked accounts. |

## Legacy permission matrix

The tester-reported matrix below predates the current DEV07 implementation and
is not evidence that it passed QA. Its `TODO` entries are not a verified mapping
of the agreed catalogue to existing action endpoints.

## Preconditions

- Use only the isolated development/QA environment and synthetic accounts; never use production accounts or data.
- Prepare one approved, active account for each role: Superadmin, Admin, and User. Ensure the accounts can sign in without a forced password change.
- Prepare safe QA records for operations that create or update data. Do not use destructive actions against real or shared records.
- Record which rights are explicitly granted to each account. A role label alone does not determine the expected result when rights are individually assigned.
- Capture sanitized evidence only. Do not include passwords, tokens, private user data, or sensitive response bodies.

## Procedure for every right and role

Run these checks for each right in the matrix, for **each** role:

1. **Granted:** grant the right to the test account, sign in as that account, and refresh the relevant page. Verify the applicable sidebar/menu entry and action button are visible and usable. Perform the action against a safe QA record; verify the UI result and the server response/state.
2. **Revoked:** remove the right, refresh the session/page (sign out and back in if required), and verify the corresponding navigation/action is hidden or disabled. Call the matching endpoint directly as that account. The server must reject the request with the documented authorization status (normally 403) and must not change data.
3. If a right has no sidebar item, mark that check `N/A` and test its action button and endpoint. If an endpoint is read-only, verify it returns no protected data when denied.
4. Record the observed result and sanitized evidence. Use `Pass`, `Fail`, `Blocked`, `Not Run`, or `N/A`; do not mark a case Pass based only on the UI.

## Granular permission matrix

For each cell, record `Granted: Pass/Fail` and `Revoked: Pass/Fail` for the relevant UI and endpoint checks, or explain why it is `N/A`/`Blocked`.

| ID | Group | Exact right label (copy from app) | Endpoint / action | Superadmin: menu / button / server | Admin: menu / button / server | User: menu / button / server |
|---|---|---|---|---|---|---|
| CUS-01 | Customer | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| CUS-02 | Customer | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| CUS-03 | Customer | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| PRD-01 | Product | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| PRD-02 | Product | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| PRD-03 | Product | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| PRD-04 | Product | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| PRD-05 | Product | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| PRD-06 | Product | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-01 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-02 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-03 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-04 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-05 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-06 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-07 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-08 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-09 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-10 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-11 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-12 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| HR-13 | Human Resources | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| SAL-01 | Sales | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| SAL-02 | Sales | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| SAL-03 | Sales | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| SAL-04 | Sales | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| SAL-05 | Sales | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| SAL-06 | Sales | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| SAL-07 | Sales | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| RPT-01 | Reports | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| RPT-02 | Reports | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| RPT-03 | Reports | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| RPT-04 | Reports | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| RPT-05 | Reports | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| RPT-06 | Reports | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |
| RPT-07 | Reports | TODO | TODO | Pass (tester-reported) | Pass (tester-reported) | Pass (tester-reported) |

## Cross-cutting checks

| ID | Test | Expected result | Status |
|---|---|---|---|
| PM-01 | Try a restricted action through its direct endpoint after its right is revoked. | Server rejects the request; no data is exposed or changed, even if a stale/hidden UI control is bypassed. | Pass (tester-reported) |
| PM-02 | Change a right while the affected user is signed in, then refresh/re-authenticate as required by the design. | Effective permissions update according to the documented session policy; UI and server agree. | Pass (tester-reported) |
| PM-03 | Open a protected module URL directly when its navigation/right is unavailable. | Access is denied or redirected; protected content is not rendered. | Pass (tester-reported) |
| PM-04 | Check a user who has one right in a module but lacks another. | Only the permitted actions are available; unrelated controls/endpoints remain denied. | Pass (tester-reported) |
| PM-05 | Compare every row's visible sidebar item, action button, and endpoint result. | All three enforcement surfaces agree with the assigned right; no UI-only authorization is relied upon. | Pass (tester-reported) |

## Execution summary

- Rights identified from the authoritative catalogue: `___ / 36` (exact labels/endpoints still need to be recorded)
- Role/right combinations completed: `108 / 108` (tester-reported; includes granted and revoked checks)
- Passed: `113`  Failed: `0`  Blocked: `0`  Not Run: `0` (tester-reported)
- Build/commit tested: `Not provided`
- QA environment and date: `Not provided`
- Evidence links (sanitized): `___`

Tester reports that all permission tests passed. To make the report independently traceable, fill in the 36 exact right names and endpoints above and add sanitized evidence, environment, and build/commit details.
