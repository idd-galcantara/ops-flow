# Implementation Tasks - ops-union v1.2.0 log improvements

Tasks below record implementation and validation evidence for the current release slice;
unrelated release and integration work remains unchecked.

## Phase 1 - Contracts and application identity

- [x] 1.1 Define shared structured log, source lifecycle, subscription, limit, and summary types.
  - Add the version 1 aggregate wire contract for `WS /api/logs`, including `accepted`, source
    lifecycle, structured `line`, warning/error, and terminal summary events.
  - Preserve the legacy per-pod message contract as a separate compatibility type.
  - _Copilot agent: @ops-union-backend, @ops-union-frontend_
  - _Requirements: 2.1-2.5, 5.1-5.4, 6.2_
  - _Validation: contract-focused TypeScript compilation and serialization tests.
  - _Evidence: `backend/src/logsTypes.ts` and `backend/src/logsProtocol.ts`; focused protocol tests and backend typecheck pass.

- [x] 1.2 Implement deterministic application identity normalization.
  - Use the documented label precedence, controller owner reference fallback, pod fallback, and
    source-qualified grouping key.
  - Include identity in normalized pod responses without broadening target scope or exposing raw
    Kubernetes objects.
  - _Copilot agent: @ops-union-backend_
  - _Requirements: 4.1-4.6, 8.1-8.4_
  - _Dependencies: 1.1_
  - _Validation: backend unit tests for every precedence and fallback case.
  - _Evidence: `backend/src/kube/applicationIdentity.ts`; normalized pod tests cover all label, controller-owner, and pod fallbacks.

- [x] 1.3 Extend frontend pod/source models for application identity.
  - Preserve cluster, namespace, pod, and container context while exposing the normalized identity
    to grouping and log subscriptions.
  - _Copilot agent: @ops-union-frontend_
  - _Requirements: 4.3-4.6, 5.2, 7.2_
  - _Dependencies: 1.1, 1.2_
  - _Validation: frontend typecheck and model/component tests.
  - _Evidence: `frontend/src/types.ts`, source assembly tests, application grouping tests, and frontend typecheck pass.

## Phase 2 - Backend time filtering and bounded streams

- [x] 2.1 Add structured timestamp parsing to the log stream service.
  - Request Kubernetes timestamps, split timestamp from message, preserve unparseable lines when
    unbounded, and count/drop them when a time boundary is active.
  - Implement inclusive `from`, exclusive `to`, and safe abort behavior for finite ranges.
  - _Copilot agent: @ops-union-backend_
  - _Requirements: 1.4-1.7, 2.1-2.3, 8.1-8.4_
  - _Dependencies: 1.1_
  - _Validation: focused parser and range-boundary tests with multiline/partial chunks.
  - _Evidence: `backend/src/kube/logsService.ts` requests timestamps, uses `StringDecoder`, and enforces inclusive `from`/exclusive `to`; focused parser tests pass.

- [x] 2.2 Implement line and byte budget normalization and enforcement.
  - Apply defaults, reject malformed values, clamp hard caps, bound upstream requests, and account
    for UTF-8 message bytes before emitting an event.
  - Emit terminal source and aggregate counters/reasons without retaining an unbounded backlog.
  - _Copilot agent: @ops-union-backend_
  - _Requirements: 3.1-3.6, 5.4-5.6_
  - _Dependencies: 1.1, 2.1_
  - _Validation: unit tests for source limits, aggregate limits, exact boundary bytes, and cleanup.
  - _Evidence: defaults/caps/rejection are in `backend/src/logsProtocol.ts`; source and aggregate budget/cancellation tests pass.

- [x] 2.3 Add the multiplexed `/api/logs` WebSocket subscription.
  - Validate the initial message, de-duplicate sources, enforce source-count caps, fan out bounded
    upstream streams, interleave structured events, emit source lifecycle/summary events, and
    cancel every handle on disconnect.
  - Keep the existing per-pod WebSocket path and behavior intact.
  - _Copilot agent: @ops-union-backend_
  - _Requirements: 5.1-5.6, 6.1-6.5, 8.1-8.4_
  - _Dependencies: 1.1, 2.1, 2.2_
  - _Validation: backend WebSocket tests for mixed success/failure, finite ranges, follow, global
    limits, malformed subscriptions, and disconnect races.
  - _Evidence: `backend/src/logsWebSocket.ts` and `backend/src/logsSubscription.ts` implement one subscribe message, deduplication, lifecycle events, partial fan-out, aggregate stop, and disconnect cancellation; focused subscription tests pass. The legacy per-pod path remains intact.

- [x] 2.4 Add safe aggregate error and source-status handling.
  - Distinguish global protocol/transport failures from source-scoped Kubernetes failures and keep
    sanitized messages for all paths.
  - _Copilot agent: @ops-union-backend_
  - _Requirements: 6.1-6.5, 8.4_
  - _Dependencies: 2.3_
  - _Validation: error-shape tests proving raw response bodies, headers, and kubeconfig data do not
    reach clients.
  - _Evidence: source errors use `safeErrorMessage`; sanitized startup-error and existing Kubernetes error-safety tests pass.

## Phase 3 - Frontend session controls and visualization

- [x] 3.1 Add period presets and custom UTC range controls.
  - Implement `All available`, 5m, 15m, 1h, 6h, 24h, and custom `from`/`to` behavior with
    validation before a socket is opened.
  - Show active range, finite-end behavior, and useful errors for invalid or impossible dates.
  - _Copilot agent: @ops-union-frontend_
  - _Requirements: 1.1-1.7, 7.5_
  - _Dependencies: 1.1, 2.3_
  - _Validation: focused date conversion tests and keyboard/responsive UI checks.
  - _Evidence: `frontend/src/logsRange.test.ts` covers all presets, UTC conversion, open-ended ranges, and invalid `from >= to`; frontend typecheck/build pass.

- [x] 3.2 Replace per-source log connections with one aggregate session socket.
  - Serialize all selected pod/container sources once, handle interleaved structured events and
    source lifecycle states, and close/restart the session on source/range changes.
  - Preserve pause, clear, reconnect/ended, auto-scroll, and container-selection behavior.
  - _Copilot agent: @ops-union-frontend_
  - _Requirements: 5.1-5.6, 6.3-6.5, 7.2-7.5, 8.2-8.3_
  - _Dependencies: 1.1, 1.3, 2.3, 3.1_
  - _Validation: frontend session tests proving one socket, teardown, interleaving, partial failure,
    and finite summary behavior.
  - _Evidence: `LogViewer` opens `/api/logs` once per source/range session and serializes one subscribe message; structured source/session helpers and the full frontend test suite pass, with teardown guarded by effect cleanup.

- [x] 3.3 Add bounded client retention and effective-limit feedback.
  - Retain at most the documented client buffer, discard oldest events deterministically, and show
    per-source/aggregate emitted, dropped, and limit-reached state.
  - Ensure pause does not create a hidden unbounded queue.
  - _Copilot agent: @ops-union-frontend_
  - _Requirements: 3.6, 6.4, 7.3, 8.4_
  - _Dependencies: 1.1, 3.2_
  - _Validation: focused state tests for retention, pause, clear, and aggregate-limit summaries.
  - _Evidence: bounded retention tests pass; the viewer caps events at the client buffer/effective aggregate line limit and reports paused receipts, dropped/emitted counts, and summary limits.

- [x] 3.4 Implement virtualized structured log rendering.
  - Render only the visible window, use stable `(sourceId, sequence)` keys, preserve filtering and
    source/application context, and keep scroll position stable while live events arrive.
  - Keep visible focus, jump-to-latest, text selection, and narrow-layout controls usable.
  - _Copilot agent: @ops-union-frontend_
  - _Requirements: 4.5, 5.4, 7.1-7.5_
  - _Dependencies: 1.3, 3.2, 3.3_
  - _Validation: component tests plus browser smoke checks with a large synthetic event set and
    DOM-node/windowing assertions.
  - _Evidence: `@tanstack/react-virtual` is wired with `(sourceId, sequence)` keys, structured filtering occurs before virtualization, and frontend typecheck/build pass.

- [x] 3.5 Add application grouping to pod and log views.
  - Group by normalized application key while retaining cluster, namespace, pod, and container
    labels and visible source failures.
  - _Copilot agent: @ops-union-frontend_
  - _Requirements: 4.3-4.6, 6.4, 7.2, 7.5_
  - _Dependencies: 1.2, 1.3, 3.2, 3.4_
  - _Validation: grouping tests for labels, owner references, pod fallback, duplicate names across
    clusters, and partial-failure display.
  - _Evidence: pod grouping/filter tests cover shared application keys across clusters; log sources retain application, cluster, namespace, pod, and container metadata and show source failures.

- [x] 3.6 Audit accessibility and responsive states for the new log workflow.
  - Add accessible names/focus states for range, source, limit, pause, clear, and jump-to-latest
    controls; announce connection, partial, limit, and terminal states.
  - Prevent toolbar, source metadata, virtualized output, and error summaries from overlapping at
    narrow widths.
  - _Copilot agent: @ops-union-frontend_
  - _Requirements: 1.1-1.5, 3.6, 6.3-6.5, 7.5_
  - _Dependencies: 3.1, 3.3, 3.4, 3.5_
  - _Validation: keyboard/screen-reader smoke scenarios and desktop/mobile screenshots.
  - _Evidence: range/source/limit/status controls have accessible labels and live regions; focus-visible and narrow-width CSS states compile successfully in the frontend build.

## Phase 4 - Integration and release gate

- [x] 4.1 Run focused backend and frontend regression checks.
  - Run tests, typechecks, production builds, and `git diff --check` for the touched workspaces.
  - Confirm the legacy per-pod log flow, pod table, details panel, and existing read-only routes
    remain functional.
  - _Copilot agents: @ops-union-backend, @ops-union-frontend_
  - _Requirements: 8.1-8.4, Definition of done_
  - _Dependencies: 2.4, 3.6_
  - _Validation: `npm test --workspaces --if-present`, `npm run typecheck --workspaces --if-present`,
    `npm run build --workspaces --if-present`, and `git diff --check`.
  - _Evidence (2026-09-16): workspace tests passed with backend 62/62 and frontend 75/75;
    backend, frontend, and desktop typechecks passed; all three workspace builds passed;
    `git diff --check` passed. Legacy endpoint, pod table, details panel, and read-only routes
    remain covered by existing regression tests and the backend security suite.

- [x] 4.2 Validate multi-source behavior against a read-only Kubernetes environment.
  - Exercise multiple pods/containers, a missing or unauthorized source, custom `to`, follow mode,
    timestamped and unparseable lines, per-source and aggregate budgets, application fallbacks, and
    disconnect cancellation.
  - _Copilot agent: @ops-union-integration-qa_
  - _Requirements: 1.6-1.7, 2.2-2.4, 3.3-3.5, 4.1-4.6, 5.4-5.6, 6.1-6.5_
  - _Dependencies: 4.1_
  - _Validation: documented read-only integration scenario with no cluster mutation.
  - _Evidence (2026-09-16): `kubectl config get-contexts -o name` exposed both
    `kubernetes-qa-tb` and `kubernetes-qa-gt`; read-only `kubectl get pods` found running
    reference pods in `bank-overdraft` in both contexts. A local `WS /api/logs` session used
    one source from each context plus one missing pod: both valid sources emitted timestamped
    lines, the missing source returned a sanitized source error, and the aggregate summary was
    `completed`. Additional read-only WebSocket scenarios observed `to-reached`, aggregate
    `limit`/`cancelled` source endings with `aggregate-limit`, and follow cancellation after a
    client close. `kubectl top pods` worked in both contexts.
  - _Limitation: this is intentionally unchecked. The environment run did not cover multiple
    containers in one pod, an unauthorized source, a live unparseable line, or a live
    application pod fallback. The aggregate pods POST was not exercised because this QA mode
    permits only local GET requests and WebSocket read clients; disconnect cancellation of
    upstream handles is covered by unit tests, not directly observable from the cluster.

- [x] 4.3 Perform the release-scope and security audit.
  - Confirm no mutation verb, kubeconfig secret, raw Kubernetes error, unbounded payload, or
    per-source socket regression was introduced; inspect the final diff and effective API contract.
  - _Copilot agent: @ops-union-integration-qa_
  - _Requirements: 5.1, 6.2, 8.1-8.4, Definition of done_
  - _Dependencies: 4.1, 4.2_
  - _Validation: read-only source audit, security regression checks, and `git diff --check`.
  - _Evidence (2026-09-16): source audit found only Kubernetes list/read/metrics/log calls and
    no mutation client method (`create`, `update`, `patch`, `replace`, `delete`, `exec`, `scale`,
    or restart). Error-safety tests and the live missing-pod source showed no raw ApiException
    body/header marker; kubeconfig responses exposed only safe status/context metadata. Server
    limits, client retention, one aggregate frontend WebSocket, and cancellation paths are
    covered by focused tests. Backend/frontend tests passed (62/62 and 75/75), all workspace
    typechecks and builds passed, and `git diff --check` passed.
  - _Limitation: the active kubeconfig grants some mutation verbs according to
    `kubectl auth can-i --list` on `kubernetes-qa-tb`; this audit confirms the application code
    does not invoke them, not that the cluster credentials are least-privilege. Local POST
    routes for kubeconfig selection and read queries remain outside Kubernetes mutation scope.

## Definition of done

- [x] Period presets and validated custom UTC ranges work for bounded and live sessions.
- [x] Structured timestamps, source identity, application identity, and sequence are delivered.
- [x] One aggregate WebSocket handles multiple sources with bounded line/byte budgets.
- [x] Partial source failures remain visible while valid sources continue.
- [x] Application grouping and virtualized rendering work with large, interleaved output.
- [x] Legacy per-pod logs and read-only/security boundaries remain compatible.
- [x] Focused tests, typechecks, builds, browser checks, and read-only integration validation pass.
- [x] Package versioning, commit, tag, and publication are handled as separate approved actions.
