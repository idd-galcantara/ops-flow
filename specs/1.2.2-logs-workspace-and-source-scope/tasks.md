# Implementation Tasks - ops-union v1.2.2 logs workspace and source scope

These tasks define the next delivery after `specs/1.2.1-application-log-source-modal/`. The
v1.2.1 requirements, design, and task history remain unchanged. No task below is implementation
evidence until the named owner records focused validation results.

## Phase 1 - Source scope and sidecar defaults

- [ ] 1.2.2-SS-1 Define consulted-context scope and default source reconciliation.
  - Extend the existing v1.2.1 inventory/selection model so the current explicit
    `cluster/namespace` set is represented as `consultedContexts`.
  - Select every matching pod's primary container across all consulted contexts by default; do not
    include a context merely discovered outside that set.
  - Preserve exact source tuples, application keys, repeated names, role metadata, loading,
    partial, stale, and empty states.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: SS-1.1-SS-1.6, RA-1.2
  - _Dependencies: v1.2.1-1, v1.2.1-2, v1.2.1-3; v1.2.0 application identity contract
  - _Validation: focused model tests for all-consulted-context defaults, excluded non-consulted
    contexts, repeated names, sidecar-only fallback eligibility, stale reconciliation, and exact
    tuple de-duplication.
  - _Evidence (2026-09-16): `frontend/src/logSourceInventory.test.ts` covers defaults across all
    consulted contexts, exact exclusion of an unconsulted context, repeated names, sidecar-only
    fallback, exact tuple reconciliation, and deterministic source tuples; frontend typecheck,
    focused tests, full tests (84/84), and build pass. Task remains unchecked pending browser
    validation.
  - _Definition of done: one deterministic pending source set is produced from application key,
    consulted contexts, inventory, and role metadata without broadening scope.

- [ ] 1.2.2-SS-2 Implement global and contextual sidecar actions.
  - Keep known sidecars visible and unchecked by default when a pod has a primary container.
  - Add application-scope and cluster/namespace-scope include/exclude actions without requiring
    pod-by-pod repetition.
  - Keep individual overrides where supported and explain the pod-only-sidecar fallback.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: SS-2.1-SS-2.6, CM-1.4
  - _Dependencies: 1.2.2-SS-1, v1.2.1-2
  - _Validation: classifier/selection tests for mixed pods, all-sidecar pods, global action,
    context action, repeated contexts, individual override, and source payload preservation.
  - _Evidence (2026-09-16): `frontend/src/logSourceInventory.test.ts` covers mixed primary and
    sidecar pods, sidecar-only fallback, application/context sidecar actions, repeated contexts,
    and preserved exact source tuples. The modal exposes global and `(cluster, namespace)` bulk
    actions without expanding `consultedContexts`; frontend typecheck, full tests (84/84), and
    build pass. Task remains unchecked pending browser validation.
  - _Definition of done: sidecar inclusion is explicit, scoped, bulk-operable, and cannot select
    an unconsulted context.

- [x] 1.2.2-SS-3 Verify backend contract sufficiency.
  - Inspect the existing normalized inventory and aggregate protocol for application key, context,
    role, source tuple, limits, and safe error data required by the frontend.
  - Make a backend change only if a required field is genuinely absent; preserve the existing
    aggregate and legacy contracts and add focused regression tests for any change.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: SS-1.1-SS-1.6, SS-2.6, LW-2.1-LW-2.4, RA-1.1-RA-1.4
  - _Dependencies: 1.2.2-SS-1, v1.2.0 backend protocol, v1.2.1 source inventory
  - _Validation: existing backend protocol/security tests and a documented finding that either
    confirms no backend change is required or proves the smallest compatible correction.
  - _Evidence (2026-09-16): inspection confirms `normalizePod` returns `application.key`,
    cluster/namespace, container names, and creation-derived age; the frontend's existing
    classifier supplies primary/sidecar/unknown presentation roles from those containers, so
    no backend role field is required. `validateSubscription` preserves explicit source tuples,
    deduplicates them, validates ISO ranges, and applies bounded per-source/aggregate limits;
    `logsSubscription` preserves timestamps, source lifecycle, cancellation, and source-scoped
    partial failures. `safeErrorMessage` removes raw Kubernetes bodies and headers. `index.ts`
    attaches both the aggregate `WS /api/logs` path and the legacy per-pod
    `/api/pods/:cluster/:namespace/:pod/logs` path. Backend tests pass 62/62, typecheck passes,
    and build passes. No backend change was required; no Kubernetes access scope or mutation path
    was added.
  - _Definition of done: the frontend contract is supported without a speculative backend scope
    expansion.

## Phase 2 - Compact modal

- [ ] 1.2.2-CM-1 Rework the modal to summary-first presentation.
  - Put application identity, consulted contexts, counts, role totals, fallback indicators, and
    discovery status in the first visible region.
  - Move pod/container hierarchy behind secondary expansion while preserving context separation,
    selection state, refresh, cancel, and confirmation guards.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: CM-1.1-CM-1.6, SS-1.6, RA-2.1-RA-2.2
  - _Dependencies: 1.2.2-SS-1, 1.2.2-SS-2, v1.2.1-3
  - _Validation: component tests for collapsed/expanded states, selected counts, context labels,
    sidecar action state, loading/partial/stale/empty confirmation, and cancel-without-socket.
  - _Evidence (2026-09-16): `ApplicationLogSourceModal` is summary-first with application
    identity, consulted contexts, pod/container and role/fallback counts, loading/partial/stale/
    empty announcements, global/context sidecar actions, and a secondary details disclosure;
    existing refresh/cancel/confirm guards and pre-confirmation socket boundary are preserved.
    Typecheck, full frontend tests (84/84), and production build pass. Browser/component smoke
    validation was not run, so this task remains unchecked.
  - _Definition of done: the modal communicates scope before detail and never starts a session
    while incomplete or invalid.

## Phase 3 - Dedicated logs workspace

- [ ] 1.2.2-LW-1 Promote logs to the main workspace.
  - Render the confirmed log session in a primary-area workspace with a compact application/context
    header, fixed filter toolbar, virtualized output, and status region.
  - Remove the long confirmed-source list from the primary view while retaining compact source
    status and accessible inspection for diagnosis.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LW-1.1-LW-1.6, RA-2.1-RA-2.4
  - _Dependencies: 1.2.2-CM-1, v1.2.1-4, v1.2.1-5, v1.2.1-6
  - _Validation: component/layout tests for desktop and narrow widths, fixed filters during output
    scroll, compact header state, no long primary source list, and all session status states.
  - _Evidence (2026-09-16): confirmed sources now render `LogViewer` in the main panel with a
    compact application/context/count/status/range header, fixed toolbar, virtualized output,
    secondary source inspection, and explicit Change sources/close actions; the details panel
    retains describe/metrics. Frontend tests pass 86/86, typecheck and production build pass,
    and `git diff --check` passes. Browser/layout smoke was not run, so this task remains
    unchecked.
  - _Definition of done: logs are a usable main-area workspace rather than a narrow details view.

- [ ] 1.2.2-LW-2 Preserve one session and local display state.
  - Keep exactly one aggregate `WS /api/logs`, one subscription, local AND filters, bounded limits,
    virtualization, partial failures, cancellation, and legacy per-pod behavior.
  - Ensure filter, wrap, and display-density changes do not restart or alter the session.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LW-1.3-LW-1.6, LW-2.1-LW-2.5, RA-1.1-RA-1.4
  - _Dependencies: 1.2.2-LW-1, v1.2.0-3.2-3.4, v1.2.1-4-1.2.1-6
  - _Validation: session/filter regression tests proving one socket and unchanged subscribe
    payload across local filter/wrap changes, retention/limit tests, partial-failure tests, and
    legacy endpoint tests.
  - _Evidence (2026-09-16): the aggregate socket effect depends on confirmed sources and
    session range/follow inputs only; filters, wrap, and grouping stay local and are absent from
    the transport dependencies. Existing bounded retention, limits, partial source errors, and
    legacy endpoint code remain unchanged. Frontend tests pass 86/86, typecheck and build pass;
    browser/network smoke was not run, so this task remains unchecked.
  - _Definition of done: presentation changes remain local and all v1.2.0/v1.2.1 session
    boundaries remain intact.

## Phase 4 - Rendering, wrapping, and accessibility

- [ ] 1.2.2-RW-1 Implement no-wrap default and correct wrap measurement.
  - Render no-wrap rows by default with message-column horizontal scrolling.
  - Add a labelled `Wrap lines` toggle that changes only presentation and supports dynamic row
    heights without clipping, overlap, or stale virtualization measurements.
  - Preserve focus, selection, vertical position, auto-scroll, and jump-to-latest behavior.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: RW-1.1-RW-1.5, LW-2.5
  - _Dependencies: 1.2.2-LW-1, 1.2.2-LW-2, v1.2.0-3.4
  - _Validation: rendering tests and browser checks for long, multiline, empty, whitespace,
    timestamp-null, and error messages; verify dynamic row height and horizontal scroll.
  - _Evidence (2026-09-16): added default-off `Wrap lines` state, `measureElement`, explicit
    virtualizer measurement invalidation on mode changes, stable row keys, no-wrap horizontal
    output behavior, and readable empty/timestamp-null rendering. Focused presentation tests,
    frontend tests 86/86, typecheck, and build pass; browser rendering checks were not run, so
    this task remains unchecked.
  - _Definition of done: both modes show complete readable messages and maintain usable
    virtualization.

- [ ] 1.2.2-RW-2 Stabilize metadata columns and responsive states.
  - Use stable metadata tracks for timestamp, cluster/namespace, pod, and container; constrain
    metadata overflow to its own area and keep messages selectable/readable.
  - Verify no overlap or page-level overflow at desktop, tablet, narrow, high-zoom, and reduced-
    motion settings.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: RW-2.1-RW-2.5, RA-2.1-RA-2.4
  - _Dependencies: 1.2.2-LW-1, 1.2.2-RW-1
  - _Validation: focused layout/accessibility tests, keyboard traversal, visible focus assertions,
    accessible names/state announcements, and available responsive screenshots.
  - _Evidence (2026-09-16): log rows use stable timestamp, context, pod/container, and message
    grid tracks with bounded metadata truncation; the output owns horizontal scrolling and the
    workspace has narrow viewport overrides plus accessible labels/statuses. Typecheck, build,
    focused tests, and `git diff --check` pass. High-zoom, reduced-motion, keyboard, and browser
    responsive checks were not run, so this task remains unchecked.
  - _Definition of done: metadata never mixes with messages and controls remain reachable/readable.

## Phase 5 - Regression and integration QA

- [ ] 1.2.2-RA-1 Run focused automated regression and safety checks.
  - Cover v1.2.1 defaults/modal/session behavior plus the v1.2.2 consulted-context rule, sidecar
    actions, compact modal, workspace, wrap rendering, safe errors, one socket, limits, partial
    failures, and legacy endpoint.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: RA-1.1-RA-1.4, LW-2.1-LW-2.5, Definition of done
  - _Dependencies: 1.2.2-SS-3, 1.2.2-CM-1, 1.2.2-LW-2, 1.2.2-RW-2
  - _Validation: `npm test --workspaces --if-present`, `npm run typecheck --workspaces --if-present`,
    `npm run build --workspaces --if-present`, `git diff --check`, and source/error safety audit.
  - _Definition of done: automated evidence identifies regressions or confirms preserved release
    boundaries; unavailable checks are recorded as limitations.
  - _Evidence (2026-09-16): `npm test --workspaces --if-present` passed backend 62/62 and
    frontend 86/86; `npm run typecheck --workspaces --if-present`,
    `npm run build --workspaces --if-present`, and `git diff --check` passed. Static audit found
    one aggregate `WS /api/logs`, the legacy per-pod WebSocket, local-only AND filters/wrap/grouping,
    bounded source/aggregate limits, source-scoped partial failures, and sanitized Kubernetes/log
    errors. Kubernetes client usage is limited to list/read/log/metrics calls; no cluster mutation
    method was found. Automated evidence passes, but this task remains unchecked because browser
    rendering/network/accessibility checks were unavailable. The app also exposes POST
    `/api/kubeconfig/select`, which changes only the local selected kubeconfig and was not called;
    therefore the broader claim of zero application-side mutations needs that administrative
    endpoint explicitly scoped or reviewed.

- [ ] 1.2.2-IQ-1 Exercise read-only end-to-end scenarios.
  - Validate one application in one consulted context and multiple consulted contexts, repeated
    names, mixed primary/sidecar pods, sidecar-only fallback, global/contextual actions, stale or
    partial inventory, source failure, limits, cancellation, and legacy per-pod logs.
  - Confirm default source tuples, no unconsulted context expansion, one aggregate WebSocket,
    fixed local filters, wrap behavior, and readable responsive output.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: SS-1.1-SS-1.6, SS-2.1-SS-2.6, LW-1.1-LW-2.5, RW-1.1-RW-2.5, IQ-1.1-IQ-1.4
  - _Dependencies: 1.2.2-RA-1, 1.2.2-RW-2
  - _Validation: documented read-only Kubernetes and browser scenarios, including keyboard smoke
    checks where tooling exists; no mutation verbs or kubeconfig exposure.
  - _Definition of done: the complete selection-to-workspace flow is validated without cluster
    mutation and with limitations explicitly recorded.
  - _Evidence (2026-09-16): `kubectl config get-contexts` listed both reference contexts;
    `kubectl get pods --context kubernetes-qa-tb -n bank-overdraft` and the equivalent `qa-gt`
    query returned live pods, each with the expected `2/2` readiness. GET `/api/contexts` returned
    both contexts without credentials, and GET `/api/health` returned `readOnly: true`. A real
    aggregate WebSocket subscription with one `overdraft-bff` source per context was accepted,
    emitted one line from each source, preserved both source IDs, and ended with `summary=completed`
    under limits; the real legacy per-pod WebSocket emitted `started`, `line`, and `end`. Unit tests
    cover consulted-context defaults/exclusion, repeated names, sidecar actions/fallback, stale and
    partial states, cancellation, limits, safe errors, local filters, no-wrap defaults, and legacy
    compatibility. No browser runner was available, so selection-to-workspace, responsive output,
    keyboard traversal, visual wrap measurement, and accessible focus states were not exercised;
    no real cluster without metrics-server was available for the graceful-degradation smoke. No
    mutating Kubernetes command or kubeconfig-selection POST was run. Task remains unchecked.

- [ ] 1.2.2-IQ-2 Perform release-scope audit and handoff.
  - Verify requirements/design/tasks consistency, v1.2.1 history preservation, one transport,
    legacy compatibility, read-only behavior, responsive/accessibility evidence, and unresolved
    limitations.
  - Do not mark implementation tasks complete from the specification alone.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: RA-1.1-RA-1.4, RA-2.1-RA-2.4, IQ-1.1-IQ-1.4, Definition of done
  - _Dependencies: 1.2.2-RA-1, 1.2.2-IQ-1
  - _Validation: final read-only source/API audit, test result review, `git diff --check`, and
    explicit implementation handoff listing the next task IDs or residual risks.
  - _Definition of done: implementation agents have a precise, evidence-backed release gate.
  - _Evidence (2026-09-16): release-scope review confirms v1.2.1 transport/legacy boundaries are
    present, v1.2.2 source tuples remain context-qualified, and filters/wrap do not restart the
    aggregate session according to `LogViewer` dependencies and focused tests. Static route review
    found GET health/contexts/describe/metrics plus POST query envelopes for pods/namespaces; the
    Kubernetes calls remain read-only. Safe-error tests reject raw response bodies/headers and the
    live context response exposed names only. Residual risks are the unavailable browser/layout/
    keyboard evidence, no live missing-metrics-server scenario, and the local administrative POST
    `/api/kubeconfig/select` noted under RA-1. RA-1 and IQ-1 therefore remain open, so IQ-2 is also
    unchecked and is a handoff rather than a release approval.

## Definition of done

- [ ] Every task above is implemented by its named owner and has focused validation evidence.
- [ ] Defaults, sidecar actions, compact modal, workspace layout, rendering contract, and
  accessibility behavior agree across requirements, design, and implementation.
- [ ] All v1.2.0/v1.2.1 transport, limits, virtualization, partial-failure, legacy, read-only,
  and security boundaries remain intact.
- [ ] Tests, typechecks, builds, responsive/accessibility checks, and read-only integration checks
  pass or have explicit limitations recorded.
- [ ] Package versioning, commit, tag, and publication remain separate approved actions.
