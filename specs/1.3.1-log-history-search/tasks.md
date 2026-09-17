# Implementation Tasks - ops-union v1.3.1 log history search

These tasks depend on v1.3.0 and remain unchecked until named owners provide evidence. They do not
authorize Kubernetes mutation, source changes outside implementation scope, commit, packaging, or
release publication.

## Phase 1 - Query contract and consistency

- [ ] 1.3.1-HS-1 Freeze the history-query, normalization, ordering, and result contract.
  - Define exact Pod/Container/Cluster/Namespace matching, message-only scope, case-insensitive
    Unicode normalization/case-folding, whitespace behavior, query limits, deterministic order,
    highlight offset semantics, and no-regex boundaries.
  - Define snapshot partial acceptance, snapshot/generation binding, query generation, cursor
    lifetime, and the safe error/status vocabulary.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-1.1-HS-1.5, HS-2.1-HS-2.6, HS-3.1-HS-6, HS-7.1-HS-7.6
  - _Dependencies: 1.3.0-HS-8
  - _Validation: contract review against the evidenced v1.3.0 snapshot/session API; executable
    normalization examples for ASCII, Unicode, missing timestamps, and empty input.
  - _Definition of done: query and result semantics cannot be confused with Live local filtering or
    Kubernetes pagination.

- [ ] 1.3.1-HS-2 Define search resource, concurrency, and backpressure limits.
  - Reconcile query length, scan bytes/lines, CPU/time, result/window/frame size, highlight count,
    memory, cursor TTL, concurrent scans, per-session request rate, and optional index disk limits.
  - Decide queue versus safe rejection at capacity and the cancellation slot-release behavior.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-3.3-HS-3.6, HS-5.3-HS-5.6, HS-7.1-HS-7.3
  - _Dependencies: 1.3.1-HS-1, 1.3.0-HS-2
  - _Validation: approved limit matrix and boundary scenarios; prove all limits are finite and
    compatible with the v1.3.0 session envelope.
  - _Definition of done: resource behavior is deterministic under large snapshots and many queries.

## Phase 2 - Backend search execution and protocol

- [ ] 1.3.1-HS-3 Implement bounded snapshot query execution.
  - Add structured-filter pruning, bounded NDJSON/index reads, deterministic source/line ordering,
    message matching, original-text highlight ranges, progress checkpoints, and scan fallback.
  - Keep all buffers bounded and bind every reader to a validated snapshot handle rather than a
    client-supplied path.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-1.1-HS-1.5, HS-2.1-HS-2.6, HS-3.1-HS-6, HS-7.1-HS-7.6
  - _Dependencies: 1.3.1-HS-1, 1.3.1-HS-2, 1.3.0-HS-3
  - _Validation: focused backend tests for filters, case/Unicode, offsets, missing timestamps,
    multi-source ordering, no results, partial snapshots, limits, and safe failures.
  - _Definition of done: a valid query produces bounded, deterministic, snapshot-consistent
    results without any Kubernetes read.

- [ ] 1.3.1-HS-4 Add paginated/streamed search messages to the aggregate WebSocket.
  - Implement validated start/accepted/progress/results/cancel/terminal messages using one existing
    aggregate transport and bounded frames.
  - Bind opaque cursors to snapshot/query/normalization version; reject stale, expired, malformed,
    overlarge, or cross-session requests without raw internal details.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-4.1-HS-4.6, HS-5.3-HS-5.6, HS-7.1-HS-7.6
  - _Dependencies: 1.3.1-HS-3, 1.3.0-HS-4
  - _Validation: protocol tests for pagination, streaming backpressure, cancellation, supersession,
    stale cursors, duplicate requests, capacity, and unchanged Live messages.
  - _Definition of done: search results are delivered incrementally with honest lifecycle and safe
    consistency checks.

## Phase 3 - Frontend query workspace

- [ ] 1.3.1-HS-5 Implement History search draft/applied state and bounded result virtualization.
  - Add query/filter draft indicators and explicit Search application while preserving v1.2.3
    semantics. Use optional debounce only for local validation/preparation.
  - Consume bounded result windows, reject stale generations, virtualize rows, render safe highlights,
    preserve selection/wrap/grouping, and expose progress/no-results/partial/cancelled/expired
    states accessibly.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: HS-4.1-HS-6.5, HS-5.1-HS-5.6
  - _Dependencies: 1.3.1-HS-4, 1.3.0-HS-5
  - _Validation: focused frontend tests for Search confirmation, debounce boundary, result windows,
    stale/cancelled responses, highlights, selection, wrap, virtualizer bounds, and accessible
    status/History labels.
  - _Definition of done: the browser never needs the full snapshot to search or render results.

- [ ] 1.3.1-HS-6 Preserve Live local filters and mode transitions.
  - Prove that Live Pod/Container/Cluster/Namespace/Message filtering remains local over retained
    records and does not invoke History search, read snapshots, or alter the aggregate subscription.
  - Integrate History/Live labeling and transition with v1.3.0 session boundaries, including pending
    Search, Pause, Clear, Group, Wrap lines, Jump to latest, and partial/error states.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: HS-6.1-HS-6.5, RA-1.2-RA-1.3
  - _Dependencies: 1.3.1-HS-5, 1.3.0-HS-6
  - _Validation: frontend regression tests and one-socket/session-spy scenario for Live edits,
    history queries, mode changes, and Search confirmation.
  - _Definition of done: History search does not leak into or change established Live behavior.

## Phase 4 - Integration, security, and handoff

- [ ] 1.3.1-HS-7 Validate read-only search behavior, limits, and sensitive-data boundaries.
  - Exercise exact/combined filters, case/Unicode text, no results, large/partial snapshots,
    paginated/streamed delivery, cancellation, stale cursors, concurrent capacity, missing
    timestamps, and expired sessions.
  - Verify the browser receives bounded result windows, no Kubernetes mutation occurs, and evidence
    contains no kubeconfig, credentials, headers, raw bodies, local paths, or unescaped HTML.
  - _Owner: repository maintainer (specs handoff)
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: HS-1.1-HS-1.5, HS-3.1-HS-3.6, HS-4.1-HS-4.6, HS-5.3-HS-5.6, HS-7.1-HS-7.6,
    RA-1.1-RA-1.5
  - _Dependencies: 1.3.1-HS-3, 1.3.1-HS-4, 1.3.1-HS-5, 1.3.1-HS-6
  - _Validation: read-only integration matrix, automated results, memory/network observations, and
    security/scope audit; record unsupported tooling as limitations.
  - _Definition of done: server-side search behavior and safety claims are evidenced, not inferred.

- [ ] 1.3.1-HS-8 Complete specification handoff to v1.4.0 export.
  - Review the evidenced snapshot/query/result contracts, identify which applied query, cursor, and
    source/range metadata export may consume, and preserve all open task/evidence gaps.
  - Record decisions about partial snapshots, result ordering, highlights, query limits, cursor
    expiry, and whether export consumes raw snapshot records or a filtered result stream.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: RA-1.1-RA-1.5, Definition of done
  - _Dependencies: 1.3.1-HS-7
  - _Validation: read-only requirements/design/tasks/evidence audit and `git diff --check`; no
    commit, packaging, release, or Kubernetes mutation.
  - _Definition of done: v1.4.0 has a stable documented dependency boundary and named open decisions.

## Definition of done

- [ ] Snapshot-bound server-side filters/search, result windows, highlights, progress, cancellation,
  consistency, limits, and safe errors are implemented and evidenced.
- [ ] The browser does not load the full snapshot to search, and stale/old/cancelled results cannot
  contaminate the current view.
- [ ] Live filters remain local with Search confirmation, grouping, wrapping, virtualization, and
  aggregate transport preserved.
- [ ] Integration, security, resource, no-results, partial, and accessibility evidence is recorded
  by the named owners.
- [ ] No task is marked complete without evidence; no source code, commit, packaging, or release
  activity is implied by this specification.
