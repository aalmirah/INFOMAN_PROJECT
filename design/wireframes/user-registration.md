# User Registration Screen Wireframe & Implementation Handoff

- **Layout & Container:** Centered card modal over app background (`var(--color-bg-cream)`) with responsive padding (`var(--layout-padding-mobile)` to `var(--layout-padding-desktop)`).
- **Form Fields & Explicit Behavior (Tokens Used):**
  - Full Name (`<input type="text">`, height: `var(--control-height)`): Requires min 2 characters, alphanumeric check.
  - Email Address (`<input type="email">`): Validates standard RFC 5322 regex format with real-time blur check.
  - Assigned Role (`<select>` dropdown with options: Superadmin, Admin, User): Defaults to User role.
  - Department (`<select>` dropdown with dynamic loading): Populates options based on selected organization unit; displays inline loading skeleton if data is pending, and shows explicit error message "Department is required" if left unselected upon submission.
  - Temporary Password (`<input type="password">` with show/hide toggle using `var(--touch-target-min)`): Requires min 8 chars, 1 uppercase, and 1 number.
- **Required-Field Indicators & Validation States:** 
  - Required fields marked with red asterisk (`var(--color-danger-600)`).
  - Inline error messages appear immediately below invalid fields using `var(--color-danger-600)` text color and `var(--focus-ring-width)` error borders.
- **Actions & Buttons:**
  - Primary Button: "Register Employee Account" (`var(--color-primary-600)`, height `var(--control-height)`)
  - Secondary Button: "Cancel" (`var(--color-secondary-600)`, closes modal)
- **Accessibility & Focus:** Focus trapping enabled via JS query selectors, using `var(--focus-ring-color)` for focus rings and `var(--modal-backdrop)` for overlays.