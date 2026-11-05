# Test Report: DEV02 User Registration

**Date:** 2026-11-04  
**Scope:** Registration page and `POST /api/register`  
**Build under test:** Current branch, commit `f8db1e6` (`Update DEV02 registration flow`)

## Summary

**Result: PASS for the locally verifiable scope.** The registration page and API passed the checks below. Successful UI submission and API validation errors were exercised with mocked API responses; no real user was created.

## Results

| ID | Test | Expected | Result |
|---|---|---|---|
| REG-01 | Open `/register` | Registration form is rendered with first name, last name, email, Register, and Google sign-in controls | PASS |
| REG-02 | Submit the empty form | Browser blocks submission for required fields | PASS |
| REG-03 | Enter an invalid email in the form | Browser blocks submission and does not send the request | PASS |
| REG-04 | Submit valid-shaped form data with a mocked successful API response | Request contains first name, last name, and email; success message appears and fields reset | PASS |
| REG-05 | Submit valid-shaped form data with a mocked API validation error | Inline email error appears and the email field is marked invalid | PASS |
| API-01 | POST with a foreign `Origin` | HTTP 403 | PASS |
| API-02 | POST malformed JSON | HTTP 400 | PASS |
| API-03 | POST a JSON array instead of an object | HTTP 400 | PASS |
| API-04 | POST with required fields missing | HTTP 400 | PASS |
| API-05 | POST with an invalid email | HTTP 400 | PASS |
| API-06 | POST a request body larger than the configured limit | HTTP 413 | PASS |
| CHK-01 | `npm run lint` | ESLint completes successfully | PASS |
| CHK-02 | `npm run typecheck` | TypeScript completes successfully | PASS |
| CHK-03 | `npm run build` | Production build completes successfully | PASS |

## Not covered

- Creating a real account and verifying the resulting Supabase Auth user and pending `User` profile were not tested. Doing so would write to the configured Supabase project.
- Google OAuth sign-in and its callback were not tested; these require a configured provider and controlled test account.
- Database trigger/profile behavior was not verified against a dedicated test database.

## Notes

The successful submission and API field-error UI checks used browser-side mocked responses, so they verify client behavior and request shape, not the live Supabase integration. No dedicated test script is configured in `package.json`; the checks above used the existing lint, typecheck, and build scripts plus local smoke tests. 
