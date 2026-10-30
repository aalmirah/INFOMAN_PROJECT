# User Registration Screen Wireframe

- **Layout & Container:** Centered card modal over app background (`var(--color-bg-cream)`) with responsive padding (`var(--layout-padding-mobile)` to `var(--layout-padding-desktop)`).
- **Form Fields & Control Types (Tokens Used):**
  - Full Name (`<input type="text">`, height: `var(--control-height)`)
  - Email Address (`<input type="email">`)
  - Assigned Role (`<select>` dropdown with options: Superadmin, Admin, User)
  - Temporary Password (`<input type="password">` with show/hide toggle using `var(--touch-target-min)`)
- **Required-Field Indicators & Validation:** Red asterisk using `var(--color-danger-600)` and inline error messaging.
- **Actions & Buttons:**
  - Primary Button: "Register Employee Account" (styled with `var(--color-primary-600)`, height `var(--control-height)`)
  - Secondary Button: "Cancel" (`var(--color-secondary-600)`)
- **Accessibility & Focus:** Focus trapping enabled via JS query selectors, using `var(--focus-ring-color)` for focus rings and `var(--modal-backdrop)` for overlays.