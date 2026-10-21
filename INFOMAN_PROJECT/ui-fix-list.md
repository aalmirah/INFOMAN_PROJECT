# HOPE Inc. UI Fix List

Use this checklist to review every built screen at mobile and desktop sizes. Mark an item only after checking the screen in the browser; record unresolved issues in the findings log.

## Review Setup

- [ ] List every built screen, route, and important state to review.
- [ ] Use the same browser, zoom level (100%), and test data for comparisons.
- [ ] Review at mobile widths of 320 px, 375 px, and 390 px, and desktop widths of 1280 px and 1440 px.
- [ ] Check intermediate widths while resizing; do not assume the layout works between the listed sizes.
- [ ] Inspect both the initial viewport and the full page, including dialogs, menus, and other key states.

## Visual Consistency

- [ ] Shared colors, typography, icon style, borders, shadows, and corner radii are consistent across screens.
- [ ] Headings, body text, labels, buttons, and links use a consistent type scale and weight.
- [ ] Repeated components look and behave the same wherever they appear.
- [ ] Button hierarchy is consistent: primary, secondary, and destructive actions are visually distinct.
- [ ] Form fields, validation messages, tables, navigation, and empty states follow consistent patterns.
- [ ] No placeholder content, mismatched assets, or unintended browser-default styles remain.

## Spacing

- [ ] Page margins and content gutters are consistent across screens at the same viewport size.
- [ ] Related elements are grouped with consistent spacing; unrelated sections are clearly separated.
- [ ] Spacing between labels, controls, helper text, and error messages is consistent.
- [ ] Buttons and form controls have adequate dimensions and internal padding.
- [ ] Content does not touch or crowd viewport edges, fixed headers, footers, or other controls.
- [ ] No unexpected gaps, cramped sections, or layout shifts appear when content changes.

## Responsive Behavior

- [ ] Content reflows intentionally from desktop to mobile; columns and sidebars stack or adapt appropriately.
- [ ] No horizontal page scrolling, clipped content, overlapping elements, or truncated labels appear.
- [ ] Navigation remains usable at every width, including its expanded and collapsed states.
- [ ] Images and media resize without distortion and remain within their containers.
- [ ] Tables and dense data remain readable and operable on narrow screens.
- [ ] Dialogs, dropdowns, and menus fit the viewport and can be dismissed without hidden controls.
- [ ] Touch targets are comfortably tappable and do not depend on hover.
- [ ] Fixed or sticky elements do not obscure content or primary actions.
- [ ] Text remains readable without requiring horizontal scrolling or browser zoom.

## Contrast and Readability

- [ ] Normal text meets WCAG AA contrast of at least 4.5:1 against its background.
- [ ] Large text (at least 18 pt regular or 14 pt bold) meets WCAG AA contrast of at least 3:1.
- [ ] Meaningful icons, control boundaries, and other non-text indicators have at least 3:1 contrast against adjacent colors.
- [ ] Information is not conveyed by color alone; status and errors have text or another visual cue.
- [ ] Focus indicators, placeholder text, disabled states, and validation messages remain perceivable.
- [ ] Text remains legible over images, tinted surfaces, and hover or selected states.

## Alignment and Layout

- [ ] Page titles, section headings, content edges, and repeated elements align consistently.
- [ ] Form labels and controls line up predictably; fields of the same role use consistent widths.
- [ ] Buttons and actions align with their associated content and maintain consistent placement.
- [ ] Grid columns, cards, and list rows have consistent widths, gaps, and baselines.
- [ ] Icons and text are vertically aligned within controls and navigation items.
- [ ] No elements overlap, drift off-grid, or appear unintentionally misaligned at any tested width.

## Interaction and States

- [ ] Primary actions, links, forms, navigation, and keyboard controls work as expected.
- [ ] Hover, focus, active, selected, disabled, loading, empty, success, and error states are visually clear where applicable.
- [ ] Keyboard focus is visible and follows a logical order; controls are operable without a mouse.
- [ ] Validation feedback identifies the affected field and explains how to correct it.
- [ ] Long, short, missing, and error-prone content does not break the layout.

## Findings Log

Record each issue with enough detail to reproduce it. Duplicate this block for additional findings.

| Screen / route | Viewport | Issue and location | Expected result | Priority | Status |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Sign-Off

- [ ] Every built screen and key state has been checked at mobile and desktop widths.
- [ ] Findings have an owner or a documented follow-up, and resolved issues have been rechecked at affected widths.
- [ ] No unresolved critical visual, responsive, contrast, or alignment issues remain.

Reviewer:  
Date:  
Build / version:
