# HOPE, Inc. ERP - Component System Specifications & Implementation Guidance

This document defines the token usage, anatomy, states, interaction behavior, and accessibility requirements for the core ERP components. Component implementations must use the CSS custom properties defined in [`css/variables.css`](css/variables.css).

---

## 1. Buttons & Touch Targets

- **Anatomy:** Optional leading icon, text label, and button container.
- **Variants:** Primary, Secondary, Danger, Ghost, and Icon-only.
- **Minimum target:** Every button and interactive control must provide at least `var(--touch-target-min)` for both width and height. Icon-only buttons may use a smaller visual icon inside that hit area.
- **Default:** Use the variant's semantic background and text tokens. The primary variant uses `var(--color-primary-600)`.
- **Hover:** Primary controls use `var(--color-primary-700)`; other variants use their corresponding darker or lighter semantic token.
- **Focus:** Show a `var(--focus-ring-width)` outline using `var(--focus-ring-color)` for keyboard focus. Do not remove the focus indicator.
- **Active:** Apply the existing interaction scale or motion token; do not introduce a hardcoded dimension or color.
- **Disabled:** Apply the documented disabled treatment, prevent activation, retain an accessible name, and expose the disabled state to assistive technology. Do not rely on opacity alone to communicate state.
- **Loading:** Replace the label with a status indicator, preserve the button's dimensions, prevent duplicate activation, and announce the loading state.

---

## 2. Form Controls, Inputs & Selects

- **Anatomy:** Visible label, control container, optional helper text, and associated error message.
- **Sizing:** Inputs, selects, textareas, checkboxes, and radio-button hit areas use `var(--control-height)` and never fall below `var(--touch-target-min)`.
- **Default:** Use `var(--color-border-subtle)` for the control border and the appropriate surface and text tokens for the control content.
- **Focus:** On keyboard focus, use `var(--color-primary-600)` for the border and a visible `var(--focus-ring-width)` ring using `var(--focus-ring-color)`.
- **Error:** Use `var(--color-danger-600)` for the border and error text, set `aria-invalid="true"`, and associate the message with the control through `aria-describedby`.
- **Required fields:** Expose required status semantically and show a visible required indicator that is not the only source of information.
- **Selects and options:** Support keyboard navigation and preserve the native or accessible select semantics. Do not communicate selection using color alone.

---

## 3. Data Tables

- **Anatomy:** Caption or accessible name, header row, sortable column controls where applicable, data rows, row actions, and pagination.
- **Row hover:** Highlight interactive rows using `var(--color-sidebar-hover)` without reducing text or control contrast.
- **Soft delete:** Apply `var(--color-deleted-shade)` to archived or soft-deleted rows and provide a text or icon indicator in addition to the background color.
- **States:** Provide loading skeletons, an empty state with a useful next action, an error state with retry, and a no-results state for filtered data.
- **Actions:** Row actions must use `var(--touch-target-min)`, have accessible names, and require confirmation for destructive operations.
- **Keyboard access:** Sort controls, pagination, row actions, and expandable rows must be reachable and operable by keyboard with `var(--focus-ring-color)` focus treatment.
- **Mobile:** Wrap the table in a horizontally scrollable container below `var(--breakpoint-mobile)` or switch to a stacked-card presentation. Do not clip required data or actions.

---

## 4. Status Badges & Role Pills

- **Anatomy:** Pill-shaped container using `var(--radius-pill)`, an optional status icon, and a text label. Never rely on color alone.
- **Status variants:**
  - **Active:** `var(--color-success-600)` with an accessible text/icon treatment.
  - **Inactive or Blocked:** `var(--color-danger-600)` with an accessible text/icon treatment.
  - **Pending:** `var(--color-warning-600)` with an accessible text/icon treatment.
- **Role variants:**
  - **Superadmin:** `var(--color-role-superadmin)`.
  - **Admin:** `var(--color-role-admin)`.
  - **User:** `var(--color-role-user)`.
- **Contrast:** Pair badge text with an approved accessible background treatment from the contrast matrix; do not use failing foreground/background combinations for normal text.

---

## 5. Modals & Dialogs

- **Anatomy:** Backdrop, modal container, accessible title, optional description, body content, and action footer.
- **Backdrop:** Use `var(--modal-backdrop)` and block interaction with the page behind the dialog.
- **Opening:** Move focus to the first meaningful control or the dialog heading and preserve the element that triggered the dialog.
- **Focus trap:** Keep `Tab` and `Shift+Tab` within the dialog's focusable elements. Do not allow focus to escape while the dialog is open.
- **Closing:** Close on the designated Cancel action and `Escape` where appropriate. Restore focus to the triggering element after close.
- **Semantics:** Use the dialog role with `aria-labelledby` and, when descriptive content exists, `aria-describedby`.
- **Destructive actions:** Require explicit confirmation and provide clear success and failure feedback.

---

## 6. Alerts & Toasts

- **Anatomy:** Semantic icon, message text, and optional close or retry action. The message must remain understandable without color.
- **Variants:** Success uses `var(--color-success-600)`, Error/Danger uses `var(--color-danger-600)`, Warning uses `var(--color-warning-600)`, and Info uses `var(--color-info-600)`.
- **Live regions:** Use `aria-live="polite"` and `role="status"` for non-urgent updates. Use an appropriate assertive announcement only for urgent errors that require immediate attention.
- **Behavior:** Toasts must not steal focus, must remain available long enough to read, and must provide a keyboard-accessible dismissal action. Persistent errors must remain visible until resolved or dismissed.
- **Loading and errors:** Announce state changes without moving focus unexpectedly, and provide retry or recovery actions where applicable.