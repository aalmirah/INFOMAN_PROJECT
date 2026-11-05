# HOPE Inc. ERP — Authentication Test Cases

**Scope:** Registration, first-login password setup, password handling, login/logout sessions, and password reset
**Status:** Test specification; cases are not executed or passed
**Applies to:** An isolated QA environment after the authentication flows are implemented

## 1. Baseline and assumptions

The current repository contains static registration, login, and password-reset wireframes under `design/wireframes/`, but no authentication implementation was found in `app/` or `lib/`. The cases below define expected behavior for the delivered flows; wireframe presence is not evidence that a case passes.

The registration wireframe describes email registration as a request for Superadmin approval. New accounts start as `User / Inactive`; after approval, the user sets a password using an emailed link. The reset-password wireframe states a minimum of eight characters, at least one uppercase letter, and at least one number, with a matching confirmation. Confirm these rules, link expiry, account-enumeration policy, session lifetime, and Google OAuth/account-linking behavior with the product and technical owners before execution.

## 2. Test safety and execution rules

- Use only an isolated QA Supabase project, synthetic identities, and accounts controlled by the test team. Never use production or real employee credentials.
- Keep credentials and test inbox access in an approved vault. Do not put passwords, reset links, tokens, cookies, or provider secrets in this file, tickets, screenshots, logs, or Git.
- Use a unique email per registration test. Clean up test accounts and sessions according to the QA data-retention policy.
- Execute token tests with QA-issued links. Redact token values from evidence and logs.
- Record each case as **Not Run**, **Pass**, **Fail**, or **Blocked**, together with environment, build/commit, date, tester, actual result, and sanitized evidence.
- A case is **Pass** only after execution against the implemented flow. Source or wireframe inspection alone is not a functional pass.
- Do not query or expose production password hashes. Verify storage handling only through an approved QA/admin path or a documented security/configuration review.

### Suggested test accounts

| Account | Initial state | Use |
| --- | --- | --- |
| New synthetic email | Not registered | Registration happy path |
| Duplicate synthetic email | Existing account | Duplicate registration/reset response |
| Pending account | `User / Inactive` | Pre-approval access denial |
| Approved account with no password | `User / Active`, setup pending | First-login password setup |
| Approved account with password | `User / Active` | Login, session, logout, and reset |
| Disabled account | Inactive/blocked per approved policy | Login denial |

## 3. Registration

| ID | Priority | Steps / test data | Expected result | Status |
| --- | --- | --- | --- | --- |
| REG-01 | P1 | Submit registration with valid first name, last name, and a unique QA email. | Exactly one registration request is created; a clear confirmation is shown; the account is `User / Inactive` pending approval; the response does not imply access is already granted. | Not Run |
| REG-02 | P1 | Submit with first name empty, then last name empty, then both empty. | Required-field validation prevents submission and identifies the missing fields; no account or approval request is created. | Not Run |
| REG-03 | P1 | Submit with email empty. | Submission is blocked with an accessible required-field message; no account is created. | Not Run |
| REG-04 | P1 | Try malformed email values (missing local part/domain, invalid syntax, embedded whitespace). | Invalid email is rejected; feedback is associated with the field; no account is created. | Not Run |
| REG-05 | P2 | Enter leading/trailing whitespace, very long values, Unicode, punctuation, and one-character names. | Inputs are normalized or rejected according to agreed rules; values are not silently truncated into a different identity; no unexpected server error occurs. | Not Run |
| REG-06 | P1 | Submit the same email twice, including two rapid submissions. | No duplicate identity/request is created. Duplicate feedback follows the approved account-enumeration policy. UI prevents or safely handles duplicate submission. | Not Run |
| REG-07 | P1 | Submit, simulate provider/network timeout, then retry after recovery. | An explicit recoverable error appears and loading ends. Retry does not create multiple accounts or show false success. | Not Run |
| REG-08 | P1 | Before Superadmin approval, attempt password setup and access to a protected route. | Pending/inactive account cannot set an active password unless explicitly allowed by policy and cannot access protected ERP features. | Not Run |
| REG-09 | P1 | Approve the account as Superadmin and deliver the first-login setup email. | Only explicit approval activates eligibility; setup message/link is sent to the registered address and corresponds to the correct account. | Not Run |
| REG-10 | P2 | Check keyboard navigation, labels, required indicators, focus order, error announcements, and mobile/desktop layouts. | All fields/actions are keyboard-operable and accessibly named; focus and errors are perceivable; no clipping/overflow prevents completion. | Not Run |

## 4. First-login password setup and password handling

| ID | Priority | Steps / test data | Expected result | Status |
| --- | --- | --- | --- | --- |
| SET-01 | P1 | Open a valid, unused first-login link for an approved account. | Link is validated for the intended identity; password setup is displayed; user can set a password without being granted unrelated administrative privileges. | Not Run |
| SET-02 | P1 | Open a setup link for an unapproved or disabled account. | Setup is denied or follows the explicitly approved exception; account remains unable to access protected features. | Not Run |
| SET-03 | P1 | Submit new password and confirmation both empty. | Required-field validation prevents the update. | Not Run |
| SET-04 | P1 | Test password lengths below 8, exactly 8, and above 8 characters. | The agreed minimum boundary is enforced consistently on client and server; accepted boundary values can be submitted. | Not Run |
| SET-05 | P1 | Test passwords with no uppercase letter and with no number; then test a password meeting all stated rules. | Passwords failing the documented uppercase/number requirements are rejected; a compliant password is accepted. Rules are enforced server-side, not only by browser validation. | Not Run |
| SET-06 | P1 | Enter a valid password but a different confirmation value. | Update is rejected, a clear mismatch message is shown, and the password remains unchanged. | Not Run |
| SET-07 | P1 | Submit a valid new password using the first-login link. | Password is set once; token is consumed; account transitions to the documented ready-to-sign-in state; no plaintext password is returned or logged. | Not Run |
| SET-08 | P1 | Replay the same first-login link after successful setup; open it in a second tab/session. | Reused token cannot change the password again or create another session; user is directed to sign in or request a new link. | Not Run |
| SET-09 | P1 | Use an expired, malformed, tampered, or unknown setup token. | Request is rejected safely; no password/account state changes; response gives recovery guidance without revealing token or account details. | Not Run |
| SET-10 | P1 | Attempt concurrent submissions with the same setup token. | At most one password update succeeds; the token is atomically consumed and cannot be used by a second request. | Not Run |
| SET-11 | P1 | Review password handling in QA storage and application/network logs using approved, non-production methods. | Password is transmitted only over TLS and is never persisted or logged in plaintext. Password verification relies on the configured trusted auth provider or a suitably salted, adaptive one-way password hash; no reversible encryption or client-side-only hashing is used. | Not Run |
| SET-12 | P2 | Inspect UI, URLs, browser history, and sanitized logs during and after password setup. | Password and token are not rendered in page text or logged. After token exchange, the URL is cleaned or navigation prevents tokens remaining in history where the integration supports it. | Not Run |
| SET-13 | P2 | Use show/hide password controls and keyboard only. | Toggle changes visibility without changing the value; accessible label/state updates; password is hidden by default and focus remains predictable. | Not Run |

**Password-storage note:** Supabase Auth or the selected identity provider should own password storage and verification. Do not add a custom password column or test by exporting real hashes. QA should verify the provider configuration and absence of plaintext leakage; any hash-format verification must use synthetic QA data and approved restricted access.

## 5. Login and logout/session handling

| ID | Priority | Steps / test data | Expected result | Status |
| --- | --- | --- | --- | --- |
| LOG-01 | P1 | Sign in with an approved active account and correct credentials. | Authentication succeeds once and navigates to the approved destination; a valid session is established. | Not Run |
| LOG-02 | P1 | Submit a wrong password for a known account. | Access is denied with a neutral message; no authenticated session is created; password is not echoed. | Not Run |
| LOG-03 | P1 | Submit an unknown email, malformed email, empty email, and empty password. | Invalid/incomplete input is rejected safely; messaging follows the account-enumeration policy; no session is created. | Not Run |
| LOG-04 | P1 | Attempt login with pending, inactive, disabled, or unconfirmed account states. | Access follows the approved state policy; inactive/pending users cannot access protected content; message does not unnecessarily reveal sensitive account state. | Not Run |
| LOG-05 | P1 | Submit login while the auth provider/network is unavailable, then retry after recovery. | User sees a recoverable failure; no false authenticated UI/session is shown; retry works after service recovers. | Not Run |
| LOG-06 | P1 | Refresh the page and navigate to a protected route after successful login. | Session persists only as specified; protected route remains available while authorized; unauthenticated requests are redirected/denied. | Not Run |
| LOG-07 | P1 | Sign out, then use browser back, refresh, and directly revisit a protected route. | Session is invalidated according to provider policy; protected data is not revealed from a stale client view or route cache. | Not Run |
| LOG-08 | P2 | Test session expiry by waiting for the configured idle/absolute timeout or expiring the QA session. | Expired session is rejected and user is asked to authenticate again; refresh tokens do not restore access beyond configured policy. | Not Run |
| LOG-09 | P2 | Sign in with “Remember me” both enabled and disabled; close/reopen the browser as applicable. | Persistence matches the stated product behavior; shared-device warning is respected; logout still removes the session. | Not Run |
| LOG-10 | P2 | Verify repeated login clicks, simultaneous tabs, and concurrent sign-out. | UI avoids duplicate requests; session state remains consistent across tabs; a signed-out session cannot continue authorized actions. | Not Run |
| LOG-11 | P2 | Check password case sensitivity and leading/trailing spaces. | Password comparison follows the auth provider's exact documented behavior; passwords are not silently transformed in a way that changes credentials. | Not Run |
| LOG-12 | P2 | Check keyboard flow, password manager/autofill, visibility toggle, and mobile viewport. | Controls are accessible and operable; `current-password` behavior is appropriate; no credentials appear in URLs or status messages. | Not Run |

## 6. Password reset and recovery

| ID | Priority | Steps / test data | Expected result | Status |
| --- | --- | --- | --- | --- |
| RST-01 | P1 | Request a reset link for an active QA account. | A reset request is accepted and a link is delivered to the verified account email; response follows the approved enumeration policy. | Not Run |
| RST-02 | P1 | Submit reset request with empty or malformed email. | Required/format validation appears and no malformed request is sent. | Not Run |
| RST-03 | P1 | Request reset for an unknown email and a known email. | Public response does not reveal whether an account exists, unless an explicitly approved policy states otherwise; no account is created or modified. | Not Run |
| RST-04 | P1 | Open a valid, unused reset link. | Correct account is identified and reset form is shown over a secure connection; token is not exposed in rendered text or logs. | Not Run |
| RST-05 | P1 | Open an expired reset link. | Reset is denied with a clear expired-link message and a way to request a replacement; password and session state do not change. | Not Run |
| RST-06 | P1 | Complete reset with a malformed, altered, unknown, or invalidated token. | Request is rejected; no password change or unauthorized session occurs; error does not expose token details. | Not Run |
| RST-07 | P1 | Set a new password successfully using the valid link. | Password changes exactly once; token becomes unusable; user is directed to sign in or authenticated only as explicitly intended. | Not Run |
| RST-08 | P1 | Reuse the same reset link after success, including from another tab/browser. | Reuse is rejected; password remains the newly set value; no extra session or second update is granted. | Not Run |
| RST-09 | P1 | Request two reset links; use the older link after the newer link is issued, then use the newest link. | Token invalidation/validity follows the provider policy (prefer invalidating prior outstanding tokens); only a currently valid token can change the password. Record actual behavior against the approved policy. | Not Run |
| RST-10 | P1 | Submit reset form with blank new password or confirmation. | Required fields prevent submission and no update occurs. | Not Run |
| RST-11 | P1 | Test below-minimum length, missing uppercase, missing number, and valid policy-boundary password. | The same documented password rules as first-login setup are enforced server-side; invalid values do not change the password. | Not Run |
| RST-12 | P1 | Enter different new-password and confirmation values. | Reset is rejected with a clear mismatch message; password remains unchanged and token is not consumed unless policy specifies otherwise. | Not Run |
| RST-13 | P1 | Submit two concurrent reset requests with one token. | No more than one update succeeds; token consumption and password update are atomic. | Not Run |
| RST-14 | P1 | After successful reset, log in with the old password, then the new password. | Old password is rejected and new password succeeds. Existing sessions are revoked or retained exactly as defined by the session-security policy. | Not Run |
| RST-15 | P2 | Simulate mail delivery/provider outage and retry after recovery. | Failure is communicated without claiming a link was sent if delivery failed; retry does not expose account existence or create unsafe tokens. | Not Run |
| RST-16 | P2 | Verify reset email destination, link host, TLS, token redaction, and browser history behavior. | Link goes only to an approved QA origin, uses HTTPS outside local development, and no secret/token appears in logs or analytics. | Not Run |

## 7. Cross-cutting security and usability checks

- TLS is used for authentication and password-reset traffic outside local development.
- Passwords and reset/setup tokens do not appear in client logs, server logs, analytics, URL query telemetry, or error reporting.
- Tokens are unpredictable, scoped to the intended action/account, time-limited, single-use, and invalidated according to the approved lifecycle.
- Authentication errors are useful but do not disclose secrets or unnecessarily confirm account existence.
- Protected routes and data are checked server-side/provider-side as applicable; hiding UI alone is not access control.
- Forms provide accessible labels, keyboard interaction, visible focus, and announced validation/error messages.
- Authentication screens remain usable at supported viewport sizes and do not expose credentials in page content.

## 8. Acceptance and reporting

Authentication is ready for QA sign-off when:

1. All applicable P1 cases pass in the isolated QA environment; P2 cases are completed or explicitly dispositioned.
2. Registration approval, first-login setup, password policy, token expiry/reuse, reset behavior, and session lifecycle match approved requirements.
3. There are no unresolved Critical/High defects. Lower-severity exceptions have an owner and documented disposition.
4. No plaintext passwords, provider secrets, or live tokens are found in storage/logs/evidence through approved QA verification.
5. Test results include build/commit, environment, tester, date, and sanitized evidence. Any blocked or failed case has a linked issue and clear reproduction steps.

**Current execution status:** Not run. The current repository baseline contains static auth wireframes; functional auth and QA-provider tests require implementation and an isolated configured environment.
