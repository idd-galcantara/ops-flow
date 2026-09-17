# Implementation Tasks - ops-union v1.3.1 log history search

These tasks extend the query/session infrastructure delivered by v1.3.0. Snapshot acquisition,
query IDs, logical query windows, `totalMatches`, bounded sparse caches, stale-response guards, and
the aggregate transport are inherited and are not reimplemented here. Tasks remain unchecked until
named owners provide evidence. They do not authorize Kubernetes mutation, source changes outside
implementation scope, commit, packaging, or release publication.

## Phase 1 - Query contract and consistency

- [ ] 1.3.1-HS-1 Freeze the search-specific query and result contract.
  - Define exact Pod/Container/Cluster/Namespace matching, message-only scope, case-insensitive
    Unicode normalization/case-folding, wildcard `*` semantics, pipe-separated OR alternatives,
    literal-character behavior, whitespace handling, query limits, deterministic order, highlight
    offset semantics, and no-regex boundaries on top of the existing v1.3.0 query identity and
    logical-window contract.
  - Define only the search-specific status/error vocabulary and query-generation behavior that is
    missing from v1.3.0. Reuse snapshot/generation binding, query IDs, offsets, and partial-session
    semantics already defined there.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-1.1-HS-1.5, HS-2.1-HS-2.6, HS-3.1-HS-6, HS-7.1-HS-7.6
  - _Dependencies: 1.3.0-HS-FU-8
  - _Validation: contract review against the evidenced v1.3.0 snapshot/session API; executable
    examples for `*CUSTOMER:AAA*`, `ERROR|INFO|TEST`, ASCII, Unicode, missing timestamps, empty
    alternatives, and whitespace input.
  - _Definition of done: search semantics cannot be confused with Live local filtering or
    Kubernetes pagination, and no existing v1.3.0 query field is redefined.

- [ ] 1.3.1-HS-2 Define search-only resource and backpressure limits.
  - Reconcile query length, scan bytes/lines, CPU/time, result/window/frame size, highlight count,
    memory, cursor/query TTL, concurrent scans, per-session request rate, and optional search-index
    disk limits with the authoritative v1.3.0 snapshot/window/frame limits.
  - Decide queue versus safe rejection at search capacity and the cancellation slot-release
    behavior. Do not create a second limit system for inherited snapshot resources.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-3.3-HS-3.6, HS-5.3-HS-5.6, HS-7.1-HS-7.3
  - _Dependencies: 1.3.1-HS-1, 1.3.0-HS-2
  - _Validation: approved limit matrix and boundary scenarios; prove all limits are finite and
    compatible with the v1.3.0 session envelope.
  - _Definition of done: search-only resource behavior is deterministic under large snapshots and
    many queries, and inherited v1.3.0 limits remain authoritative.

## Phase 2 - Backend search execution and query protocol extension

- [ ] 1.3.1-HS-3 Extend bounded query execution with search semantics.
  - Add structured-filter pruning, deterministic source/line ordering, wildcard message matching,
    pipe-separated OR alternatives, Unicode normalization/case-folding, literal-character handling,
    original-text highlight ranges, progress checkpoints, and scan fallback to the v1.3.0 bounded
    NDJSON/index reader.
  - Keep all buffers bounded and bind every reader to the validated v1.3.0 snapshot/query handle;
    do not duplicate snapshot files, indexes, or logical match windows.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-1.1-HS-1.5, HS-2.1-HS-2.6, HS-3.1-HS-6, HS-7.1-HS-7.6
  - _Dependencies: 1.3.1-HS-1, 1.3.1-HS-2, 1.3.0-HS-FU-8
  - _Validation: focused backend tests for filters, wildcard boundaries, OR alternatives, literal
    characters, case/Unicode, offsets, missing timestamps, multi-source ordering, no results,
    partial snapshots, limits, and safe failures.
  - _Definition of done: a valid search query produces bounded, deterministic, snapshot-consistent
    results through the existing query reader without any Kubernetes read.

- [ ] 1.3.1-HS-4 Extend the existing query protocol for search lifecycle metadata.
  - Extend the v1.3.0 `history.query.*` messages with validated search progress, highlights, search
    status, cancellation/supersession, and limit metadata where needed. Do not add a parallel
    `history.search.*` message family or a second WebSocket.
  - Reuse and extend the existing snapshot/query/generation/offset validation; reject stale,
    expired, malformed, overlarge, or cross-session requests without raw internal details.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-4.1-HS-4.6, HS-5.3-HS-5.6, HS-7.1-HS-7.6
  - _Dependencies: 1.3.1-HS-3, 1.3.0-HS-FU-8
  - _Validation: protocol tests for pagination, streaming backpressure, cancellation, supersession,
    stale cursors, duplicate requests, capacity, and unchanged Live messages.
  - _Definition of done: search results use the existing bounded query windows with honest
    search-specific lifecycle and safe consistency checks.

## Phase 3 - Frontend search extension

- [ ] 1.3.1-HS-5 Extend History query presentation with search behavior.
  - Add search-specific query/filter draft indicators and explicit Search application while
    preserving v1.2.3 and v1.3.0 semantics. Use optional debounce only for local validation/
    preparation.
  - Reuse the existing bounded query-window cache, logical `totalMatches`, stale-generation guards,
    and virtualizer. Add safe highlight rendering, selection/wrap/grouping preservation, and
    accessible progress/no-results/partial/cancelled/expired states.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: HS-4.1-HS-6.5, HS-5.1-HS-5.6
  - _Dependencies: 1.3.1-HS-4, 1.3.0-HS-FU-8
  - _Validation: focused frontend tests for Search confirmation, debounce boundary, wildcard query
    display, result windows, stale/cancelled responses, highlights, selection, wrap, virtualizer
    bounds, and accessible status/History labels.
  - _Definition of done: the browser never needs the full snapshot to search or render results and
    no second result cache or virtualizer is introduced.

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

## Phase 4 - Search integration, security, and handoff

- [ ] 1.3.1-HS-7 Validate search extensions, limits, and sensitive-data boundaries.
  - Exercise exact/combined filters, wildcard patterns, pipe-separated OR terms, literal characters,
    case/Unicode text, no results, large/partial snapshots, paginated/streamed delivery,
    cancellation, stale cursors, concurrent capacity, missing timestamps, and expired sessions.
  - Verify the browser receives bounded result windows, no Kubernetes mutation occurs, and evidence
    contains no kubeconfig, credentials, headers, raw bodies, local paths, or unescaped HTML.
  - _Owner: repository maintainer (specs handoff)
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: HS-1.1-HS-1.5, HS-3.1-HS-3.6, HS-4.1-HS-4.6, HS-5.3-HS-5.6, HS-7.1-HS-7.6,
    RA-1.1-RA-1.5
  - _Dependencies: 1.3.1-HS-3, 1.3.1-HS-4, 1.3.1-HS-5, 1.3.1-HS-6, 1.3.0-HS-FU-8
  - _Validation: read-only integration matrix, automated results, memory/network observations, and
    security/scope audit; record unsupported tooling as limitations.
  - _Definition of done: server-side search behavior and safety claims are evidenced, not inferred.

- [ ] 1.3.1-HS-8 Complete specification handoff to v1.4.0 export.
  - Review the evidenced v1.3.0 snapshot/query contract together with the v1.3.1 search extension;
    identify which applied query, logical result offset, highlights, and source/range metadata
    export may consume, and preserve all open task/evidence gaps.
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

- [ ] Wildcard matching, pipe-separated OR alternatives, highlights, progress, cancellation,
  consistency extensions, limits, and safe errors are implemented and evidenced on top of the
  v1.3.0 query windows.
- [ ] The browser does not load the full snapshot to search, and stale/old/cancelled results cannot
  contaminate the current view.
- [ ] Live filters remain local with Search confirmation, grouping, wrapping, virtualization, and
  aggregate transport preserved.
- [ ] Integration, security, resource, no-results, partial, and accessibility evidence is recorded
  by the named owners.
- [ ] No task is marked complete without evidence; no source code, commit, packaging, or release
  activity is implied by this specification.
