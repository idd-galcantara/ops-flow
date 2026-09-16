# Design - ops-union v1.2.4 log toolbar layout

## Overview

Version 1.2.4 is a frontend layout refinement for the v1.2.3 `LogViewer`. The current
`frontend/src/index.css` makes `.log-toolbar` a wrapping flex container, gives
`.log-structured-filters` a full-width wrapping region, and styles `.filter-clear` as a generic
inline grid item. The current `LogViewer` markup places `Search` before the structured filters and
renders `Group` after them. This combination allows a clear button to participate in the field's
outer layout instead of occupying a stable trailing position, and makes the primary action compete
with filter controls.

The design introduces two presentation boundaries without changing state ownership: each filter
gets an internal no-wrap field shell with a reserved clear-button slot, and the toolbar gets a
lower action row where `Group` precedes `Search`. The v1.2.3 draft/applied contract remains the
behavioral authority.

## Ownership boundaries

- `frontend/src/components/LogViewer.tsx` owns the existing draft/applied values, filter-specific
  clearing, global `Clear filters`, Search confirmation, Group state, and accessible labels.
- `frontend/src/index.css` owns toolbar rows, filter field geometry, clear-button anchoring,
  responsive reflow, focus styling, and visual hierarchy.
- Existing `frontend/src/logsSearch.ts`, `logsSession.ts`, `logsPresentation.ts`, and the session
  effect remain authorities for search classification, local filtering, presentation state, and
  aggregate transport behavior. Layout changes SHALL not duplicate those rules.
- `@ops-union-backend` has no implementation work in this release. Backend routes, WebSocket
  payloads, limits, permissions, and safe-error handling remain unchanged.
- `@ops-union-frontend` owns implementation and focused frontend behavior/accessibility evidence.
- `@ops-union-integration-qa` owns read-only responsive, keyboard, visual, regression, security,
  and release-scope evidence.

## Layout contract

The toolbar SHALL be organized into intentional regions rather than relying on the source order of
one wrapping flex row:

```text
[period] [custom range when active] [follow] [status/context as space permits]
[Pod] [Container] [Cluster] [Namespace] [Message text] [Clear filters]
[Group] [Search] [pending/apply status] [Wrap lines] [Pause] [buffer Clear]
```

The exact secondary-control distribution may respond to available width, but these invariants are
fixed:

1. The filter row is visually separate from the action row.
2. `Search` is never placed in the filter row.
3. `Group` is the first control in the Search action cluster and `Search` is immediately to its
   right when the cluster fits. The pair is treated as one no-wrap unit so an automatic flex break
   cannot leave Search stranded on a line by itself.
4. Search status may sit beside the Search button or reflow as a complete status item; it must not
   overlay a field or obscure focus.
5. Secondary presentation and immediate controls may reflow after the Group/Search cluster, while
   remaining distinct from the deferred Search action.

A CSS grid or flex implementation is acceptable. It must use explicit rows or row wrappers so the
lower action row is deterministic at desktop and does not depend on incidental flex wrapping.

## Filter field contract

Each of the five filters uses a containing field shell with these properties:

- The shell is the visual boundary for the select/input and its clear button.
- The shell aligns its contents on one inline axis and does not allow the clear button to wrap.
- The select/input receives a stable trailing inset or reserved grid track for the clear button,
  whether the button is currently visible or only its space is reserved.
- The clear button is positioned inside the shell's trailing area, has a stable compact target,
  and cannot increase the shell's height or width when it appears.
- The text input keeps `min-width: 0` so long message text yields to the clear affordance rather
  than pushing it outside the shell. Select text remains clipped or otherwise bounded within its
  own field.
- A field may move to another responsive filter row as a complete unit, but its label, control,
  and clear affordance remain an indivisible layout unit.

For the Message text field, the search icon, input, and clear button share the same shell. For the
four select filters, the native select and clear button share the same shell while the field label
remains accessible. The implementation may use an absolutely anchored button or a grid/flex
trailing track, provided it meets the same geometry, focus, and hit-target contract.

The clear button's visibility may continue to depend on a non-empty draft value. If it is hidden
when empty, the reserved trailing geometry must remain stable through an equivalent padding or
track. The global `Clear filters` action remains outside individual shells and continues to count
non-empty draft fields.

## Action-row contract

The lower action row is a semantic and visual group. `Group` remains a presentation-only select and
`Search` remains the explicit confirmation action. Search keeps its primary button styling, icon,
label, disabled state when no draft is pending, and busy state while a transport change is applied.
The Group select is not restyled as a submit action, and moving Search does not change its
confirmation behavior.

Keyboard order follows the visual order: after the filter row and global `Clear filters`, focus
reaches `Group`, then `Search`, then any status or secondary controls in their visible order. The
field-specific clear buttons stay inside their field's local sequence. Visible focus must survive
all responsive layouts and must not be clipped by the shell or toolbar overflow.

The action row must have enough intrinsic width for the Group/Search pair at the supported compact
viewport. When the row has insufficient space for secondary controls, those controls reflow after
the pair or become a subsequent complete row; the pair is not split by an automatic line break.

## State and transition preservation

No new state machine is required. The existing v1.2.3 transitions remain in force:

```text
draft filter edit or field clear
  -> pending search (no socket/event change)
Clear filters
  -> all five draft filters empty (still pending when applied filters were non-empty)
Search
  -> existing validation and atomic draft/applied commit
Group / Wrap lines / Pause / buffer Clear
  -> existing immediate or presentation-only behavior
```

A field clear button is a draft edit, not a transport action. It must use the existing update path so
validation errors are cleared as before and the applied filter is unchanged until Search. The
layout implementation must not add a form submit handler or cause a click on a clear button to
activate Search.

## Responsive and accessibility behavior

The filter region may use responsive columns or flex rows, but each field shell has a stable
minimum usable width and can shrink without internal wrapping. At narrow widths, fields can become
full-width rows. The action row follows the filter region and keeps Group/Search together; other
items can occupy later rows. The page and toolbar do not gain horizontal scrolling as a workaround
for layout failure.

At minimum, visual QA checks 320, 768, and 1280 CSS pixel widths. A keyboard pass checks tab order,
Enter/Space activation of field clear buttons and Search, visible focus, disabled/busy Search, and
screen-reader names for all five clear buttons plus global `Clear filters`. High-zoom QA checks that
text and focus remain inside their parent controls and that no control is hidden by overflow.
Reduced-motion behavior remains unchanged because this release introduces no required animation.

## Compatibility and tradeoffs

The design deliberately changes structure instead of shrinking icons or relying on negative margins.
Reserving a trailing slot costs a small amount of field width, but prevents selected-state layout
jumps and keeps the clear action discoverable. Separating the action row costs vertical space, but
makes the confirmation boundary legible and prevents a primary action from competing with five
filters. At narrow widths, complete fields and action groups reflow; individual field internals do
not.

No backend or transport change is justified. Pod, container, cluster, namespace, and message text
remain local predicates over retained records, and Search confirmation remains the only application
boundary established by v1.2.3.

## Validation strategy

### Focused frontend checks

- Exercise each of the five filters empty, selected/typed, long-valued, and cleared; assert stable
  field geometry and an in-field clear button without a line break.
- Assert field-specific clear behavior, global `Clear filters`, accessible names, focus visibility,
  logical tab order, and unchanged pending/applied Search behavior.
- Assert that the rendered action row places Group immediately before Search and keeps Search out of
  the filter region.
- Run existing logs search, session, presentation, and range suites to detect semantic regressions.

### Responsive and accessibility checks

- Use browser/component tooling at 320, 768, and 1280 CSS pixel widths, including selected values
  in all five filters and a pending Search state.
- Check no page-level horizontal overflow, no overlap, stable output position, visible focus,
  keyboard activation, accessible names, high zoom, and reduced-motion compatibility.
- Record unavailable browser or assistive-technology checks as limitations, not as implementation
  evidence.

### Regression and scope checks

- Run `npm test --workspace=frontend`, `npm run typecheck --workspace=frontend`,
  `npm run build --workspace=frontend`, and `git diff --check` after implementation.
- Confirm no backend files, API contracts, permissions, Kubernetes operations, or packaging outputs
  changed. No live-cluster mutation is permitted.
