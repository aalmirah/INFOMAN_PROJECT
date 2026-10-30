# ERP Dashboard Layout Wireframe & Implementation Handoff

- **Layout & Structure:** 
  - Sidebar navigation on the left (fixed width: `var(--sidebar-width)`, background: `var(--color-sidebar-dark)`). Supports collapsing to 64px.
  - Top header bar with global search, notifications icon, and user profile dropdown.
  - Main content canvas (`var(--color-bg-cream)`) with responsive padding (`var(--layout-padding-mobile)` to `var(--layout-padding-desktop)`).
- **Metrics Summary Cards:** 
  - Total Employees (248), Active Systems (12/12), Pending Approvals (3). Styled using `var(--color-bg-surface)` and `var(--shadow-md)`.
- **Data Table & Activity Log (Complete Interaction Flow):**
  - **Columns:** Timestamp, User, Action, Module, Status.
  - **Row States & Hover:** Rows highlight on hover using `var(--color-sidebar-hover)`. Archived/soft-deleted rows use `var(--color-deleted-shade)`.
  - **Interactive Actions:** Each row features View, Edit, and Delete buttons (enforcing min size `var(--touch-target-min)`).
  - **Step-by-Step Deletion Flow:** Clicking "Delete" triggers a confirmation modal with focus trapping (`var(--modal-backdrop)`), requiring password re-entry before soft-deleting the entry.
  - **Empty, Loading & Error States:** Skeleton pulse loaders during fetch; empty state illustration when logs are empty; dismissible alert banner upon fetch failure.
- **Search & Real-time Filters:** Real-time search input box and status filter tabs (All, Active, Blocked) with instant count badge updates.
- **Role-Based Permissions (RBAC):** Action buttons like Delete are completely hidden or disabled (30% opacity) for standard "User" roles, and fully accessible only for "Admin" and "Superadmin" roles.
- **Responsive Adaptation:** Automatically switches from multi-column layout to horizontal scrollable table containers at `var(--breakpoint-mobile)` (640px).