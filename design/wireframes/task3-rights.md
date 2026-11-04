# Task 3: Rights dialog and interaction handoff

## Rights dialog

The dialog edits one User: **User Name — user@hope.example**. Its header is
sticky and shows `Selected X of 36`. Its footer is sticky with **Save Rights**
and **Cancel**. Closing with unsaved changes opens a warning:
“You have unsaved rights changes. Discard them?”

### Rights groups (36 total)

| Group | Rights |
|---|---:|
| Customer | 3 |
| Product | 6 |
| Human Resources | 13 |
| Sales | 7 |
| Reports | 7 |
| **Total** | **36** |

Each group has a module toggle and **All / None** controls. When the module
toggle is off, its child checkboxes are disabled and visually muted. The
group label is announced as a `fieldset` legend, and each child uses a
specific label, for example “Customer — View customers”.

### Recommended layout

Use the **two-column checkbox grid** for desktop: it shortens the 36-right
list while keeping every permission visible for scanning and keyboard use.
Collapse to one column below 640px. An accordion alternative can reduce
scrolling, but it hides rights, makes the selected count harder to scan, and
adds expansion state to the keyboard model; use it only if future groups
grow substantially.

## Dashboard callouts and states

- **A1/B1/C1:** expanded and collapsed sidebars; the current item has a
  non-color active outline.
- **A2:** top bar exposes the role pill, user menu, and Sign out.
- **A3:** four stat cards retain placeholder values until data is available.
- **A4:** Quick Actions use equal cards; ungranted User actions are greyed and
  say “Ask an Admin for access”.
- Default, hover, and focus use the same structure; focus has a visible dark
  outline and never relies on color alone.
- Loading uses skeleton rows/cards; error provides a retry message; saving
  disables dialog controls and changes Save Rights to “Saving…”; saved shows
  “Rights saved” in a polite status region.

## User Management callouts and states

- **U1:** search and Add User are adjacent, with a labeled search input.
- **U2:** desktop uses the five-column table; mobile converts each row to a
  labeled card.
- **U3:** Block is destructive-looking but reversible; confirmation names the
  account and explains the effect.
- **U4:** Rights and Edit actions remain in the row/card action group.
- Loading, empty, error, default, hover, focus, saving, and saved states are
  represented in the page annotations.

## Keyboard and screen-reader behavior

1. On page open, focus goes to Search users on User Management and the first
   meaningful dashboard control.
2. Tab order is top bar, sidebar navigation, page controls, then row actions.
3. Rights opens a modal dialog with `aria-labelledby` for the user heading and
   `aria-describedby` for the selected-count/status text.
4. Focus is trapped within the dialog. `Esc` requests close; if dirty, show
   the discard warning. Cancel restores focus to the Rights button.
5. Group toggles and All/None controls precede their child checkboxes in each
   fieldset. Announce disabled children as unavailable when a module is off.
6. Save announces “Rights saved” and returns focus to the originating Rights
   button; errors remain in the dialog and move focus to the error summary.

## Open UX questions and risks

- Should Admins be allowed to edit other Admin accounts, or only User accounts?
- Is “Block” allowed for the current signed-in account?
- Should module-off rights be retained for later re-enabling or cleared?
- Does “All” include future rights added to a module?
- Are stat-card values intentionally blank for every role, or only this
  wireframe phase?
