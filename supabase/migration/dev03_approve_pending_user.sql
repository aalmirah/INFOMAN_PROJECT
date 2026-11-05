-- DEV03: manually approve one pending account while no Superadmin UI exists.
--
-- Replace the email below with the exact registered email before running.
-- Review the returned row. Zero rows means the account was not pending, was
-- blocked/inactive, or the email did not match; do not broaden the WHERE clause
-- without first verifying the intended account.
-- The user remains signed in on the same browser session and the app detects
-- approval, then routes them to first-time password setup. No email is sent.

UPDATE public.profiles
SET
  approval_status = 'approved',
  must_change_password = true
WHERE lower(email) = lower(btrim('REPLACE_WITH_EXACT_USER_EMAIL'))
  AND approval_status = 'pending'
  AND is_active = true
  AND is_blocked = false
RETURNING
  id,
  email,
  role,
  approval_status,
  is_active,
  is_blocked,
  must_change_password;
