# Authentication wireframes

Low-fidelity structural wireframes for Task 1. These layouts use real labels and copy only. They intentionally omit
decorative treatment and are static, non-functional presentation wireframes.

## Shared behavior

- **Desktop:** centered form card, maximum width 30rem, with the logo and
  heading above the form.
- **Mobile:** single-column card with 16px page gutters; controls remain full
  width and retain a minimum 44px touch target.
- **Controls:** inputs, buttons, and link labels are visual placeholders only;
  they do not submit, navigate, validate, or change state.

## 1. Login

### Desktop

```text
+--------------------------------------------------+
| [H] HOPE Inc. ERP                                |  1 Home link
|                                                  |
|             Sign in to your account              |  2 Page heading
| Enter your credentials to access HOPE Inc. ERP.  |
|                                                  |
| Email address *                                  |
| [ you@company.com                         ]      |  3 Initial focus
|                                                  |
| Password *                         [Show]        |
| [                                  ]              |
|                                                  |
| [ ] Remember me              Forgot password?    |  4 / 5
|                                                  |
| [                 Sign In                  ]     |  6 Submit
| ---------------------- OR --------------------- |
| [          Continue with Google            ]     |  7 Secondary sign-in
|                                                  |
| Don't have an account? Register                 |  8
+--------------------------------------------------+
```

### Mobile

```text
+------------------------+
| [H] HOPE Inc. ERP      |
|                        |
| Sign in to your account|
| Enter your credentials |
|                        |
| Email address *        |
| [ you@company.com    ] |
| Password *       [Show]|
| [                    ] |
| [ ] Remember me       |
| Forgot password?      |
| [ Sign In            ] |
| -------- OR --------- |
| [ Continue with Google]|
| Register              |
+------------------------+
```

**Callouts**

1. Home link returns to the landing page.
2. Keep the heading and subtitle stable across error and loading states.
3. Focus email on first open.
4. Remember Me is optional and must not be preselected.
5. Forgot password links to the Forgot password request screen.
6. On submit, use `Signing in...`; restore `Sign In` after an error.
7. Google sign-in is a separate action from the email form.
8. Register link opens the registration screen.

### States and validation

| State | Structural treatment and copy |
|---|---|
| Default | Empty email and password fields. |
| Email invalid | `Enter a valid email address.` |
| Missing password | `Enter your password.` |
| Credentials rejected | Neutral alert: `We couldn't sign you in with those details. Check your email and password and try again.` |
| Loading | Button label: `Signing in...`; controls disabled. |
| Blocked account | `This account is currently unavailable. Contact your administrator for help.` Do not disclose internal block rules or account existence. |
| Success | Navigate to Dashboard; no success message is required on the login screen. |

## 2. Register

### Desktop

```text
+--------------------------------------------------+
| [H] HOPE Inc. ERP                                |
|                                                  |
|              Create your account                |
|                 Join Hope Inc. ERP              |
|                                                  |
| First name *                 Last name *         |
| [                         ]  [                ]  |
| Work email *                                    |
| [ you@company.com                         ]      |
| Password *                         [Show]        |
| [                                  ]              |
| Confirm password *                 [Show]        |
| [                                  ]              |
| [ ] I agree to the HOPE Inc. ERP terms.         |
|                                                  |
| [                 Register                 ]     |
| ---------------------- OR --------------------- |
| [          Continue with Google            ]     |
|                                                  |
| Already have an account? Sign in                |
+--------------------------------------------------+
```

### Mobile

```text
+------------------------+
| [H] HOPE Inc. ERP      |
| Create your account    |
| Join Hope Inc. ERP     |
| First name *           |
| [                    ] |
| Last name *            |
| [                    ] |
| Work email *           |
| [ you@company.com    ] |
| Password *       [Show]|
| Confirm password [Show]|
| [ ] I agree to terms  |
| [ Register           ] |
| -------- OR --------- |
| [ Continue with Google]|
| Sign in               |
+------------------------+
```

**Callouts**

1. Focus first name on first open.
2. Desktop uses a two-column name row; mobile stacks the fields.
3. New accounts are created as **User** and require administrator approval.
4. Confirm password is validated against the password field.
5. Terms must be checked before submission.

### States and validation

| State | Structural treatment and copy |
|---|---|
| Default | Empty fields; terms unchecked. |
| Missing first/last name | `Enter your first name.` / `Enter your last name.` |
| Email invalid | `Enter a valid work email address.` |
| Password invalid | `Use at least 12 characters, including uppercase, lowercase, a number, and a symbol.` |
| Password mismatch | `Passwords do not match.` |
| Terms missing | `Accept the terms to create an account.` |
| Static | Register and Google controls are shown as disabled wireframe buttons. |
| Success | `Your account was created and is awaiting administrator approval.` Provide `Go to Sign In`. |

## 3. Forgot password

### Request state: desktop and mobile

```text
Desktop: centered card, width 30rem
Mobile: same order, one column, 16px gutters

[H] HOPE Inc. ERP
Forgot password?
Enter your account email and we'll send a reset link.

Email address *
[ you@company.com                         ]  <- initial focus
[ Send Reset Link ]
[ Back to Sign In ]
```

**Callouts**

1. Always use neutral wording; never confirm whether the email is registered.
2. The Send Reset Link and Back to Sign In controls are static placeholders.

### Check-your-email confirmation state

```text
Check your email
If an account matches that email, we've sent instructions to reset
your password. Check your inbox and spam folder.

[ Send again ]     [ Back to Sign In ]
```

Resending uses `Sending...`; after success, use `Reset instructions sent.
You can request another email in a moment.` Rate-limit messaging must not
reveal account existence.

### Request states and validation

| State | Copy |
|---|---|
| Missing email | `Enter your email address.` |
| Invalid email | `Enter a valid email address.` |
| Service error | `We couldn't send the reset email right now. Try again shortly.` |
| Static | Request and confirmation states are displayed together for review. |
| Success | `If an account matches that email, we've sent instructions to reset your password.` |

## 4. Set/reset new password

Reached only from a valid emailed reset link.

Implementation reference: [set-password.html](set-password.html).

These are static, non-functional presentation wireframes. Buttons, inputs,
and link labels are intentionally not connected to navigation, submission,
validation, or JavaScript behavior.

### Desktop and mobile structure

```text
Set a new password
Choose a strong password for your HOPE Inc. ERP account.

New password *                         [Show]
[                                           ] <- initial focus

Password requirements
[ ] At least 6 characters

Confirm password *                     [Show]
[                                           ]

[ Save password ]
[ Back to Sign In ]
```

On mobile, the requirements remain directly below New password and above
Confirm password.

**Callouts**

1. Focus New password when the link opens.
2. Checklist items are static grayscale placeholders.
3. Save and Back to Sign In are disabled or non-interactive wireframe controls.

### Validation and states

| State | Copy |
|---|---|
| Empty new password | `Enter a new password.` |
| Rule failure | `Password must meet all listed requirements.` |
| Empty confirmation | `Confirm your new password.` |
| Mismatch | `Passwords do not match.` |
| Static | Password requirements, confirmation, and Save controls are shown for layout review. |

## 5. Expired or invalid reset link

```text
Reset link unavailable
This reset link has expired or is no longer valid.
Request a new link to continue.

[ Request a new reset link ]  <- initial focus
[ Back to Sign In ]
```

The request action opens the neutral Forgot password request state. Do not
display token details, expiry timestamps, or whether the original account
exists.

## Flow

```text
Landing
  +--> Register --> Account created / approval pending
  |                    |
  |                    +--> Login
  |
  +--> Login --> Dashboard
              |
              +--> Forgot password --> Check your email
                                      |
                                      +--> Valid link --> Set/reset password --> Login
                                      |
                                      +--> Expired/invalid --> Request new link
```

## Microcopy

| Screen | Element | Label / placeholder / helper / error |
|---|---|---|
| Login | Email label | `Email address` |
| Login | Email placeholder | `you@company.com` |
| Login | Password label | `Password` |
| Login | Password action | `Show` / `Hide` |
| Login | Remember checkbox | `Remember me` |
| Login | Forgot link | `Forgot password?` |
| Login | Submit | `Sign In` / `Signing in...` |
| Login | Google action | `Continue with Google` |
| Login | Neutral error | `We couldn't sign you in with those details. Check your email and password and try again.` |
| Login | Blocked account | `This account is currently unavailable. Contact your administrator for help.` |
| Register | Name labels | `First name`, `Last name` |
| Register | Email label/placeholder | `Work email`, `you@company.com` |
| Register | Password helper | No password field is shown in the static register wireframe. |
| Register | Confirm error | `Passwords do not match.` |
| Register | Account note | `New accounts are created as User and require administrator approval.` |
| Register | Terms | `I agree to the HOPE Inc. ERP terms.` |
| Register | Submit | `Register` / `Creating account...` |
| Forgot | Email label/placeholder | `Email address` / `you@company.com` |
| Forgot | Submit | `Send Reset Link` / `Sending reset link...` |
| Forgot | Neutral success | `If an account matches that email, we've sent instructions to reset your password.` |
| Forgot | Back link | `Back to Sign In` |
| Reset | New password label | `New password` |
| Reset | Confirm label | `Confirm password` |
| Reset | Checklist | `At least 6 characters` |
| Reset | Submit | `Save new password` |
| Reset | Invalid link | `This reset link has expired or is no longer valid. Request a new link to continue.` |
