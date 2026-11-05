# User Management Test Cases

**Task:** S1-TST-03  
**Related implementation:** DEV-05 User Management  
**Execution status:** Manual test results reported as successful by the tester. Detailed screenshots, test-account identifiers, and environment/build evidence were not included in this draft.

## Preconditions

- Use the isolated development/QA environment and synthetic accounts only.
- Have approved, active Admin and SuperAdmin test accounts, a regular User, a pending account, and at least two Superadmin accounts.
- Do not use production accounts. Restore test account statuses and roles after testing.
- Keep credentials and personal information out of this report and screenshots.

## Test cases and execution results

| ID | Test | Steps | Expected result | Result |
|---|---|---|---|---|
| UM-01 | Add a User | Sign in as an authorized Admin or SuperAdmin. Open User Management, add a User with valid required details, and submit. | The user is created once, appears in the directory with the User role and expected initial status, and a success message is shown. | Pass — tester reported successful |
| UM-02 | Validate Add User form | Submit with required details missing, then try a malformed or duplicate test email. | Invalid input is rejected with clear field feedback; no unintended duplicate account is created. | Pass — tester reported successful |
| UM-03 | Edit a User | Edit a test User's permitted profile details and save. | Updated details are shown in the directory and persist after refresh. | Pass — tester reported successful |
| UM-04 | Block and unblock a User | Block a test User, verify the displayed status, then unblock the same account. | Status changes to blocked and back to active/unblocked; the change persists after refresh. | Pass — tester reported successful |
| UM-05 | Approve a pending account | As SuperAdmin, locate a pending test account and approve it. | The account's approval status changes to approved and the updated status is visible. | Pass — tester reported successful |
| UM-06 | Designate an Admin | As SuperAdmin, assign the Admin role to an eligible test account and save. | The role changes to Admin and is displayed correctly; the account receives Admin access only. | Pass — tester reported successful |
| UM-07 | Admin cannot view Superadmin | Sign in as Admin and inspect the user directory and search results for a known Superadmin test account. | Superadmin accounts are not exposed in the Admin's directory or search results. | Pass — tester reported successful |
| UM-08 | Admin cannot edit Superadmin | As Admin, attempt to open or submit an edit/block action for a Superadmin test account, including a direct request if that was part of the test. | The operation is denied; the Superadmin account remains unchanged. | Pass — tester reported successful |
| UM-09 | Protect the last Superadmin | In an isolated QA setup with exactly one remaining Superadmin, try to demote, block, deactivate, or delete that account using the available management action. | The operation is rejected and at least one active Superadmin remains. | Pass — tester reported successful |

## Notes

- Results above reflect the tester's confirmation that the requested User Management cases were run and working; they are not independently re-executed in this report.
- Attach sanitized screenshots or other evidence to the pull request if available. Do not include passwords, tokens, or real user data.
- If any case was not actually exercised (especially the last-Superadmin guard), change its result to **Not Run** or **Blocked** rather than retaining Pass.
