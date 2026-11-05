# Draft Test Report: DEV Task 2 — Login, Logout, Set and Reset Password

**Status:** DRAFT — not a sign-off  
**Date:** 2026-11-05  
**Task:** DEV Task 2 — login/logout and set/reset password  
**Scope:** Login, logout, first-login password setup, and password reset. This report is separate from the DEV registration test report.  
**Build under test:** `feature/S1-DEV-04-reset-password`, commit `7c57a9b` (`Implement DEV04 password reset flow`)  
**Environment:** Local Next.js app with Supabase development Auth; test-account and project configuration must be confirmed before execution.

## Summary

**Happy-path result: PASS, per tester confirmation.** Login, logout, first-login password setup, and password reset were reported as successful and working.

This remains a draft because detailed step-by-step evidence and negative/edge-case execution results have not been recorded. The earlier `otp_expired` reset-link result is superseded by the successful retest reported by the tester.

## Test cases

| ID | Test | Expected result | Status / actual |
|---|---|---|---|
| AUTH-01 | Sign in with an approved, active QA account and correct credentials. | Login succeeds and routes to the expected signed-in page. | **Pass — reported successful and working.** |
| AUTH-02 | Sign in with an incorrect password or unknown test email. | Login is rejected with a clear, non-sensitive error; protected content is not shown. | Not Run |
| AUTH-03 | Try signing in as a pending, inactive, or blocked QA account. | Access is denied, the appropriate guidance is shown, and no usable session remains. | Not Run |
| AUTH-04 | Refresh the signed-in page, then open a protected route in a new tab. | Session behavior is consistent with the expected policy; unauthorized users do not see protected content. | Not Run |
| AUTH-05 | Sign out, then use browser Back and revisit a protected route. | User is signed out and protected content cannot be reopened without signing in. | **Pass — logout reported successful and working.** |
| SET-01 | Open `/set-password` without an authenticated eligible first-login session. | User is redirected or denied; password setup is not available. | Not Run |
| SET-02 | Submit a first-login password shorter than the minimum or with a confirmation mismatch. | Validation explains the problem and does not update the password. | Not Run |
| SET-03 | Submit matching valid passwords for an approved account requiring a first-login change. | Password is updated, the first-login requirement is cleared, the session ends, and the user returns to login. | **Pass — reported successful and working.** |
| SET-04 | Sign in after completing first-login password setup. | New password works; the previous password no longer works; setup is not required again. | **Pass — reported successful and working.** |
| RESET-01 | Request a reset link with a syntactically invalid email. | Browser validation prevents an invalid request. | Not Run |
| RESET-02 | Request a reset for a QA account using the development email provider. | A neutral confirmation is shown and a reset email is delivered to the QA inbox. | Not Run |
| RESET-03 | Open the newest, unused reset email link. | Recovery callback establishes a valid recovery session and displays the new-password form. | **Pass — successful retest reported.** |
| RESET-04 | Submit mismatched or too-short new password values from a valid recovery session. | Validation blocks the update and displays an actionable message. | Not Run |
| RESET-05 | Submit matching valid new passwords from a valid recovery session. | Password is updated, recovery session is ended, and the user returns to login. | **Pass — reset flow reported successful and working.** |
| RESET-06 | Try a reused or expired recovery link. | Link is rejected safely with guidance to request a new link; no password is changed. | Not Run |
| A11Y-01 | Keyboard-check login, logout, set-password, and reset-password forms and errors. | Controls have labels, visible focus, logical tab order, and accessible validation/status messages. | Not Run |
| UI-01 | Inspect auth pages at desktop and mobile viewport sizes. | Forms, controls, and status messages remain visible, readable, and usable without unintended horizontal overflow. | Not Run |

## Blockers and setup notes

- Use only synthetic QA identities and the team's development Supabase project. Do not use production accounts or share passwords, reset URLs, or tokens in this report.
- Successful login and password changes require known QA account states (approved/active, pending, inactive, blocked, and first-login password change as applicable).
- Password reset email testing requires a working development email provider/SMTP and the local callback URL `http://localhost:3000/auth/callback?next=/reset-password/confirm` in the Supabase Auth redirect allowlist.
- A prior reset-link attempt returned `otp_expired`; the tester subsequently reported that the flow worked successfully. Keep the full reset URL and token out of screenshots and reports.

## Completion criteria

Record each case as **Pass**, **Fail**, **Blocked**, or **Not Run** with actual result and sanitized evidence. Resolve or document the RESET-03 issue, execute all applicable cases in the isolated QA environment, and retest affected flows before treating this report as final.
