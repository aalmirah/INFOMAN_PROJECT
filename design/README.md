# HOPE, Inc. ERP Design System

This folder contains the shared CSS tokens, component guidance, and screen wireframes for the HOPE, Inc. ERP application. Implementations must use the custom properties in [`css/variables.css`](css/variables.css) and follow the component behavior in [`components.md`](components.md).

## 1. Design-token architecture

### Color tokens

The color palette is defined in `:root` in [`css/variables.css`](css/variables.css):

- **Primary:** `--color-primary-600`, `--color-primary-700`, `--color-primary-50`
- **Secondary:** `--color-secondary-600`, `--color-secondary-700`, `--color-secondary-50`
- **Sidebar:** `--color-sidebar-dark`, `--color-sidebar-hover`
- **Background and border:** `--color-bg-cream`, `--color-bg-surface`, `--color-border-subtle`
- **Text:** `--color-text-primary`, `--color-text-secondary`, `--color-text-disabled`
- **Semantic status:** `--color-success-600`, `--color-danger-600`, `--color-warning-600`, `--color-info-600`
- **Roles:** `--color-role-superadmin`, `--color-role-admin`, `--color-role-user`
- **Archived rows:** `--color-deleted-shade`

Status and role meaning must never be conveyed by color alone. Use text and/or icons, and use an accessible foreground/background pairing for normal text.

### Typography tokens

- **Font family:** `--font-family-base`
- **Text styles:** `--font-page-title`, `--font-section-title`, `--font-table-header`, `--font-body`, `--font-caption`, `--font-button`

### Spacing and layout tokens

- **Spacing:** `--space-1`, `--space-2`, `--space-3`, `--space-4`, `--space-6`, `--space-8`
- **Layout dimensions:** `--sidebar-width`, `--content-max-width`
- **Responsive breakpoints:** `--breakpoint-mobile`, `--breakpoint-desktop`
- **Responsive padding:** `--layout-padding-mobile`, `--layout-padding-tablet`, `--layout-padding-desktop`

### Elevation, shape, and interaction tokens

- **Radii:** `--radius-sm`, `--radius-md`, `--radius-pill`
- **Shadows:** `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- **Interactive sizing:** `--touch-target-min`, `--control-height`
- **Focus and overlays:** `--focus-ring-width`, `--focus-ring-color`, `--modal-backdrop`

## 2. Responsive rules

- **Mobile:** Below `var(--breakpoint-mobile)`.
- **Tablet:** From `var(--breakpoint-mobile)` through `var(--breakpoint-desktop)`.
- **Desktop:** Above `var(--breakpoint-desktop)`, capped by `var(--content-max-width)`.
- **Touch targets:** Interactive controls use at least `var(--touch-target-min)` for width and height.
- **Tables:** Below `var(--breakpoint-mobile)`, use horizontal scrolling or a stacked-card presentation without clipping required data or actions.

## 3. Component specifications

[`components.md`](components.md) is the authoritative component guide. It covers:

1. **Buttons and touch targets:** Variants, default/hover/focus/active/disabled/loading states, and minimum interactive sizing.
2. **Form controls, inputs, and selects:** Labels, helper/error text, `var(--control-height)`, focus styling, validation, required fields, and keyboard operation.
3. **Data tables:** Accessible structure, row hover, soft-delete shading, loading/empty/error states, actions, pagination, keyboard access, and mobile adaptation.
4. **Status badges and role pills:** Semantic status and role variables, pill shape, and non-color status indicators.
5. **Modals and dialogs:** Backdrop, focus trapping, keyboard close behavior, focus restoration, dialog labeling, and destructive-action confirmation.
6. **Alerts and toasts:** Semantic variants, `aria-live="polite"`/`role="status"`, dismissal, persistence, and recovery behavior.

## 4. Screen wireframes

- [User registration screen](wireframes/user-registration.md): Modal layout, form controls, validation, actions, responsive behavior, and accessibility guidance.
- [ERP dashboard](wireframes/dashboard.md): Sidebar, header, metric cards, activity table, row actions, filters, states, permissions, and responsive behavior.
