# HOPE Inc. ERP — Sprint 1 Authentication Test Cases

**Target branch:** `docs/S1-QA-02-auth-test-cases`  
**Status:** Checklist; execution pending a working authentication implementation and isolated QA provider

## Preconditions

- Use an isolated QA Supabase project and synthetic test identities only.
- Confirm registration eligibility, email confirmation, password rules, Google OAuth settings, callback URLs, account-linking policy, and Superadmin approval behavior with the product/technical owner.
- Prepare an unused email, a duplicate email, an active approved account, a pending/inactive account, and a Google test account. Store credentials in the approved test vault, never in this document.
- Record each case as **Not Run**, **Pass**, **Fail**, or **Blocked**, with build/commit and sanitized evidence.

## Registration form validation

| ID | Checklist / steps | Expected result | Status |
| --- | --- | --- | --- |
| REG-01 | [ ] Submit valid first name, last name, and unique email. | Exactly one registration is submitted; user receives the configured confirmation/result and starts in the documented pending approval state. | Not Run |
| REG-02 | [ ] Submit with first name empty; repeat with last name empty. | Required-field validation prevents submission and identifies the field. No account is created. | Not Run |
| REG-03 | [ ] Submit with email empty. | Required-field validation prevents submission. No account is created. | Not Run |
| REG-04 | [ ] Submit malformed email examples (missing local part/domain, invalid format, whitespace). | Invalid email is rejected accessibly; no account is created. | Not Run |
| REG-05 | [ ] Enter leading/trailing whitespace and boundary-length names/email values. | Values are normalized or rejected consistently with approved limits; no silent truncation or malformed account data. | Not Run |
| REG-06 | [ ] Submit an already registered email. | Duplicate handling follows the approved policy, does not create another account, and avoids unintended account enumeration. | Not Run |
| REG-07 | [ ] Double-click submit or retry after a delayed response. | Loading/disabled state prevents accidental duplicate submissions; final state is accurate. | Not Run |
| REG-08 | [ ] Simulate network/provider failure during registration, then restore and retry. | A recoverable error is shown; the form can be retried; no false success or duplicate account results. | Not Run |
| REG-09 | [ ] If email confirmation is enabled, use a valid link, then retry it; test expired/invalid link. | Valid link confirms only the intended identity; reused/invalid/expired link fails safely with recovery guidance. | Not Run |
| REG-10 | [ ] Check labels, required indicators, focus order, keyboard submission, focus visibility, and screen-reader error announcements. | Every field/action has an accessible name; keyboard users can complete the form and locate validation feedback. | Not Run |
| REG-11 | [ ] Check the registration form at supported mobile and desktop sizes. | No clipped fields/actions or horizontal overflow; content and errors remain readable and operable. | Not Run |
| REG-12 | [ ] Verify new registration state before and after Superadmin approval. | New account is `User / Inactive` and cannot access protected ERP content; only explicit approval changes access as specified. | Not Run |

## Google OAuth flow

| ID | Checklist / steps | Expected result | Status |
| --- | --- | --- | --- |
| OAUTH-01 | [ ] Verify the Google provider is enabled in the QA auth project and the exact application callback/redirect URLs are configured. | Provider and redirect configuration match the deployed QA origin; no production URL or credential is used. | Not Run |
| OAUTH-02 | [ ] Start Google OAuth from registration using an unused Google test account; complete consent. | Flow returns to the expected route and creates/records exactly one identity in the documented pending approval state. | Not Run |
| OAUTH-03 | [ ] Start Google OAuth from login using an approved active QA identity. | Authentication succeeds and redirects to the approved destination with a valid session. | Not Run |
| OAUTH-04 | [ ] Start Google OAuth from login using an inactive/pending identity. | Access to protected ERP features is denied until Superadmin approval; UI communicates the expected next step without granting a session. | Not Run |
| OAUTH-05 | [ ] Cancel at the Google consent screen and return to the application. | User returns to a safe route, sees a clear non-success state, and can retry; no account/session is created inadvertently. | Not Run |
| OAUTH-06 | [ ] Test Google provider denial, unavailable provider/network, and callback error. | Failure is handled visibly and safely; no secrets, tokens, or stack traces appear; retry remains possible. | Not Run |
| OAUTH-07 | [ ] Test an email matching an existing password account and any approved linking scenario. | Linking or rejection follows the explicit account-linking policy; no duplicate identity or account takeover path is introduced. | Not Run |
| OAUTH-08 | [ ] Attempt callback with invalid, expired, or replayed OAuth state/code. | Callback is rejected and no authenticated session is established. | Not Run |
| OAUTH-09 | [ ] Refresh after success, use logout, and revisit a protected route/back history. | Session persistence and invalidation match the approved policy; protected content is not available after logout. | Not Run |
| OAUTH-10 | [ ] Inspect browser address, visible UI, and sanitized logs after success and failure. | No provider secret or access token is exposed; credentials are not placed in application URLs or user-visible error messages. | Not Run |

## Execution notes

- The current `design/wireframes/register.html` shows required first name, last name, and email fields, plus a “Continue with Google” button and Superadmin approval messaging. Its form uses a placeholder `action="#"`; this is not evidence of working registration or OAuth.
- The current `design/wireframes/login.html` also contains a Google button, but auth screens were not found in the Next.js application code during inspection.
- Do not mark any case **Pass** from visual inspection alone. Record unsupported cases as **Blocked** and create/link a defect or implementation issue as appropriate.
