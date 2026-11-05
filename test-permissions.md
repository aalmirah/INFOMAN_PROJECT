# Permission Matrix Test Checklist

**Task:** Tester Task 4 — Permission matrix  
**Scope:** Superadmin, Admin, and User permissions across every granular action right; sidebar/menu, action-button, and server-endpoint enforcement.  
**Execution status:** Tester-reported Pass — tester confirmed all permission checks were tested and working. Results below reflect that confirmation and were not independently re-run for this document.

## Important: load the authoritative rights catalogue first

The current checkout does not contain the permission editor/catalogue or an authoritative list of the granular right labels. The project handoff describes 36 rights across these groups: Customer (3), Product (6), Human Resources (13), Sales (7), and Reports (7). The tester reports that all permission checks passed. For a traceable report, replace each `TODO` with the exact right name and corresponding endpoint from the permission editor/API.

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
