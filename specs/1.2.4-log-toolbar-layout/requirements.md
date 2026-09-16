# Requirements - ops-union v1.2.4 log toolbar layout

## Scope

This specification refines the v1.2.3 `LogViewer` toolbar layout and filter-clear interaction.
It makes each filter clear affordance part of its own field and moves the deferred `Search` action
into a lower toolbar action row beside `Group`. The release is frontend-only: it does not change
search state semantics, retained events, WebSocket behavior, backend routes, Kubernetes access, or
read-only boundaries.

The affected filters are Pod, Container, Cluster, Namespace, and Message text. Existing v1.2.3
behavior remains authoritative: edits and filter-specific clearing update the draft, `Clear filters`
clears the draft filters, and `Search` is required to apply those changes.

## Glossary

- **Filter field:** One of the five structured filter controls in the logs workspace.
- **Field clear affordance:** The icon button with an accessible name that clears only its owning
  filter field.
- **Clear filters:** The existing global action that clears all non-empty structured filter fields.
- **Filter row:** The toolbar region containing the five structured filter fields and the global
  `Clear filters` action.
- **Action row:** The lower toolbar region containing `Group`, `Search`, and the existing status or
  immediate presentation controls as space permits.
- **Pending search:** The v1.2.3 state in which the draft differs from the applied search.

## Requirements

### LT-1 - Stable filter fields and clear affordances

1. The workspace SHALL provide filter fields for Pod, Container, Cluster, Namespace, and Message
   text using the existing local filter values and matching behavior.
2. WHEN a filter has a selected or typed value THEN its field clear affordance SHALL remain inside
   that field's visual boundary, aligned with the field's trailing edge, and on the same row as
   the select or text input.
3. The field SHALL reserve a stable trailing slot for its clear affordance. Showing or hiding the
   affordance SHALL NOT change the field's outer height or width, resize the input/select, move
   neighboring fields, or cause the affordance to wrap onto a second line.
4. The same contract SHALL apply independently to Pod, Container, Cluster, Namespace, and Message
   text, including long option labels, long typed text, an empty value, and a value cleared by
   keyboard or pointer.
5. Filter fields MAY wrap as whole fields across responsive rows, but no field clear affordance
   SHALL become a standalone toolbar item or create page-level horizontal overflow.
6. Activating a field clear affordance SHALL clear only its owning draft filter. It SHALL NOT apply
   the search, reconnect the session, clear retained events, or change the applied filter until
   `Search` is confirmed.

### LT-2 - Clear behavior and accessibility

1. Every non-empty filter field SHALL expose a keyboard-focusable clear button with a unique,
   specific accessible name: `Clear pod filter`, `Clear container filter`, `Clear cluster filter`,
   `Clear namespace filter`, or `Clear message text filter`.
2. The clear button SHALL have a visible focus indicator, an adequate pointer/keyboard target for
   the compact toolbar, and SHALL remain discoverable at narrow widths and high zoom.
3. The filter input/select and its clear button SHALL have a logical tab order. The clear button
   SHALL not be reachable as an unrelated control outside its field, and its icon SHALL be hidden
   from the accessible name calculation.
4. The existing `Clear filters` action SHALL remain available whenever one or more draft filters
   are non-empty, SHALL retain its count, and SHALL clear all five draft filters in one action.
5. `Clear filters` and field-specific clear buttons SHALL remain distinguishable by accessible
   name, visible placement, and behavior. Neither action SHALL bypass the v1.2.3 `Search`
   confirmation boundary.

### LT-3 - Search action hierarchy and placement

1. The `Search` button SHALL be rendered in a dedicated toolbar action row below the filter row and
   SHALL not compete for space with the five filter fields.
2. Within that lower action row, the `Group` control SHALL appear immediately before `Search` in
   visual and keyboard order; `Search` SHALL be to the right of `Group` at supported desktop,
   tablet, and mobile widths where the controls fit.
3. The action row SHALL give `Search` a clear primary hierarchy while preserving the distinct
   presentation role of `Group`, `Wrap lines`, `Pause`, and retained-event `Clear` controls.
4. The `Search` label, pending/disabled state, busy state, accessible name, and status messaging
   SHALL remain consistent with v1.2.3. Moving the button SHALL not change when a draft is applied.
5. The lower action row SHALL have a stable reading and focus order. Responsive wrapping MAY move
   secondary status or immediate controls, but SHALL not place `Search` back among the filter
   fields or separate `Search` from the `Group` control as an accidental line break.

### LT-4 - Responsive and visual integrity

1. At desktop, tablet, narrow mobile, and high-zoom widths, the toolbar SHALL keep labels, fields,
   clear buttons, `Group`, and `Search` readable and non-overlapping.
2. The toolbar SHALL not introduce horizontal page overflow. If available width is insufficient,
   complete filter fields and the lower action row SHALL reflow at field/control boundaries while
   preserving each field's internal no-wrap contract.
3. The selected-state and empty-state geometry of every filter SHALL remain stable enough that
   selecting or clearing a value does not visibly shift unrelated controls or the output region.
4. The layout SHALL preserve visible focus, logical keyboard navigation, usable hit targets, and
   readable text at high zoom. It SHALL remain usable with reduced motion enabled.
5. Visual validation SHALL cover at least 320 CSS px, 768 CSS px, and 1280 CSS px viewport widths,
   plus a high-zoom keyboard pass where browser tooling is available.

### LT-5 - Behavioral and scope preservation

1. Pod, Container, Cluster, Namespace, and Message text SHALL retain the v1.2.3 draft/applied
   distinction and existing AND semantics over retained structured events.
2. `Search` SHALL remain the only action that applies pending filter changes. Filter layout work
   SHALL not open, close, replace, or resubscribe the aggregate log WebSocket.
3. `Group`, `Wrap lines`, `Pause`, retained-event `Clear`, source inspection, range controls, and
   session status SHALL retain their v1.2.3/v1.2.2 behavior and semantic separation.
4. The change SHALL add no backend endpoint, subscription field, Kubernetes permission, mutation
   path, authentication behavior, or kubeconfig persistence.

### RA-1 - Regression and safety boundaries

1. Existing source scope, aggregate transport, bounded retention, limits, timestamps, cancellation,
   partial failures, safe errors, virtualization, and legacy per-pod compatibility SHALL remain
   covered by the existing focused tests.
2. No raw Kubernetes response body, headers, credentials, or kubeconfig data SHALL be introduced
   into filter or toolbar accessibility/error content.
3. This specification SHALL not authorize source-code implementation, commit, packaging, release,
   or completion of an implementation task without recorded evidence.

### IQ-1 - Integration acceptance gate

1. Read-only validation SHALL prove that selecting and clearing each of the five filters keeps its
   X inside the owning field, on one line, without changing surrounding geometry or causing page
   overflow.
2. Validation SHALL prove that each field-specific clear action and the global `Clear filters`
   action preserve draft semantics and accessible names, and that keyboard focus remains visible and
   logical.
3. Validation SHALL prove that `Search` is on the lower toolbar action row, immediately to the
   right of `Group`, has the intended primary hierarchy, and remains usable at narrow widths/high
   zoom.
4. Validation SHALL include desktop, tablet, mobile, keyboard, and high-zoom scenarios when the
   environment supports them. Kubernetes validation, mutations, and backend changes are out of
   scope.

## Definition of done

- Every affected filter keeps its clear button inside a stable, aligned field without wrapping or
  shifting the toolbar when values are selected or cleared.
- Field-specific clear buttons and global `Clear filters` remain keyboard-accessible, distinctly
  named, visible in focus, and subject to Search confirmation.
- `Search` is on a lower toolbar action row immediately to the right of `Group`, with clear visual
  hierarchy and no competition with the filter row.
- Responsive and high-zoom layouts avoid overlap and page overflow while preserving control order.
- v1.2.3 search behavior, v1.2.2 log behavior, backend contracts, and read-only boundaries remain
  unchanged.
- Focused frontend tests, typecheck/build checks, and documented read-only visual/accessibility
  validation are recorded by the named owners.
- This specification changes no product source code, does not alter earlier specification history,
  and does not authorize commit, packaging, or release publication.
