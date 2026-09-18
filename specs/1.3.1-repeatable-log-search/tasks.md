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

- [ ] 1.3.1-RS-1 Confirm the repeat boundary and current protocol capability.
  - Review the existing Live replacement-session effect, History generation/query protocol, stale
    response guards, source-selection boundary, and completion events.
  - Record whether an equal-value activation can be represented with the existing client/session
    contract and identify the smallest missing trigger or identity field, if any.
  - Confirm that no new backend search endpoint, Kubernetes permission, or mutation path is needed.
  - Validation: source review plus existing backend protocol/history/WebSocket/security tests.

- [ ] 1.3.1-RS-2 Implement independent draft and operation state.
  - Keep draft/applied equality as the pending-change classifier.
  - Make idle Search availability independent of pending-change equality.
  - Capture each activation in a distinct request/session attempt so equal-value activations cannot
    be collapsed by state equality.
  - Ignore duplicate activation while the current operation is busy.
  - Validation: focused frontend state tests for idle enabled, equal-value repeat, rapid duplicate,
    invalid input, and draft edits during busy.

- [ ] 1.3.1-RS-3 Preserve the activation matrix.
  - Keep pending local-filter-only Search local for Live and compatible with the existing History
    query path.
  - Keep pending transport/mode changes as one replacement Live session or History generation.
  - Make equal-value Repeat Search refresh Live with a new aggregate session and History with a new
    generation.
  - Preserve selected source tuples and applied filters across the repeat operation.
  - Validation: frontend tests asserting socket/session/generation counts, retained-event behavior,
    relative-range refresh, and stale result rejection.

- [ ] 1.3.1-RS-4 Implement mode-specific busy completion and feedback.
  - Keep Search busy through Live acceptance or terminal failure.
  - Keep History Search busy through terminal snapshot status and initial query readiness, without
    conflating later virtualized window loading with the main Search operation.
  - Return Search to enabled idle state after completion, partial readiness, cancellation, or safe
    failure according to the applicable contract.
  - Preserve validation errors, connection status, History status, partial results, and safe error
    wording.
  - Validation: focused tests for completion events, premature History acceptance, partial/error
    outcomes, `aria-busy`, status text, and stable button geometry.

- [ ] 1.3.1-RS-5 Run frontend regression and accessibility checks.
  - Cover draft/applied semantics, local AND filters, Follow, ranges, Pause, retained-event Clear,
    Group, Wrap lines, source scope, keyboard activation, visible focus, and responsive layouts.
  - Verify Search remains usable at desktop, tablet, mobile, and high-zoom widths without overlap or
    page-level horizontal overflow.
  - Validation: frontend test suite, typecheck, build, browser/Electron checks where available,
    and `git diff --check`.

- [ ] 1.3.1-RS-6 Run read-only integration and security evidence.
  - Exercise one initial Search followed by same-value Live Repeat Search and same-value History
    Repeat Search.
  - Verify one replacement session or generation per idle activation, no duplicate operation under
    rapid activation, refreshed relative ranges, stale-result rejection, partial/error recovery,
    and preserved source scope.
  - Confirm no Kubernetes mutation, credential/kubeconfig exposure, new permission, packaging, or
    release action occurred.
  - Validation: read-only integration QA record with environment, commands, evidence counts, and
    explicit unavailable checks.

## Validation record

Implementation owners SHALL append evidence here only after the corresponding task is actually
validated. A checked task requires concrete test or source evidence and SHALL record residual
limitations; it does not imply release approval.

- Frontend focused tests: pending.
- Backend protocol/history/WebSocket/security tests: pending compatibility review.
- Frontend typecheck/build: pending.
- Backend typecheck/build: pending if backend remains unchanged; otherwise pending.
- Read-only integration and accessibility evidence: pending.
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
