# HOPE, Inc. ERP UI developer handoff

This handoff describes the shared CSS contract for the authentication screens,
dashboard, user management directory, and Rights dialog. The implementation is
static-wireframe ready but is structured so the same classes can be connected to
server-rendered templates or React components.

The high-fidelity palette is defined in `design/css/variables.css` and includes
Primary Dark Teal `#3D7584`, Secondary Muted Teal `#89B8BF`, Accent Soft Pink
`#FCAFC1`, Dark Accent `#000000`, and Clean White `#FFFFFF`. Use the custom
properties rather than repeating these values in page styles.

## 1. Class structure and naming conventions

The stylesheet uses semantic, component-oriented names with a small BEM-style
modifier pattern:

- **Global tokens:** CSS custom properties live in
  `design/css/variables.css`. Use tokens instead of page-specific color or
  spacing values.
- **Authentication:** `.auth-layout`, `.auth-card`, `.auth-header`,
  `.form-stack`, `.field`, `.form-actions`, `.status-note`, and
  `.auth-footer`.
- **Application shell:** `.erp-shell` is the two-column layout;
  `.erp-sidebar` contains navigation and `.erp-main` contains page content.
  Child elements use the `.erp-sidebar__brand`, `__nav`, `__label`, `__link`,
  and `__footer` convention.
- **Dashboard:** `.erp-header`, `.welcome-banner`, `.metric-grid`,
  `.metric-card`, and `.quick-actions`.
- **User management:** `.section-toolbar`, `.data-panel`, `.data-table`,
  `.table-actions`, `.button-compact`, `.role-pill`, and `.status-badge`.
- **Rights dialog:** `.rights-backdrop`, `.rights-dialog`, `.dialog-header`,
  `.dialog-close`, `.permission-grid`, `.permission-group`,
  `.permission-list`, and `.dialog-footer`.

Use classes for reusable visual roles and data attributes or accessible
attributes for business state. For example, use `aria-current="page"` for the
active sidebar link and `aria-invalid="true"` for invalid form fields.

## 2. Responsive breakpoints

The layout has three intentional ranges:

| Range | Viewport | Behavior |
| --- | --- | --- |
| Desktop | Above 1024px | Fixed-width sidebar, four metric columns, two-column Rights permission grid, generous page padding. |
| Tablet | 641px–1024px | Sidebar remains visible, page padding contracts, metric cards become two columns. |
| Mobile | 320px–640px | Sidebar stacks above content, navigation wraps, metrics and permission groups become single-column, tables use a scroll wrapper, and dialog actions stack. |

The `--touch-target-min` token is 44px. Do not reduce interactive hit areas
below this value even when the visual control is compact.

## 3. Component states

### Default

Use the surface, border, text, and spacing tokens from `variables.css`.
Controls should have a visible label or accessible name and predictable
alignment with neighboring controls.

### Hover and active

Hover should strengthen contrast or add the neutral surface treatment; it
must not shift layout. Active controls may use the existing subtle scale
transition, but destructive actions should still require confirmation in the
application layer.

### Focus

Keep the global `:focus-visible` treatment. Keyboard focus uses
`--focus-ring-width` and `--focus-ring-color`; never remove outlines without
replacing them with an equally visible treatment.

### Disabled and loading

Use the native `disabled` attribute for controls that cannot be activated.
Preserve the control label and dimensions while disabled. Loading behavior
belongs to the integration layer: prevent duplicate submission, preserve the
layout, and expose progress through an accessible status message.

### Validation and data states

Invalid fields should use `aria-invalid="true"` and an associated error
message. Tables should provide explicit loading, empty, no-results, and error
content rather than relying on color or blank space.

## 4. Rights Dialog layout

The dialog is composed in this order:

1. `.rights-backdrop` covers the page and provides the modal backdrop.
2. `.rights-dialog` is the centered, constrained dialog surface.
3. `.dialog-header` contains the accessible title, optional user email
   description, and `.dialog-close`.
4. `.permission-grid` contains `.permission-group` cards. Each group owns a
   heading and a `.permission-list` of checkbox labels.
5. `.dialog-footer` contains the primary Save Rights action and the Cancel
   action.

The dialog should use `role="dialog"`, `aria-modal="true"`,
`aria-labelledby`, and `aria-describedby` when a description is present.
When interactive behavior is added, trap focus inside the dialog, close on
the designated Cancel action and Escape where appropriate, and restore focus
to the element that opened it.

## 5. Backend integration guidelines

- Render real data into the existing semantic structures; do not encode
  permissions or roles in CSS class names alone.
- Keep authorization server-side. The UI may hide unavailable actions for
  clarity, but every dashboard route, user-management mutation, and rights
  update must be authorized by the backend.
- Map loading, empty, error, and success responses to explicit state elements
  with `role="status"` or an appropriate live-region strategy.
- Preserve form labels, `name` attributes, server validation messages, and
  stable IDs when replacing wireframe placeholders with framework controls.
- For the Rights dialog, submit a normalized permission set, validate the
  target user and module permissions on the server, and return a clear
  success or failure response before closing the dialog.
- Keep table sorting, filtering, pagination, and row actions keyboard
  accessible. Use progressive enhancement so the static layout remains useful
  before client-side behavior loads.
- Test the three breakpoint ranges, keyboard navigation, focus restoration,
  permission-denied responses, and slow/error network states before release.
