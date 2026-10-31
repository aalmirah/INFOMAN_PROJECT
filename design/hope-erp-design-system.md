# HOPE, Inc. ERP Design System

This is the refined HOPE, Inc. ERP foundation. It preserves the existing token aliases and wireframe conventions while making the modern slate/blue palette explicit through the canonical variables in [`css/variables.css`](css/variables.css). The companion [visual style guide](style-guide.html) provides a browser-previewable component sheet.

## 1. Design principles

- **Operational clarity:** Make status, ownership, permissions, and next actions obvious.
- **Accessible by default:** Never communicate meaning through color alone; pair color with text, icons, or shape.
- **Token-first implementation:** Use the canonical CSS variables below; existing `*-600` variables are compatibility aliases.
- **Responsive density:** Preserve a readable minimum of `12px` for user-facing text and a minimum `var(--touch-target-min)` hit area.

## 2. Canonical color tokens

| Token | Hex value | Usage | Contrast guidance |
|---|---|---|---|
| `--color-primary` | `#1E3A8A` | Primary actions, links, selected navigation | White text: `10.36:1`, pass |
| `--color-primary-hover` | `#172554` | Primary hover | White text: `14.36:1`, pass |
| `--color-primary-pressed` | `#1E293B` | Pressed/active primary state | White text: `14.36:1`, pass |
| `--color-secondary` | `#0EA5E9` | Information accents and secondary actions | White text: `2.77:1`, fail; use `--text-primary` |
| `--color-secondary-hover` | `#0284C7` | Secondary hover | Use dark text for normal labels |
| `--color-secondary-pressed` | `#0369A1` | Secondary pressed state | Verify text pairing per usage |
| `--color-sidebar-dark` | `#0F172A` | Sidebar background | White text: `17.85:1`, pass |
| `--bg-canvas` | `#F8FAFC` | Application page background | `--text-primary` on canvas: `17.06:1`, pass |
| `--bg-surface` | `#FFFFFF` | Cards, forms, modals, tables | `--text-primary` on surface: `17.85:1`, pass |
| `--border-color` | `#E2E8F0` | Dividers and control borders | Use as non-text UI only; do not use as text |
| `--text-primary` | `#0F172A` | Headings, body text, primary labels | On surface: `17.85:1`, pass |
| `--text-secondary` | `#64748B` | Supporting text and metadata | On surface: `4.76:1`, pass |
| `--text-disabled` | `#94A3B8` | Disabled text only | Not a normal-text contrast color; pair with state semantics |
| `--status-active` | `#10B981` | Active/success status | White text: `2.54:1`, fail; use dark text |
| `--status-danger` | `#EF4444` | Inactive, blocked, delete, error | White text: `3.76:1`, fail; use dark text |
| `--status-warning` | `#F59E0B` | Pending and warning status | White text: `2.15:1`, fail; use dark text |
| `--color-info` | `#0EA5E9` | Informational status and focus accent | White text: `2.77:1`, fail; use dark text |
| `--color-role-superadmin` | `#7C3AED` | Superadmin role pill | White text: `5.70:1`, pass |
| `--color-role-admin` | `#0284C7` | Admin role pill | White text: `4.10:1`, fail for normal text; use dark text |
| `--color-role-user` | `#475569` | User role pill | White text: `7.58:1`, pass |
| `--color-deleted-shade` | `#FEF2F2` | Soft-deleted row background | `--text-primary` on shade: `16.32:1`, pass |

Ratios use the WCAG relative-luminance formula. Normal text requires `4.5:1`, large text requires `3:1`, and non-text UI indicators require `3:1` against adjacent colors. The failed white-text combinations above are intentional flags and must use the approved dark-text treatment.

## 3. Typography

Use the free web font Inter with the fallback stack in `--font-family-base`. User-facing text must not be smaller than `12px`.

| Role | Token | Weight | Size/line height | Usage |
|---|---|---:|---|---|
| Page title | `--font-page-title` | 700 | `1.5rem/2rem` | Page headings |
| Section title | `--font-section-title` | 600 | `1.125rem/1.5rem` | Card and section headings |
| Table header | `--font-table-header` | 600 | `0.75rem/1rem` | Data-table labels |
| Body | `--font-body` | 400 | `0.875rem/1.25rem` | Default application text |
| Caption | `--font-caption` | 500 | `0.75rem/1rem` | Metadata and stamps |
| Button | `--font-button` | 600 | `0.875rem/1.25rem` | Action labels |

## 4. Spacing, grid, shape, and elevation

- **Base scale:** Use `--space-1` through `--space-8` as the 4px-based spacing scale.
- **Grid:** Use `--grid-columns` columns with `--grid-gutter`; constrain application content to `--content-max-width`.
- **Sidebar:** Use `--sidebar-width` expanded and `--sidebar-width-collapsed` collapsed.
- **Breakpoints:** Mobile below `--breakpoint-mobile`; tablet from `--breakpoint-mobile` through `--breakpoint-desktop`; desktop above `--breakpoint-desktop`.
- **Radii:** Use `--radius-sm` for controls, `--radius-md` for cards, and `--radius-pill` for badges and role pills.
- **Elevation:** Use `--shadow-sm` for subtle grouping, `--shadow-md` for cards, and `--shadow-lg` for dialogs.
- **Motion:** Use `--motion-press-scale` for button press feedback. Respect reduced-motion preferences.

## 5. Component standards

### Buttons

- **Anatomy:** Optional icon, label, and container.
- **Variants:** Primary, secondary, danger, ghost, and icon.
- **Sizes:** Compact, default, and prominent sizes must never reduce the `var(--touch-target-min)` hit area.
- **States:** Default, hover, focus, active, disabled, error, and loading.
- **Do:** Use a clear verb, preserve focus indicators, disable duplicate submission while loading.
- **Do not:** Use two competing primary actions, use color alone, or make an icon-only control smaller than its hit area.

### Inputs and controls

- **Anatomy:** Label, control, helper/error text, and optional trailing action.
- **Text/password input:** Use `--control-height`; password fields provide a labeled show/hide control.
- **Select:** Use an accessible native select or equivalent keyboard-operable control.
- **Checkbox:** Support checked, unchecked, indeterminate, and disabled-because-parent-off states.
- **Toggle:** Use for immediate binary settings; include a visible label and announce state changes.
- **States:** Default uses `--border-color`; focus uses `--color-primary` plus the focus ring; error uses `--status-danger` with `aria-invalid="true"` and `aria-describedby`; loading preserves layout.
- **Do:** Keep labels visible and associate every error with its control.
- **Do not:** Use placeholders as labels or rely on a red border without an error message.

### Status badges and role pills

- **Active:** `--status-active`.
- **Inactive/Blocked:** `--status-danger`.
- **Pending:** `--status-warning`.
- **Roles:** `--color-role-superadmin`, `--color-role-admin`, `--color-role-user`.
- Every badge includes an icon and/or text label. Use dark text on the flagged status backgrounds for normal-size labels.

### Data table

- **Anatomy:** Accessible caption, header, sortable columns, rows, selection state, row actions, pagination, search box, and status tabs with counts.
- **States:** Default, hover using `--color-sidebar-hover`, selected using a distinct surface treatment, loading skeleton, empty state, no-results state, error/retry state, and soft-deleted rows using `--color-deleted-shade`.
- **Mobile:** Use a horizontally scrollable wrapper below `--breakpoint-mobile`; never clip required data or actions.
- **Do:** Keep row actions keyboard operable and confirm destructive actions.
- **Do not:** Hide status or selection information in color alone.

### Modal/dialog

- **Anatomy:** `role="dialog"`, `aria-labelledby`, optional `aria-describedby`, backdrop, title, body, and sticky footer.
- **Actions:** Sticky footer uses Save/Confirm as primary and Cancel as secondary.
- **Focus:** Move focus into the dialog, trap Tab and Shift+Tab, close on Escape where appropriate, and restore focus to the trigger.
- **Backdrop:** Use `--modal-backdrop` and block background interaction.

### Sidebar navigation and Quick Action card

- **Sidebar items:** Default, active, and disabled/greyed states must include text labels and current-page semantics.
- **Quick Action card:** Uses `--bg-surface`, `--border-color`, `--radius-md`, and a clear action label; keep the entire card keyboard accessible when it is actionable.

### Toasts, alerts, and inline errors

- **Success:** `--status-active`; **error:** `--status-danger`; **info:** `--color-info`; **warning:** `--status-warning`.
- Use `aria-live="polite"` and `role="status"` for routine updates. Use assertive announcements only for urgent errors.
- Inline errors stay adjacent to the field, use `aria-describedby`, and remain visible until corrected or dismissed.
- Toasts never steal focus; persistent errors include recovery or retry actions.

### Confirmation dialogs

- **Delete:** State the record and irreversible/soft-delete effect; require explicit Confirm and Cancel.
- **Block:** State the account and access impact; require explicit Confirm and Cancel.
- Both flows trap focus, expose a labeled dialog, and announce success or failure.

## 6. Iconography and audit stamps

- Use one consistent outline icon family with a 1.5–2px visual weight.
- Icons must have accessible names when interactive; decorative icons use `aria-hidden="true"`.
- Pair destructive icons with text or a tooltip that is keyboard accessible.
- Audit stamp pattern: `CREATED / EDITED / DELETED · {user} · {date}`.
- Use a localized, unambiguous date format and expose the underlying date in machine-readable markup where implemented.
