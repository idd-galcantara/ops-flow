# Implementation Tasks - ops-union v1.3.1 repeatable log search

These tasks define the repeatable Search contract and implementation handoff. They are initially
unchecked: the specification does not claim implementation, validation, release approval, or
completion. No task authorizes Kubernetes mutation, packaging, publishing, commit, or release
activity.

## Ownership and sequencing

- `@ops-union-frontend` owns the Search state, repeat trigger, busy UI, and focused frontend tests.
- `@ops-union-backend` owns a read-only protocol compatibility check and any narrowly required
  backend tests or generation adjustment.
- `@ops-union-integration-qa` owns read-only transport, History-generation, stale-response,
  responsive, keyboard, accessibility, security, and scope evidence.
- The repository maintainer owns final convergence of evidence and residual limitations.
- Backend protocol review and frontend state design should precede implementation changes; focused
  tests should be added with each behavior change; read-only integration follows local checks.

## Tasks

- [x] 1.3.1-RS-1 Confirm the repeat boundary and current protocol capability.
  - Review the existing Live replacement-session effect, History generation/query protocol, stale
    response guards, source-selection boundary, and completion events.
  - Record that the backend accepts one initial subscription per WebSocket, so Live repeat is
    represented by one new socket and History repeat by one new socket plus one positive generation.
  - Record whether the current client can capture the candidate values, activation-time resolved
    range, and exact source tuples as one operation snapshot, identifying the smallest missing
    trigger or identity field, if any.
  - Confirm that no new backend search endpoint, Kubernetes permission, or mutation path is needed.
  - _Copilot agent: @ops-union-backend_
  - Requirements: RS-1.4 through RS-1.8, RS-2.2, RS-5.3 through RS-5.5.
  - Validation: source review plus `cd backend && npm test && npm run typecheck` and existing
    protocol/history/WebSocket/security tests.
  - Evidence: backend review confirmed one initial subscription per Live WebSocket, monotonic
    History generations, and existing `history.terminal`/`history.query.ready` events. Backend
    tests: 88 passed; typecheck passed; no backend change required.

- [x] 1.3.1-RS-2 Implement independent draft and operation state.
  - Keep draft/applied equality as the pending-change classifier.
  - Make idle Search availability independent of pending-change equality.
  - Capture each accepted activation in an immutable snapshot with a monotonic request identity,
    activation-time resolved range, and exact source tuples so equal-value activations cannot be
    collapsed by state equality or later draft edits.
  - Ignore duplicate activation while the current operation is busy.
  - _Copilot agent: @ops-union-frontend_
  - Requirements: RS-1.1 through RS-1.3, RS-1.6 through RS-1.8, RS-2.1 through RS-2.2, RS-2.6 through RS-2.8, RS-3.1 through RS-3.2, RS-4.3 through RS-4.5.
  - Validation: focused frontend state/component tests for idle enabled, equal-value repeat, rapid
    duplicate, invalid input, snapshot immutability, and draft edits during busy.
  - Evidence: `logsSearch.ts` now drives activation decisions and immutable snapshots used by
    `LogViewer.tsx`; focused frontend tests cover repeat, busy rejection, invalid ranges, and
    draft/snapshot isolation.

- [x] 1.3.1-RS-3 Preserve the activation matrix.
  - Keep pending local-filter-only Search local for Live and compatible with the existing History
    query path.
  - Keep pending transport/mode changes as one replacement Live session or History generation.
  - Make equal-value Repeat Search refresh Live with a new aggregate session and History with a new
    generation.
  - Preserve selected source tuples and applied filters across the repeat operation.
  - _Copilot agent: @ops-union-frontend_
  - Requirements: RS-1.4 through RS-1.6, RS-2.3 through RS-2.5, RS-5.1 through RS-5.5.
  - Validation: frontend tests asserting one new socket/session or generation per repeat, no new
    socket/generation for filter-only confirmation, retained-event behavior, activation-time
    relative-range refresh, exact source scope, and stale result rejection.
  - Evidence: activation helper tests cover Live/History repeats, local-only versus transport
    decisions, activation-time relative ranges, and exact source snapshot cloning. Existing
    history cache tests cover stale generation rejection. Browser-level transport counting is
    unavailable because the repository has no browser/Electron test harness.

- [x] 1.3.1-RS-4 Implement mode-specific busy completion and feedback.
  - Keep Search busy through Live acceptance or terminal failure.
  - Keep History Search busy through terminal snapshot status and initial query readiness, without
    conflating later virtualized window loading with the main Search operation.
  - Return Search to enabled idle state after completion, partial readiness, cancellation, or safe
    failure according to the applicable contract.
  - Keep filter-only History confirmation idle after commit while same-generation query/window
    loading uses its independent indicator; do not clear Search busy at `history.accepted` for a
    transport-affecting History operation.
  - Preserve validation errors, connection status, History status, partial results, and safe error
    wording.
  - _Copilot agent: @ops-union-frontend_
  - Requirements: RS-2.7 through RS-2.8, RS-3.3 through RS-3.7, RS-4.1 through RS-4.3, RS-5.2.
  - Validation: focused tests for `accepted` versus terminal/query-ready completion events,
    premature History acceptance, filter-only History loading, partial/error/cancel outcomes,
    `aria-busy`, status text, and stable button geometry.
  - Evidence: `LogViewer.tsx` retains History transport busy until terminal plus query-ready,
    keeps filter-only confirmation independent, and exposes `aria-busy`, loader, and status text.
    Pure lifecycle tests passed; browser geometry/focus checks remain unavailable.

- [x] 1.3.1-RS-5 Run frontend regression and accessibility checks.
  - Cover draft/applied semantics, local AND filters, Follow, ranges, Pause, retained-event Clear,
    Group, Wrap lines, source scope, keyboard activation, visible focus, and responsive layouts.
  - Verify Search remains usable at desktop, tablet, mobile, and high-zoom widths without overlap or
    page-level horizontal overflow.
  - _Copilot agent: @ops-union-frontend_
  - Requirements: RS-4.1 through RS-4.6, RS-5.1 through RS-5.4, RA-1.1 through RA-1.5.
  - Validation: `cd frontend && npm test && npm run typecheck && npm run build`, browser/Electron
    checks where available, and `git diff --check`.
  - Evidence: frontend tests: 103 passed; typecheck and build passed; `git diff --check` passed.
    No browser, Electron, screen-reader, or responsive/high-zoom harness is present.

- [x] 1.3.1-RS-6 Run read-only integration and security evidence.
  - Exercise one initial Search followed by same-value Live Repeat Search and same-value History
    Repeat Search.
  - Verify one replacement session or generation per idle activation, no duplicate operation under
    rapid activation, refreshed relative ranges, stale-result rejection, partial/error recovery,
    and preserved source scope.
  - Confirm no Kubernetes mutation, credential/kubeconfig exposure, new permission, packaging, or
    release action occurred.
  - _Copilot agent: @ops-union-integration-qa_
  - Requirements: IQ-1.1 through IQ-1.5, RS-5.3 through RS-5.5.
  - Validation: read-only integration QA record with environment, commands, operation/socket/
    generation counts, evidence, and explicit unavailable checks.
  - Evidence: read-only QA exercised health/contexts/describe, real aggregate WebSocket sources,
    and metrics against available QA contexts; no Kubernetes mutation, packaging, or release was
    performed. Repeat UI transport counts and browser accessibility checks remain unavailable.

## Validation record

Implementation owners SHALL append evidence here only after the corresponding task is actually
validated. A checked task requires concrete test or source evidence and SHALL record residual
limitations; it does not imply release approval.

- Frontend focused tests: 103 passed; typecheck and build passed.
- Backend protocol/history/WebSocket/security tests: 88 passed; typecheck passed; no backend change.
- Frontend typecheck/build: passed.
- Backend typecheck/build: typecheck passed; backend source unchanged.
- Read-only integration and accessibility evidence: read-only QA passed for available API/WebSocket
  and cluster checks; browser/Electron/screen-reader/responsive checks unavailable.
- Packaging, publishing, commit, and release: intentionally out of scope for this handoff.

## Definition of done

- Equal-value Search is an explicit repeat operation in both Live and History modes.
- Pending-change Search keeps the v1.2.3/v1.3.0 activation matrix.
- Search is enabled while idle, visibly busy during the defined operation, and enabled again at the
  correct completion boundary.
- Duplicate operations, stale results, source-scope widening, unsafe output, and read-only boundary
  regressions are covered by focused evidence.
- Residual browser, Electron, cluster, or assistive-technology limitations are recorded honestly.
- This task list does not authorize implementation beyond the scoped change, commit, packaging, or
  release publication.
