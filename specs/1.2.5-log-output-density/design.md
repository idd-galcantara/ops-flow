# Design - ops-union v1.2.5 log output density

## Overview

The current `LogViewer` renders the four structured selects with a shared clear-button treatment.
When a value is selected, the native select arrow and the clear X compete for the same trailing
space. The current virtualized row renders four visual columns: timestamp, cluster/namespace,
source identity, and message. The latter forces a wide minimum output and leaves less room for the
message.

This design changes presentation boundaries only:

- a structured-select shell renders a state-aware trailing affordance;
- a log row renders a compact source identity followed by a flexible message area.

The existing state owners and transport boundaries remain authoritative.

## Ownership boundaries

- `frontend/src/components/LogViewer.tsx` owns draft/applied filter state, field clearing, Search
  confirmation, grouping, wrapping, retained records, virtualization, and the existing one-socket
  subscription effect.
- `frontend/src/index.css` owns select-shell geometry, the empty/selected arrow/X presentation,
  dense row columns, responsive constraints, overflow, focus styling, and text selection styling.
- `frontend/src/logsSession.ts` remains authoritative for retained records, local filter semantics,
  source identity, bounded retention, and source/session helpers. It must not be changed to remove
  timestamp data just because the row no longer displays it.
- `frontend/src/logsPresentation.ts` remains authoritative for grouping and wrap display state.
- `frontend/src/types.ts` and backend log contracts remain authoritative for `LogLineEvent`,
  including `timestamp: string | null`.
- `@ops-union-frontend` owns implementation and focused frontend evidence.
- `@ops-union-integration-qa` owns read-only responsive, keyboard, accessibility, regression, and
  scope evidence.
- `@ops-union-backend` has no implementation work in this release.

## Structured select design

### State model

Each of Pod, Container, Cluster, and Namespace has two visual states derived from its existing draft
value:

```text
value === ''
  -> native select appearance remains visible
  -> native arrow is the only trailing affordance
  -> field-specific X is absent

value !== ''
  -> select remains native and keyboard-operable
  -> selected-state native arrow is visually suppressed
  -> field-specific X is the only trailing affordance
  -> X clears the owning draft field
```

The state is presentation-only. It must not introduce a second filter value, alter option
semantics, or apply Search. The empty option continues to communicate `All <field>s` using the
existing labels.

### Geometry and interaction contract

- The label, select, and clear action live in one field shell. The shell has a stable trailing
  region and does not allow the X to become a sibling toolbar item.
- In the empty state, the native arrow remains in its normal browser-controlled trailing position.
  In the selected state, the implementation may use a state class/attribute and a selected-state
  appearance rule to hide only that arrow visually; it must not replace the select with a custom
  non-semantic control.
- The selected value is bounded by the shell and must not run beneath the X. Long options are
  clipped or ellipsized within the select's available space.
- The X has a stable compact target, visible focus, `type="button"`, an icon hidden from the
  accessible name calculation, and the field-specific accessible name from v1.2.4.
- Empty and selected states use equivalent shell dimensions. Responsive wrapping may move the whole
  shell, but never its internal label/control/X parts independently.
- The Message text field keeps its existing input and clear-button shell. Its clear action has no
  native-arrow state and remains separate from the four select rule.

## Dense log-row design

### Row contract

The visible row is a two-area layout:

```text
[ compact pod/container identity ] [ message occupying all remaining width ]
```

The implementation may use CSS grid or flex, but the identity area must be bounded and the message
area must use a shrinkable `minmax(0, 1fr)`-equivalent boundary. The row must not retain empty
placeholder tracks for timestamp or cluster/namespace.

- The compact identity always communicates both `record.source.pod` and
  `record.source.container`. The existing application/source grouping label may remain inside this
  compact area, provided it does not become an additional wide column or hide pod/container values.
- The message remains the selectable content surface and retains existing search highlighting.
- The timestamp and cluster/namespace are removed from the row's visible markup/presentation. They
  remain available in retained records, filters, general search classification, source inspection,
  headers, and payload handling wherever those existing surfaces use them.
- Empty messages continue to use the existing readable fallback. Long identities may ellipsize;
  message content is never allowed to push the identity outside the row shell.

### No-wrap, wrap, and virtualization

No-wrap keeps the existing `white-space: pre` behavior for the message. A long no-wrap message may
use horizontal scrolling owned by `.log-output`, but it must not create page-level overflow. Wrap
mode keeps `pre-wrap`/break behavior and must continue to produce measurable row heights.

The row remains absolutely positioned by the existing virtualizer, retains the existing
`sourceId:sequence` key, and continues to call the virtualizer's measurement callback. Removing
visual cells must not replace virtualization with a full retained-event render or change scroll,
auto-scroll, jump-to-latest, bounded retention, or selection behavior.

## State and transport preservation

The existing transitions remain unchanged:

```text
draft select/input edit or field clear
  -> pending Search (no socket or retained-event change)
Search
  -> existing validation and draft/applied commit
applied transport change
  -> existing single aggregate WebSocket subscription
Group / Wrap lines / Pause / retained-event Clear
  -> existing presentation or immediate behavior
```

The line timestamp stays in the incoming `LogLineEvent` and in each retained `LogEventRecord`. This
feature does not add a display formatter, mutate payloads, or change timestamp filtering/search
classification.

## Responsive and accessibility behavior

At 1280 CSS px, the row presents a compact identity and a message that consumes the broad remaining
area. At 768 CSS px and 320 CSS px, the row keeps the identity as one bounded unit and gives the
message the rest of the output width. Complete toolbar fields/groups may reflow, but the internal
select shell never splits.

The page must not gain horizontal overflow from the toolbar or row grid. Horizontal movement for a
long intentional no-wrap message is allowed only inside the log output. Focus rings must remain
visible and unclipped. Keyboard order follows the existing toolbar order; a selected field's clear
button follows its select within that field's local sequence. Native select semantics, accessible
names, Search confirmation, and screen-reader status messages remain unchanged.

High-zoom and reduced-motion checks are required where browser tooling supports them. No new
animation is required.

## Tradeoffs

Suppressing the selected-state native arrow sacrifices the visual cue that a select can open, but
it satisfies the approved requirement that a selected field show only its clear X. Native select
semantics and keyboard operation are retained, and the empty state continues to show the browser
arrow.

A compact identity track reduces repeated metadata and gives the message more room. It also means
long pod/container names may be ellipsized, so the full pod/container identity remains available
through the existing source-inspection surface and the row's pod/container title or accessible
context as appropriate, without reintroducing cluster/namespace or timestamp text into the row.

## Validation strategy

### Focused frontend checks

- Test all four structured selects in empty/All, selected, long-value, keyboard-focused, and
  cleared states. Assert arrow/X visibility is mutually exclusive and field dimensions do not move.
- Test field-specific clearing, global Clear filters, pending/applied Search state, accessible
  names, and no socket/session side effect from clearing.
- Test row structure/presentation with timestamped records: no visible timestamp/context cells,
  compact pod/container identity, selectable message, highlighting, and message width ownership.
- Run existing logs search/session/presentation/range/source-scope tests to protect semantics,
  grouping, wrap state, virtualization keying, and retained-event behavior.

### Responsive and keyboard checks

- Exercise 320, 768, and 1280 CSS px viewports with empty and selected filters, long identities,
  long messages, pending Search, and both wrap modes.
- Use keyboard traversal to verify native select operation, X activation by Enter/Space, visible
  focus, Search confirmation, Group order, Wrap lines, Pause, and retained-event Clear.
- Check text selection in no-wrap and wrap rows, page overflow, output-scoped horizontal scrolling,
  high zoom, reduced motion, and accessible names.
- Record unavailable browser, assistive-technology, or visual-harness checks as limitations rather
  than implementation evidence.

### Regression and scope checks

- Run `npm test --workspace=frontend`, `npm run typecheck --workspace=frontend`,
  `npm run build --workspace=frontend`, and `git diff --check` after implementation.
- Confirm only intended frontend files and this versioned specification change; no backend, API,
  Kubernetes, credential, packaging, or release artifact change is permitted.
- Do not run Kubernetes mutations or expose kubeconfig data during validation.
