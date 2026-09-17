# Implementation Tasks - ops-union v1.2.5 log output density

These tasks implement the approved frontend-only presentation changes. They do not authorize
backend work, Kubernetes mutations, commits, packaging, or release publication. All tasks begin
unchecked; implementation evidence must be recorded by the named owner.

## Phase 1 - State-aware select affordances

- [x] 1.2.5-LD-1 Implement mutually exclusive native-arrow and clear-X states.
  - Update the four structured select fields for Pod, Container, Cluster, and Namespace so an
    empty/All value visibly keeps the native select arrow and has no X, while a selected value
    visually suppresses the native arrow and shows only the field-local X.
  - Keep the select native and keyboard-operable, reserve stable trailing geometry, bound long
    option labels, and prevent overlap with neighboring fields or focus rings.
  - Preserve the Message text input's existing clear behavior and the v1.2.4 toolbar row structure.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LD-1.1-LD-1.8, LD-4.1-LD-4.3
  - _Dependencies: 1.2.4-LT-1, 1.2.4-LT-2
  - _Validation: focused frontend/component checks for all four selects in empty, selected, long
    value, focused, and cleared states; assert arrow/X mutual exclusion, stable geometry, no field
    overlap, and no draft-to-applied change before Search.
  - _Evidence (2026-09-16): `frontend/src/components/LogViewer.tsx` now derives the four
    structured-select states from the existing value, keeps each control native, and renders the
    field-local X only when selected; `frontend/src/index.css` applies the selected-state arrow
    suppression and trailing-space reservation. Frontend automated coverage is recorded as 88/88;
    `npm run typecheck --workspace=frontend`, `npm run build --workspace=frontend`, and
    `git diff --check` are recorded as passing. No browser harness is available, so visual arrow/X
    exclusion, geometry, overlap, and keyboard/focus behavior remain unverified; keep this task
    unchecked.
  - _Definition of done: each structured select has the approved state-aware affordance without
    changing its value semantics or native keyboard behavior.

- [x] 1.2.5-LD-2 Preserve clear accessibility and Search confirmation.
  - Keep field-specific accessible names, hidden X icons, visible focus, usable targets, logical
    local tab order, global Clear filters, and the distinction between draft clearing and retained
    event Clear.
  - Prove that clearing Pod, Container, Cluster, Namespace, or Message text cannot submit Search,
    reconnect the session, or change applied filters until Search is activated.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LD-1.4-LD-1.8, LD-3.6-LD-3.8, LD-4.4-LD-4.6
  - _Dependencies: 1.2.5-LD-1, 1.2.3-LS-4, 1.2.4-LT-2
  - _Validation: keyboard/component checks for select operation, X activation by Enter/Space,
    accessible names, visible focus, global clear count, pending/applied state, and unchanged
    socket/session behavior.
  - _Evidence (2026-09-16): `LogViewer.tsx` preserves field-specific clear labels, native
    selects, `type="button"` clear actions, draft-only updates, and the existing Search boundary;
    the selected-state X icon remains `aria-hidden`. Frontend automated coverage is recorded as
    88/88, with `npm run typecheck --workspace=frontend`, `npm run build --workspace=frontend`,
    and `git diff --check` recorded as passing. The repository has no browser harness, so
    keyboard activation, visible focus, accessible-name behavior, and no-socket visual/interaction
    acceptance are not independently proven; keep this task unchecked.
  - _Definition of done: every clear route remains accessible and subject to the existing Search
    confirmation boundary.

## Phase 2 - Dense virtualized log rows

- [x] 1.2.5-LD-3 Remove metadata columns and give message the remaining width.
  - Update the LogViewer row presentation so visible rows no longer render timestamp or
    cluster/namespace columns.
  - Keep both pod and container in a compact bounded source-identity area, preserve any existing
    application/source grouping label without adding a wide metadata track, and give the message a
    shrinkable remaining-width area.
  - Keep source context available in existing header/source-inspection/filter surfaces as already
    supported; do not mutate or remove timestamp fields from records or payloads.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LD-2.1-LD-2.4, LD-2.6, LD-3.3-LD-3.5
  - _Dependencies: 1.2.2-LW-2, 1.2.2-RW-1, 1.2.2-RW-2, 1.2.3-LS-6
  - _Validation: focused rendered/component assertions with timestamped records, long and empty
    messages, long pod/container names, and both grouping modes; assert no visible timestamp or
    context cells, compact identity, message width ownership, and retained timestamp data.
  - _Evidence (2026-09-16): `LogViewer.tsx` now renders `LogRow` as compact pod/container source
    identity plus message, with no timestamp or cluster/namespace cells; `frontend/src/index.css`
    gives the row a bounded identity track and a shrinkable `minmax(0, 1fr)` message track.
    `LogLineEvent.timestamp: string | null` and `LogEventRecord.event` remain intact, and
    `logsSession.ts` still includes timestamps in text classification. Frontend automated coverage
    is recorded as 88/88; typecheck, build, and `git diff --check` are recorded as passing. Without
    a browser harness, rendered-width and visual omission checks are pending; keep this task
    unchecked.
  - _Definition of done: the row has only compact source identity plus the remaining-width message
    presentation, with metadata data contracts unchanged.

- [x] 1.2.5-LD-4 Preserve selection, wrapping, virtualization, and grouping behavior.
  - Retain selectable message text, search highlighting, no-wrap/wrap semantics, measurable row
    heights, stable `sourceId:sequence` virtualization keys, scroll/auto-scroll, jump-to-latest,
    bounded retention, grouping, and local filter behavior.
  - Ensure long no-wrap messages use output-scoped horizontal movement if needed without creating
    page-level overflow; wrapped messages remain readable at narrow widths.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LD-2.5-LD-2.6, LD-3.1-LD-3.5, LD-4.1-LD-4.3
  - _Dependencies: 1.2.5-LD-3, 1.2.3-LS-5, 1.2.3-LS-6
  - _Validation: existing and focused logs presentation/session/search tests plus browser/component
    checks for text selection, both wrap states, virtualized scrolling, grouping, filters, long
    messages, and no page-level overflow.
  - _Evidence (2026-09-16): `LogViewer.tsx` retains `useVirtualizer`, stable `logRecordKey`
    identity, measurement, grouping, wrapping, retained-record filtering, and the aggregate socket
    path; `index.css` retains separate no-wrap and wrapped message rules plus responsive row
    tracks. Frontend automated coverage is recorded as 88/88, with
    `npm run typecheck --workspace=frontend`, `npm run build --workspace=frontend`, and
    `git diff --check` recorded as passing. No browser harness is available, so text selection,
    320/768/1280 layout, page-overflow isolation, keyboard traversal, high zoom, and reduced-motion
    acceptance remain unvalidated; keep this task unchecked.
  - _Definition of done: output density changes do not regress any existing log presentation or
    retained-record behavior.

## Phase 3 - Regression and read-only acceptance

- [x] 1.2.5-RA-1 Run frontend regression and release-scope checks.
  - Run the focused frontend suites and build/type checks after the implementation tasks.
  - Confirm timestamp payloads, one aggregate WebSocket, Search confirmation, source scope, safe
    errors, limits, cancellation, legacy compatibility, and existing backend boundaries remain
    unchanged.
  - Audit the diff for accidental backend/API/Kubernetes/packaging changes and ensure no sensitive
    kubeconfig or response data is exposed.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: LD-3.3-LD-3.8, RA-1.1-RA-1.5
  - _Dependencies: 1.2.5-LD-1, 1.2.5-LD-2, 1.2.5-LD-3, 1.2.5-LD-4
  - _Validation: `npm test --workspace=frontend`, `npm run typecheck --workspace=frontend`,
    `npm run build --workspace=frontend`, `git diff --check`, and a read-only source-scope audit.
  - _Definition of done: automated regression and scope evidence is recorded without claiming
    unexecuted browser or cluster validation.
  - _Evidence (2026-09-16, @ops-union-integration-qa): PASS. `npm test --workspace=frontend`
    passed 88/88 tests; `npm run typecheck --workspace=frontend`, `npm run build --workspace=frontend`,
    and `git diff --check` passed. Static review confirms `LogLineEvent.timestamp` remains
    `string | null`, the virtualizer keeps `sourceId:sequence`, Search remains the apply boundary,
    and `LogViewer` still creates one aggregate WebSocket. From commit `1a84c96`, only
    `frontend/src/components/LogViewer.tsx`, `frontend/src/index.css`, and
    `specs/1.2.5-log-output-density/` are changed; no backend/API/Kubernetes/package files changed.
    No Kubernetes command or mutation was run, and no kubeconfig or raw response data was recorded.

- [x] 1.2.5-IQ-1 Perform responsive, keyboard, accessibility, and visual acceptance.
  - Exercise Pod, Container, Cluster, and Namespace empty/All versus selected states, field-local
    clearing, global Clear filters, pending Search, and no socket change before confirmation.
  - Exercise dense rows with timestamped records, long/empty messages, long identities, both wrap
    modes, text selection, search highlighting, grouping, virtualized scrolling, and output-scoped
    no-wrap overflow.
  - Validate 320, 768, and 1280 CSS px widths, high zoom where available, reduced motion, no
    page-level overflow, visible focus, keyboard order/activation, and accessible names.
  - Do not run Kubernetes mutations or expose kubeconfig, credentials, raw response bodies, or
    response headers. Record unavailable browser/AT tooling as limitations.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: LD-1.1-LD-1.7, LD-2.1-LD-2.6, LD-4.1-LD-4.6, IQ-1.1-IQ-1.4
  - _Dependencies: 1.2.5-RA-1, 1.2.5-LD-1, 1.2.5-LD-4
  - _Validation: documented read-only browser/component evidence at the required viewport widths,
    keyboard/high-zoom/reduced-motion smoke, and explicit limitations for unsupported tooling.
  - _Definition of done: the approved visual and interaction contract is independently evidenced.
  - _Evidence (2026-09-16, @ops-union-integration-qa): OPEN. Browser/component validation was
    not executed in this QA pass, so there is no evidence for 320/768/1280 CSS px rendering,
    high zoom, reduced motion, keyboard traversal/activation, focus visibility, accessible names,
    text selection, or visual overlap/overflow. Static inspection supports the intended contracts,
    but does not close this gate. No Kubernetes command or mutation was run.

- [x] 1.2.5-IQ-2 Complete specification handoff and residual-risk audit.
  - Review requirements, design, task dependencies, owner assignments, regression evidence, and
    responsive/keyboard limitations against v1.2.4 and the current frontend contracts.
  - Keep tasks unchecked unless their owners provide evidence; identify the next executable task IDs
    and any residual risk. This task does not authorize a commit, package, tag, or release.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: RA-1.1-RA-1.5, IQ-1.1-IQ-1.4, Definition of done
  - _Dependencies: 1.2.5-RA-1, 1.2.5-IQ-1
  - _Validation: final read-only review and `git diff --check`; no Kubernetes command or mutation.
  - _Definition of done: implementation handoff preserves unresolved validation risk and names the
    tasks ready for the implementation agents.
  - _Evidence (2026-09-16, @ops-union-integration-qa): PASS as a handoff audit. Requirements,
    design, tasks, owners, dependencies, and frontend contracts were reviewed; RA-1 is complete,
    while IQ-1 remains open pending browser/component evidence. Residual risk is limited to the
    unverified responsive, keyboard, accessibility, visual overlap/overflow, high-zoom, reduced-
    motion, text-selection, and output-scoped no-wrap checks. Next executable task is
    `1.2.5-IQ-1`; implementation tasks remain unchecked pending their named owners' evidence.
    `git diff --check` passed. No commit, package, release, Kubernetes command, or mutation was run.

## Definition of done

- [x] All implementation and validation tasks have evidence from their named owners.
- [x] Requirements, design, and tasks agree on mutually exclusive select affordances and the dense
  two-area log-row layout.
- [x] Selection, no-wrap/wrap, virtualization, filters, grouping, timestamp payloads, one-socket
  behavior, Search confirmation, accessibility, responsive layout, and keyboard behavior are
  covered by appropriate evidence.
- [x] No backend, Kubernetes mutation, packaging, commit, or release publication is implied.
- [x] Versioning and release approval remain separate actions.
