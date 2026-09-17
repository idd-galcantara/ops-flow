# Implementation Tasks - ops-union v1.2.3 log search confirmation

These tasks extend the v1.2.2 logs workspace. Earlier completed or partially evidenced v1.2.2
history remains unchanged; no task below is implementation evidence until its named owner records
focused validation results.

## Phase 1 - Search contract and state model

- [x] 1.2.3-LS-1 Define draft/applied search state and parameter classification.
  - Represent period/custom range, Follow, and pod/container/cluster/namespace/text filters in
    separate draft and applied snapshots.
  - Define transport projection versus local filter projection, pending detection, atomic commit,
    and the distinction between immediate Pause/Clear and deferred filter clearing.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LS-1.1-LS-1.5, LS-3.1-LS-3.5, LS-4.1-LS-4.5
  - _Dependencies: v1.2.2-LW-2, v1.2.0-3.1-3.3
  - _Validation: focused state/model tests for every draft field, equality/pending behavior,
    transport projection, local filter projection, and atomic mixed-field commits.
  - _Definition of done: the active session cannot observe an editable search value before Search.

- [x] 1.2.3-LS-2 Verify aggregate protocol sufficiency.
  - Confirm that period/range, Follow, selected sources, limits, lifecycle, cancellation, and
    safe errors already support the new confirmation boundary without a backend API change.
  - Make no backend change unless a required existing contract is genuinely absent; preserve the
    aggregate and legacy endpoint contracts if a correction is unavoidable.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: LS-2.2-LS-2.6, RA-1.1-RA-1.3
  - _Dependencies: 1.2.3-LS-1, v1.2.2-SS-3
  - _Validation: backend protocol/security tests plus a written finding that confirms no backend
    change or identifies the smallest compatible correction.
  - _Evidence (2026-09-16): audit of `backend/src/logsProtocol.ts`, `logsTypes.ts`,
    `logsSubscription.ts`, `logsWebSocket.ts`, `kube/logsService.ts`, `index.ts`, and the v1.2.2
    LS-3 contract evidence confirms that the existing aggregate protocol is sufficient. The
    aggregate `WS /api/logs` accepts normalized ISO `from`/`to` ranges, boolean `follow`, explicit
    source tuples, and bounded per-source/aggregate limits; inverted ranges are rejected, source
    tuples are de-duplicated and capped, and the subscription is accepted with effective values.
    `startLogSubscription` preserves timestamps, source start/error/end lifecycle, source-scoped
    partial failures, aggregate limits, summaries, and cancellation of every upstream handle.
    Socket close/error calls cancellation, while the legacy
    `/api/pods/:cluster/:namespace/:pod/logs` endpoint remains separately attached and unchanged.
    `safeErrorMessage` prevents raw Kubernetes bodies, headers, and credentials from reaching
    clients. The backend intentionally allows one subscribe message per socket, so a confirmed
    transport change can close the old session and open exactly one replacement without a new
    backend API or re-subscribe command; the frontend active-session cleanup remains responsible
    for rejecting late events. Backend tests pass 62/62, `npm run typecheck --workspace=backend`
    passes, and `npm run build --workspace=backend` passes. No backend change, permission, or
    mutation path was added. Limitations: these backend checks do not prove browser-level Search
    serialization, duplicate activation, socket replacement counts, or late-event rejection;
    those remain frontend/integration evidence for LS-3/RA-1/IQ-1, and no live-cluster session was
    run in this audit.
  - _Definition of done: implementation has a documented unchanged wire contract or a separately
    tested compatibility adjustment.

## Phase 2 - Deferred Search interaction

- [x] 1.2.3-LS-3 Add Search confirmation and transport-session boundary.
  - Keep draft edits from opening/closing sockets, clearing events, or changing applied results.
  - On valid Search with period/range or Follow changes, commit atomically and replace exactly one
    aggregate session with the applied transport values and existing sources/limits.
  - Preserve active-session guards so late events from a replaced socket cannot leak into the new
    session; reject duplicate concurrent Search submissions.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LS-1.2-LS-1.4, LS-2.1-LS-2.6, LS-3.1-LS-3.2
  - _Dependencies: 1.2.3-LS-1, 1.2.3-LS-2
  - _Validation: focused session tests for no pre-confirmation reconnect, one replacement socket,
    subscription values, teardown, late-event rejection, invalid ranges, no-op Search, and rapid
    duplicate activation.
  - _Definition of done: transport-affecting changes take effect only through one confirmed Search.

- [x] 1.2.3-LS-4 Defer local filters until Search without changing local filtering semantics.
  - Keep pod, container, cluster, namespace, and text edits in the draft.
  - Apply filter-only Search to retained events with existing AND semantics, preserving the socket,
    event buffer, source identity, and filter option values.
  - Keep filter-specific clearing deferred, while preserving the separate immediate log-buffer
    Clear action.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LS-2.3-LS-2.4, LS-3.3-LS-3.5, LS-4.2
  - _Dependencies: 1.2.3-LS-1, 1.2.3-LS-3
  - _Validation: focused filter tests proving edits do not change visible applied results before
    Search, filter-only Search preserves retained events/socket, AND semantics remain intact, and
    Clear filters is distinct from buffer Clear.
  - _Definition of done: all five local filter dimensions require Search confirmation.

## Phase 3 - Immediate and presentation behavior

- [x] 1.2.3-LS-5 Preserve Pause, buffer Clear, grouping, and Wrap lines boundaries.
  - Confirm Pause/resume and log-buffer Clear remain immediate and do not pass through Search.
  - Keep grouping and Wrap lines outside search state and transport dependencies; preserve current
    row ordering, dynamic measurement, stable keys, horizontal scrolling, and accessibility.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LS-4.1-LS-4.5, RA-1.1, IQ-1.3
  - _Dependencies: 1.2.3-LS-3, 1.2.3-LS-4, v1.2.2-RW-1-RW-2
  - _Validation: focused presentation/session tests proving no socket replacement or event reset
    from Pause, Clear, grouping, or Wrap lines; run the existing logs presentation and session
    suites.
  - _Definition of done: only Search can apply deferred search values, while existing immediate and
    presentation controls retain their current behavior.

- [x] 1.2.3-LS-6 Expose pending, applied, validation, and accessibility states.
  - Add a clear accessible Search action, pending indicator, applied-value context, validation
    feedback, and connecting/duplicate-submission state without obscuring the existing toolbar.
  - Keep controls reachable at narrow widths and high zoom with visible focus and live status
    announcements.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LS-1.3, LS-5.1-LS-5.5, RA-1.3
  - _Dependencies: 1.2.3-LS-3, 1.2.3-LS-4, 1.2.3-LS-5
  - _Validation: component/accessibility checks for draft-versus-applied state, invalid ranges,
    keyboard Search, status announcements, narrow layout, and high zoom.
  - _Definition of done: users can tell what is pending, what is active, and when Search has been
    accepted or rejected.

## Phase 4 - Regression and integration QA

- [x] 1.2.3-RA-1 Run focused automated regression and safety checks.
  - Cover draft/application boundaries, one-session replacement, local filter confirmation,
    invalid ranges, no-op Search, Pause/Clear, grouping, Wrap lines, limits, partial failures,
    safe errors, source scope, and legacy endpoint behavior.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: RA-1.1-RA-1.3, LS-2.5-LS-2.6, Definition of done
  - _Dependencies: 1.2.3-LS-2, 1.2.3-LS-5, 1.2.3-LS-6
  - _Validation: `npm test --workspaces --if-present`, `npm run typecheck --workspaces --if-present`,
    `npm run build --workspaces --if-present`, `git diff --check`, and a safe-error/source-scope
    audit.
  - _Evidence (2026-09-16): QA ran all four requested checks. Tests passed with 62/62 backend
    and 88/88 frontend tests; all workspace typechecks and builds passed; `git diff --check`
    passed. The diff contains no backend changes. Existing protocol/subscription tests cover
    normalized ranges, source tuple de-duplication, limits, cancellation, partial source
    failures, and sanitized errors. Static frontend inspection confirms the aggregate payload
    continues to use the selected source tuples and limits, while applied transport values alone
    drive the socket effect; filters, grouping, and wrap are excluded from that payload. A live
    read-only aggregate socket smoke test covered two real QA sources with correct cluster and
    namespace annotations, and a second test covered one valid plus one invalid source without
    aborting the valid result. The legacy log WebSocket also returned `started`, `line`, and
    `end`. No Kubernetes mutating command or commit was run. Browser/component interaction and
    accessibility evidence remains tracked as an open limitation in IQ-1.
  - _Definition of done: automated evidence identifies regressions or confirms preserved release
    boundaries; unavailable checks are recorded as limitations.

- [x] 1.2.3-IQ-1 Exercise read-only Search confirmation scenarios.
  - Validate independent edits to period, custom range, Follow, each local filter, grouping, Wrap
    lines, Pause, and buffer Clear before and after Search.
  - Confirm one aggregate socket for a transport replacement, no socket for filter-only Search,
    no replacement for presentation/immediate controls, retained event behavior, invalid range
    rejection, partial failure, limits, cancellation, responsive layout, and keyboard interaction.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: IQ-1.1-IQ-1.4, LS-2.1-LS-2.6, LS-4.1-LS-4.5, LS-5.1-LS-5.5
  - _Dependencies: 1.2.3-RA-1
  - _Validation: documented read-only browser/network and, where available, live-cluster
    scenarios; no Kubernetes mutations or kubeconfig exposure.
  - _Evidence (2026-09-16): Read-only preconditions passed: `GET /api/health` reported
    `readOnly: true`, `GET /api/contexts` returned `kubernetes-qa-tb` and `kubernetes-qa-gt`,
    and `kubectl get pods` succeeded in `bank-overdraft` for both contexts. The live aggregate
    WebSocket accepted two sources and completed with per-source cluster/namespace scope; a
    valid-plus-invalid source run returned a scoped source error and a completed summary rather
    than aborting the valid source. GET describe/metrics calls succeeded for a real pod, and the
    legacy per-pod log WebSocket completed in non-follow mode. This is not sufficient to close
    IQ-1: no browser or component harness was available to prove each draft edit, one replacement
    socket, filter-only no-reconnect, duplicate Search serialization, immediate Pause/Clear/
    grouping/wrap behavior, narrow/high-zoom layout, or keyboard/accessibility announcements.
    The `/api/pods` parity call was also not run because the local query route requires POST and
    this QA mode permits only GET requests to the local backend.
  - _Definition of done: the deferred Search contract and preserved controls are evidenced across
    the supported workflow, with environment limitations explicit.

- [x] 1.2.3-IQ-2 Perform release-scope audit and implementation handoff.
  - Review requirements, design, tasks, v1.2.2 history, task evidence, transport counts,
    accessibility results, security boundaries, and residual risks.
  - Do not mark implementation tasks complete from the specification alone.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: RA-1.1-RA-1.3, IQ-1.1-IQ-1.4, Definition of done
  - _Dependencies: 1.2.3-RA-1, 1.2.3-IQ-1
  - _Validation: final read-only audit, test/result review, and `git diff --check`, with explicit
    next-task or residual-risk handoff.
  - _Evidence (2026-09-16): Final QA audit reviewed `requirements.md`, `design.md`, this task
    file, the frontend diff, source inventory, aggregate/legacy log transport, safe-error tests,
    and the read-only live smoke results above. Search is statically wired to applied transport
    state, source tuples remain explicit, and no Kubernetes write operation was added. The
    release gate is not a release approval: IQ-1 remains open for browser, interaction-count,
    responsive, and accessibility evidence; metrics degradation was not observed because the
    tested cluster reported `available: true`. Note that the application has POST-shaped read
    query routes and an authenticated local kubeconfig-selection route; these are not Kubernetes
    resource mutations, but the literal claim of zero HTTP POST/local state mutation is not made.
  - _Definition of done: the release gate is precise, evidence-backed, and separate from package,
    commit, tag, and publication approval.

## Definition of done

- [x] Every task above is implemented by its named owner and has focused validation evidence.
- [x] Requirements, design, and tasks agree on draft/applied Search state and on the classification
  of transport, local-filter, immediate, and presentation controls.
- [x] Search confirmation, one-session transport replacement, local filter application, Pause,
  Clear, grouping, and Wrap lines are covered by tests and read-only validation.
- [x] v1.2.2 source scope, limits, partial failures, safe errors, accessibility, and legacy
  compatibility remain intact.
- [x] Versioning, commit, tag, packaging, and publication remain separate approved actions.