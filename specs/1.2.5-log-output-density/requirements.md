# Requirements - ops-union v1.2.5 log output density

## Scope

Version 1.2.5 refines the frontend presentation of the logs workspace after the v1.2.4 toolbar
layout. It has two user-visible goals:

1. Make the Pod, Container, Cluster, and Namespace select affordances state-aware: an empty/All
   select keeps its native arrow visible, while a selected select shows only its clear X without
   covering the arrow.
2. Make each retained log row denser by removing the visible timestamp and cluster/namespace
   columns, keeping a compact pod/container identity, and giving the message the remaining width.

The release is frontend-only. It does not change backend routes, WebSocket payloads, Kubernetes
access, permissions, read-only behavior, or release packaging.

The v1.2.4 filter-row/action-row layout and the v1.2.3 draft/applied Search confirmation contract
remain authoritative unless this specification explicitly says otherwise.

## User stories

- As a logs user, I can tell whether a structured select is unfiltered or selected without losing
  the browser's native select affordance or having the clear action cover it.
- As a logs user, I can scan pod/container identity and the message on every row without spending
  horizontal space on repeated timestamp or cluster/namespace columns.
- As a logs user, I can continue selecting message text, switching no-wrap/wrap, grouping records,
  filtering retained records, and receiving a virtualized one-socket stream exactly as before.
- As a keyboard or assistive-technology user, I can operate the native selects and clear actions,
  preserve focus visibility, and understand each control's current purpose.

## Glossary

- **Structured select:** One of the Pod, Container, Cluster, or Namespace filters.
- **Empty/All state:** A structured select whose value is empty and whose option label communicates
  that all values are included.
- **Selected state:** A structured select whose value is a concrete Pod, Container, Cluster, or
  Namespace value.
- **Source identity:** The compact pod/container identification rendered in a log row.
- **Applied search:** The filter, period, range, and follow values currently used by the log session.
- **Draft search:** Edited values that remain unapplied until the user confirms Search.

## Requirements

### LD-1 - State-aware structured select affordances

1. The workspace SHALL retain select filters for Pod, Container, Cluster, and Namespace, using the
   existing draft values, option values, labels, and filter matching semantics.
2. WHEN a structured select is in the empty/All state, THEN its native select arrow SHALL remain
   visibly available at the trailing side of the control, and no field-specific clear X SHALL be
   shown.
3. WHEN a structured select has a selected value, THEN the field SHALL show a clear X as its only
   trailing visual affordance and the native arrow SHALL not be visually present. The X SHALL not
   overlap the arrow, selected text, label, focus indicator, or a neighboring field.
4. The select SHALL remain a native keyboard-operable select in both states. Suppressing the
   selected-state arrow is a visual treatment only and SHALL not remove the select from the
   accessibility tree or change its accessible name/value.
5. The select shell SHALL reserve stable internal geometry for its trailing affordance. Switching
   between empty/All, selected, and cleared states SHALL not change the shell's outer height or
   cause neighboring fields, the action row, or the output region to jump.
6. The clear X SHALL remain inside its owning field, have the existing field-specific accessible
   name (`Clear pod filter`, `Clear container filter`, `Clear cluster filter`, or `Clear namespace
   filter`), and clear only that draft field when activated.
7. Clearing a structured select SHALL not submit Search, reconnect the log session, clear retained
   events, or alter the applied filter until the existing Search confirmation is activated.
8. The Message text filter SHALL retain its existing input and clear-button behavior. It is not a
   native select and is not required to display a native arrow.

### LD-2 - Dense retained log rows

1. Each visible structured log row SHALL omit the timestamp column previously rendered at the left
   and SHALL omit the cluster/namespace column previously rendered beside it.
2. Each row SHALL retain a compact, readable source identity containing both the pod and container
   values. Existing grouping behavior SHALL remain available; a grouping label MAY share the compact
   identity area but SHALL not introduce a new wide metadata column.
3. The message field SHALL occupy all remaining row width after the compact source identity, with a
   shrinkable/minimum-zero layout boundary so the message is not forced into a fixed fourth column.
4. The row SHALL not render repeated timestamp, cluster, or namespace text as visible cells, titles,
   or replacement columns. Source context may remain available in the existing workspace header,
   source inspection, filter options, and status surfaces.
5. Message text SHALL remain user-selectable. Selection SHALL work for ordinary text and highlighted
   search matches and SHALL not be disabled by the virtualized row positioning.
6. The row layout SHALL remain stable for an empty message, a long message, a message containing
   whitespace/newlines, and long pod/container names. Ellipsis or clipping may be used for the
   compact identity, but the message must retain its existing readable no-wrap/wrap behavior.

### LD-3 - Presentation and data behavior preservation

1. The existing no-wrap mode SHALL keep message whitespace on one visual line and SHALL not add
   wrapping caused by the removed metadata columns. The existing Wrap lines mode SHALL continue to
   wrap message content and measure the resulting row height correctly.
2. Virtualization SHALL remain enabled for the retained rows, use the existing stable source and
   sequence identity, and keep scroll, auto-scroll, jump-to-latest, and bounded retention behavior.
3. Pod, Container, Cluster, Namespace, and Message text filters SHALL retain their existing local
   AND semantics over retained records. Removing columns from the row SHALL not remove fields from
   filtering or search classification.
4. The Group control SHALL retain its existing application/source presentation behavior and shall
   not become a filter or transport action as a consequence of the denser row layout.
5. The line payload SHALL continue to carry its timestamp, including null timestamps, in the
   existing `LogLineEvent` contract. Hiding a timestamp from a row is a presentation change only.
6. The aggregate logs session SHALL continue to use one WebSocket for the applied subscription.
   Row rendering, filter-affordance changes, wrapping, grouping, and virtualization SHALL not create
   an additional socket or resubscribe before Search confirmation.
7. Search SHALL remain the only action that applies draft filter changes. Existing pending, disabled,
   busy, validation, and status messaging behavior SHALL remain intact.
8. Pause, retained-event Clear, source inspection, range controls, source status, partial failures,
   safe errors, limits, cancellation, and legacy per-pod compatibility SHALL remain behaviorally
   unchanged.

### LD-4 - Responsive and accessible interaction

1. At 320 CSS px, 768 CSS px, and 1280 CSS px viewport widths, the filter controls and dense log
   rows SHALL remain readable, non-overlapping, and free of page-level horizontal overflow.
2. Responsive reflow SHALL occur at complete filter fields or toolbar groups. A structured select's
   label, native control, and clear X SHALL remain one indivisible field unit.
3. The compact source identity SHALL remain discoverable at narrow widths, and the message SHALL
   receive the remaining usable row width. Any horizontal scrolling needed by an intentionally
   no-wrap long message SHALL remain scoped to the log output, not the page.
4. All four structured selects, their clear buttons when selected, the Message text input/clear
   button, Search, Group, Wrap lines, Pause, and retained-event Clear SHALL retain logical keyboard
   order, visible focus, and usable pointer/keyboard targets.
5. Selects SHALL expose their current value and filter purpose to assistive technology. Clear
   buttons SHALL expose only their field-specific accessible name; their X icons SHALL be hidden
   from accessible-name calculation. Focus SHALL remain visible when the selected-state arrow is
   visually suppressed.
6. The output SHALL remain usable at high zoom, including 200% zoom where browser tooling supports
   it, and with reduced motion enabled. No required interaction SHALL depend on hover or color alone.

### RA-1 - Regression and scope boundaries

1. Focused frontend tests SHALL cover state-aware select presentation/clearing and the dense row
   presentation contract where the existing test architecture can exercise it.
2. Existing search, session, presentation, range, source-scope, virtualization, and compatibility
   coverage SHALL continue to pass after implementation.
3. No backend source, backend test, API contract, WebSocket schema, Kubernetes client, permission,
   kubeconfig, authentication, desktop packaging, or release artifact SHALL be changed for this
   release.
4. No raw Kubernetes response body, headers, credentials, or kubeconfig data SHALL be introduced
   into visible output, accessibility text, or validation evidence.
5. This specification SHALL not mark implementation complete based only on a proposed design or
   static inspection. Owners must record executable validation evidence in the task that they own.

### IQ-1 - Read-only acceptance gate

1. Read-only UI validation SHALL prove the empty/All and selected states for Pod, Container,
   Cluster, and Namespace: native arrow visible in the first state, only the X visible in the
   second, no overlap, stable geometry, and field-local clearing.
2. Validation SHALL prove that row output has only compact pod/container identity plus the
   remaining-width message area, with no visible timestamp or cluster/namespace columns, while
   timestamp remains present in the received record/payload contract.
3. Validation SHALL prove text selection, no-wrap/wrap, virtualization, grouping, local filters,
   one-socket behavior, Search confirmation, visible focus, logical tab order, keyboard activation,
   and accessible names remain correct.
4. Responsive validation SHALL cover 320, 768, and 1280 CSS px widths plus high zoom and reduced
   motion when supported. Kubernetes mutations and backend validation are out of scope.

## Definition of done

- Empty/All structured selects visibly retain the native arrow and selected structured selects show
  only a non-overlapping clear X.
- Dense rows omit visible timestamp and cluster/namespace columns, retain compact pod/container
  identity, and give the message all remaining width.
- Selection, no-wrap/wrap, virtualization, filters, grouping, timestamp payloads, one-socket
  behavior, Search confirmation, and accessibility remain intact.
- Focused frontend checks and documented responsive/keyboard/read-only acceptance evidence are
  recorded by the named owners.
- No backend or source outside the frontend/specification scope is changed, and no release activity
  is implied.
