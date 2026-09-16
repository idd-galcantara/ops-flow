# Implementation Tasks - ops-union v1.2.1 application-oriented log source modal

Tasks below define the implementation and validation slice for the application-oriented log
source workflow. Previous release task history remains in `specs/1.2.0-logs-improvements/` and is
not rewritten here.

## Phase 1 - Inventory and selection contracts

- [x] 1.2.1-1 Define the application log inventory and normalized selection models.
  - Reuse the v1.2.0 application identity and pod/source models while adding explicit
    cluster/namespace context groups, container role metadata, pending selection state, and a
    de-duplicated source tuple builder.
  - Preserve application identity keys, cluster, namespace, pod, and container in every selected
    source; do not authorize or expand sources from display names.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: 2.1-2.6, 3.5-3.6, 4.1-4.5, 5.1-5.4
  - _Dependencies: v1.2.0 application identity and aggregate log contracts
  - _Validation: focused model tests for repeated names, exact tuple de-duplication, preserved
    context, and identity-key matching.
  - _Evidence (2026-09-16): `frontend/src/logSourceInventory.test.ts` covers application-key
    matching, repeated names across contexts, preserved context tuples, and exact tuple
    de-duplication; frontend typecheck/build pass.
  - _Evidence (2026-09-16, follow-up): frontend inventory refresh now reconciles selections by
    exact source tuple while retaining `application.key` and context metadata; the updated
    behavior is covered by frontend tests.
  - _Definition of done: a confirmed selection can be converted into only the intended unique
    `(cluster, namespace, pod, container)` tuples.

- [x] 1.2.1-2 Implement deterministic primary/sidecar classification defaults.
  - Centralize known sidecar indicators, including `istio-proxy` and `envoy`, and consume explicit
    metadata when available.
  - Select primary containers by default, leave sidecars visible and unchecked, permit overrides,
    and implement the visible sidecar-only fallback.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: 3.1-3.6
  - _Dependencies: 1.2.1-1
  - _Validation: unit tests for known names, explicit role metadata, unknown containers, mixed
    containers, and pods containing only sidecars.
  - _Evidence (2026-09-16): classifier tests cover `istio-proxy`, explicit roles, unknown
    containers, mixed containers, and sidecar-only fallback; all frontend tests pass.
  - _Definition of done: classification affects only defaults and display; every container remains
    explicitly selectable.

## Phase 2 - Application-oriented modal workflow

- [x] 1.2.1-3 Build the hierarchical source-selection modal.
  - Render `application > cluster/namespace > pod > container` with expand/collapse, context-aware
    counts, inherited selection actions, individual container controls, loading, partial, empty,
    and stale states.
  - Default to the originating explicit context and show additional matching contexts without
    selecting them until the user explicitly adds them.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: 1.1-1.5, 2.1-2.6, 4.1-4.3, 7.1-7.5
  - _Dependencies: 1.2.1-1, 1.2.1-2
  - _Validation: component tests for hierarchy, context isolation, inherited selection, cancel,
    disabled empty confirmation, refresh, and stale-source reconciliation.
  - _Evidence (2026-09-16): `ApplicationLogSourceModal` implements the accessible hierarchy,
    inherited selection, search, partial/loading/empty/stale states, cancel, refresh, and disabled
    confirmation; `logSourceModal.test.ts` covers valid, empty, loading, and stale confirmation;
    frontend typecheck/build pass.
  - _Evidence (2026-09-16, follow-up): pod selection is explicitly blocked when the selected pods
    resolve to multiple `application.key` values, with regression coverage; the single-key flow
    remains preserved.
  - _Definition of done: the modal makes every selected context and source visible and never
    silently mixes an unselected cluster/namespace.

- [x] 1.2.1-4 Route application log actions through one existing aggregate session.
  - Open the modal from application/pod/group log actions, confirm one normalized source list, and
    pass it to the existing `WS /api/logs` session creator.
  - Preserve v1.2.0 range, follow, limit, source lifecycle, cancellation, partial-failure, and
    legacy per-pod compatibility behavior. Replace an existing session without an orphaned socket.
  - _Owner: @ops-union-frontend
  - _Copilot agents: @ops-union-frontend, @ops-union-backend
  - _Requirements: 1.3-1.4, 5.1-5.5, 8.1-8.4
  - _Dependencies: 1.2.1-1, 1.2.1-3
  - _Validation: frontend session tests and backend protocol regression tests proving one socket,
    one subscribe payload, exact source tuples, teardown, and source-scoped failure handling.
  - _Evidence (2026-09-16): App mounts `LogViewer` only after modal confirmation and passes one
    normalized source list; aggregate protocol/session regression tests pass (backend 62/62,
    frontend 80/80) and all workspace typechecks pass. No backend files were changed for this
    task.
  - _Definition of done: source selection changes cannot create per-source sockets or broaden the
    confirmed target set.

## Phase 3 - Summary and viewer filtering

- [x] 1.2.1-5 Replace the details/sidebar source tree with a compact selection summary.
  - Show application identity, explicit cluster/namespace contexts, selected pod/container counts,
    primary versus sidecar counts, session status, and partial/error indicators.
  - Add a `Change sources` action that reopens the modal with the current selection without
    duplicating the hierarchy in the sidebar.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: 4.4-4.5, 5.5, 7.2-7.4
  - _Dependencies: 1.2.1-3, 1.2.1-4
  - _Validation: component/accessibility tests for summary counts, context labels, replacement
    selection, partial errors, and narrow widths.
  - _Evidence (2026-09-16): details renders compact application/context/pod/container/role counts
    and `Change sources`; the full source tree remains modal-owned; frontend typecheck/build pass.
  - _Definition of done: details remains scannable and context is visible without rendering a
    second source tree.

- [x] 1.2.1-6 Add structured viewer filters for context and log text.
  - Add pod, container, cluster, namespace, and case-insensitive message-text filters with AND
    semantics, scoped values, clear actions, result counts, and distinct no-results/no-events
    states.
  - Apply filters before virtualization and keep them independent of the WebSocket subscription,
    server budgets, and source lifecycle.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: 4.5, 5.5, 6.1-6.6, 8.3-8.4
  - _Dependencies: 1.2.1-4, existing v1.2.0 virtualized viewer
  - _Validation: focused filter/state tests for combined filters, repeated names across contexts,
    clear behavior, no results, and virtualization input size.
  - _Evidence (2026-09-16): `logsSession.test.ts` covers AND semantics and bounded source values;
    `LogViewer` filters before `@tanstack/react-virtual`, keeps the WebSocket unchanged, and
    exposes individual/all clear actions plus no-events/no-results states; frontend tests pass.
  - _Definition of done: users can narrow retained structured events without changing the active
    aggregate session or losing context labels.

- [ ] 1.2.1-7 Audit accessibility, responsive layout, and safe errors.
  - Add accessible names and keyboard focus behavior for hierarchy controls, context selection,
    container toggles, confirmation/cancel actions, summary actions, and viewer filters.
  - Ensure loading, stale, partial, empty, and error messages are scoped and do not expose raw
    Kubernetes or kubeconfig data; verify no overlap at narrow widths.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: 1.5, 4.1-4.4, 6.5-6.6, 7.1-7.5, 8.3-8.4
  - _Dependencies: 1.2.1-3, 1.2.1-5, 1.2.1-6
  - _Validation: keyboard and screen-reader smoke scenarios, responsive browser checks, and error
    assertions for raw response/header/kubeconfig markers.
  - _Evidence (2026-09-16): implementation includes dialog semantics, Escape cancellation,
    labelled controls, visible focus styles, narrow-width CSS, and scoped safe error rendering;
    typechecks/build and existing backend error-safety tests pass. Browser and screen-reader smoke
    validation was not run, so this task remains intentionally unchecked.
  - _Evidence (2026-09-16, follow-up): `POST /api/pods` and `POST /api/namespaces` fallbacks now
    use `safeErrorMessage`; no browser, keyboard, or screen-reader smoke runner was available,
    so this task remains open.
  - _Definition of done: the workflow remains operable and understandable at desktop and narrow
    widths with safe, visible states.

## Phase 4 - Integration and release gate

- [ ] 1.2.1-8 Validate application source selection end to end in read-only environments.
  - Exercise one application in one context, the same identity in multiple contexts, repeated pod
    names, primary plus sidecar containers, sidecar-only fallback, explicit multi-context
    selection, source failure, stale inventory, and viewer filters.
  - Confirm exactly one aggregate WebSocket, no automatic context mixing, correct selected source
    tuples, bounded session behavior, and no Kubernetes mutation.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: 2.1-2.6, 3.1-3.6, 4.1-4.5, 5.1-5.5, 6.1-6.6, 7.1-7.5, 8.1-8.4
  - _Dependencies: 1.2.1-4, 1.2.1-7
  - _Validation: `npm test --workspaces --if-present`, `npm run typecheck --workspaces --if-present`,
    `npm run build --workspaces --if-present`, `git diff --check`, plus documented read-only UI
    and WebSocket scenarios.
  - _Evidence (2026-09-16): final automated checks passed with backend 62/62 and frontend 82/82;
    backend, frontend, and desktop typechecks and builds passed, as did `git diff --check`.
    Read-only QA exercised `kubectl get/top`, GET health/contexts/describe/metrics, one aggregate
    WebSocket connection with one subscribe across sources from two contexts, sanitized partial
    failure, and the legacy per-pod endpoint. No cluster mutation occurred. A cluster without
    metrics-server was unavailable, POST query coverage was excluded by the GET-only policy, and
    no browser/keyboard/screen-reader smoke runner was available; this task remains open.
  - _Definition of done: focused automated checks and read-only scenarios demonstrate the complete
    modal-to-viewer path without mutating the cluster.

- [ ] 1.2.1-9 Perform the release-scope and compatibility audit.
  - Verify that v1.2.0 requirements remain intact, the legacy per-pod path is preserved, no second
    log transport or mutation path was introduced, and all prior specs remain unchanged.
  - Record implementation evidence separately from this planned specification; do not mark this
    task complete from design review alone.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: 5.1-5.5, 7.5, 8.1-8.4, Definition of done
  - _Dependencies: 1.2.1-8
  - _Validation: source audit, regression tests, effective API review, and `git diff --check`.
  - _Evidence (2026-09-16): static audit recorded the aggregate one-connection/one-subscribe
    path, legacy per-pod compatibility endpoint, safe partial-failure rendering, read-only QA
    boundary, and passing `git diff --check`. This task remains open because its `1.2.1-8`
    dependency and the release gate are not complete; the audit is not completion evidence.
  - _Definition of done: compatibility, read-only, security, and scope evidence is recorded and
    the implementation agent can identify any residual limitations.

## Definition of done

- [ ] All task IDs above are implemented by their named owners and have focused validation evidence.
- [ ] Requirements, design decisions, and implementation behavior agree on explicit context
  selection, primary/sidecar defaults, one aggregate WebSocket, compact summary, and viewer
  filters.
- [ ] Existing v1.2.0 log behavior, limits, lifecycle, security, and legacy compatibility remain
  intact.
- [ ] Tests, typechecks, builds, responsive/accessibility checks, and read-only integration checks
  pass; package versioning, commit, tag, and publication remain separate approved actions.
