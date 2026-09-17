# Implementation Tasks - ops-union v1.3.0 log history session

These tasks define the history-session contract and handoff. Every task is intentionally unchecked;
no task is complete based on this specification alone. They do not authorize Kubernetes mutation,
source changes outside the implementation scope, commit, packaging, or release publication.

## Phase 1 - Contract and limit decisions

- [ ] 1.3.0-HS-1 Confirm the applied mode, completeness policy, and compatibility contract.
  - Define the Live/History control, `complete when available` versus `bounded` policy labels,
    draft/applied Search behavior, session generation, and the historical-to-live transition.
  - Decide whether transition closes history and starts one live session (recommended) or supports a
    proven same-socket attach. Document the decision and rejected alternatives.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-1.1-HS-1.5, HS-6.1-HS-6.5, HS-7.1-HS-7.4
  - _Dependencies: none
  - _Validation: protocol/state contract review against v1.2.0-v1.2.6 Search, source, and aggregate
    WebSocket behavior; no source or Kubernetes mutation.
  - _Definition of done: mode, policy, generation, and transition semantics are unambiguous and
    compatible with the existing live path.

- [ ] 1.3.0-HS-2 Establish resource, concurrency, timestamp, restart, and `--previous` decisions.
  - Reconcile the proposed per-source/session byte and line caps, disk and memory budgets, window
    and frame limits, active session/source-read caps, TTL, and cleanup grace period with existing
    configuration.
  - Decide the observable contract for missing timestamps, rotation/restart continuity, and the
    explicit future `--previous` variant. Keep `--previous` out of the default request unless a
    separate source/read identity is approved.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-2.3-HS-2.6, HS-4.5-HS-4.6, HS-8.1-HS-8.6
  - _Dependencies: 1.3.0-HS-1
  - _Validation: signed-off limit table and edge-case decision record; verify no limit is unlimited
    by omission and no Kubernetes pagination claim is introduced.
  - _Definition of done: implementers have named limits and deterministic edge behavior.

## Phase 2 - Backend snapshot and protocol

- [ ] 1.3.0-HS-3 Implement read-only per-source acquisition and temporary snapshot storage.
  - Add the backend-owned session/storage implementation for `follow=false`, incremental NDJSON
    writes, manifest metadata, offset/line/timestamp indexing, bounded buffers, cancellation, and
    source-scoped status.
  - Enforce permissions, randomized application-owned temp paths, UTF-8 byte accounting, cleanup
    retries, TTL, and startup orphan cleanup without returning paths to the renderer.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-2.1-HS-2.6, HS-3.1-HS-3.6, HS-4.1-HS-4.6, HS-8.1-HS-8.5, HS-9.1-HS-9.4
  - _Dependencies: 1.3.0-HS-2
  - _Validation: focused backend unit tests for EOF, limits, missing timestamps, multi-source
    identity, cancellation, TTL/orphan cleanup, disk failure, and safe errors.
  - _Definition of done: finite source reads produce bounded immutable snapshots and indexes with
    deterministic terminal/cleanup behavior.

- [ ] 1.3.0-HS-4 Extend the aggregate protocol with validated history lifecycle and windows.
  - Add versioned start, accepted, progress, window, cancel, and terminal messages to the existing
    aggregate WebSocket path without creating per-source or per-page sockets.
  - Validate generation, session, source scope, cursors, frame sizes, page sizes, and request rates;
    return safe errors for stale/expired/invalid requests.
  - Preserve the existing live protocol and legacy per-pod endpoint contract.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-4.1-HS-4.4, HS-5.1-HS-5.6, HS-7.1-HS-7.5, HS-9.1-HS-9.4
  - _Dependencies: 1.3.0-HS-3
  - _Validation: protocol tests for one/multiple sources, out-of-order/stale windows, cancellation,
    frame limits, partial failure, and unchanged Live messages; no raw Kubernetes data in errors.
  - _Definition of done: clients can start, observe, page, cancel, and finish a history session
    through one validated aggregate transport.

## Phase 3 - Frontend history workspace

- [ ] 1.3.0-HS-5 Implement explicit History mode, progress states, and windowed virtualization.
  - Add draft/applied mode and policy controls behind the existing Search confirmation boundary.
  - Render progress, source statuses, limit reasons, empty/partial/cancelled/expired states, and
    bounded page/window requests with generation-safe cache and eviction.
  - Preserve current filters, grouping, Wrap lines, selection, output scroll ownership, stable
    keys, and Live behavior.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: HS-1.1-HS-1.5, HS-4.1-HS-4.4, HS-5.1-HS-5.6, HS-7.1-HS-7.5
  - _Dependencies: 1.3.0-HS-4
  - _Validation: focused frontend tests for draft/apply, window requests, stale generations,
    cache limits, virtualization, accessibility states, and Live regression.
  - _Definition of done: History is explicit, bounded in browser memory, and visually consistent
    with the existing workspace without changing Live semantics.

- [ ] 1.3.0-HS-6 Implement and validate the historical-tail to live transition.
  - Add the explicit transition action and status boundary using the decision from HS-1. Preserve
    history metadata while Live connects, prevent duplicate submissions, and provide retry on
    failure.
  - Recheck Search confirmation, source scope, Follow semantics, Pause, filters, grouping, and
    wrapping across the transition.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: HS-6.1-HS-6.5, HS-7.1-HS-7.4, RA-1.2
  - _Dependencies: 1.3.0-HS-1, 1.3.0-HS-5
  - _Validation: component/session tests proving finite-history status is not presented as live and
    exactly one aggregate replacement/attach path is used.
  - _Definition of done: transition is explicit, accessible, generation-safe, and does not lose or
    duplicate source scope or sockets.

## Phase 4 - Integration, security, and handoff

- [ ] 1.3.0-HS-7 Run read-only integration, limits, cleanup, and security validation.
  - Exercise one/multiple sources, repeated names across contexts, missing timestamps, EOF,
    partial/failing sources, byte/line/disk/memory/concurrency caps, cancellation, TTL/orphan
    cleanup, restart/rotation behavior, and historical/live transition.
  - Verify no Kubernetes mutation, raw response/body/header, credential, kubeconfig, arbitrary path,
    or renderer filesystem access appears in product behavior or evidence.
  - _Owner: repository maintainer (specs handoff)
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: HS-2.1-HS-2.6, HS-3.1-HS-3.6, HS-4.1-HS-4.6, HS-8.1-HS-8.6, HS-9.1-HS-9.4,
    RA-1.1-RA-1.5
  - _Dependencies: 1.3.0-HS-3, 1.3.0-HS-4, 1.3.0-HS-5, 1.3.0-HS-6
  - _Validation: documented read-only integration matrix, automated test results, resource usage,
    cleanup evidence, and security/scope audit; record unavailable environments as limitations.
  - _Definition of done: all stated limits and safety boundaries have executable or explicitly
    limited evidence.

- [ ] 1.3.0-HS-8 Complete specification handoff for v1.3.1 and implementation readiness.
  - Review the requirements/design/tasks against implementation evidence, preserve all unchecked
    tasks that lack evidence, and identify the exact snapshot APIs, IDs, limits, and status fields
    that v1.3.1 server-side search may consume.
  - Record residual risks for Kubernetes finite reads, rotation/restart, timestamp gaps, `--previous`,
    disk cleanup, and desktop restart. This is a specs handoff, not release approval.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: RA-1.1-RA-1.5, Definition of done
  - _Dependencies: 1.3.0-HS-7
  - _Validation: read-only spec/evidence audit and `git diff --check`; no commit, packaging, release,
    or Kubernetes mutation.
  - _Definition of done: v1.3.1 has a stable, evidenced snapshot contract and all open questions are
    named for the implementation owners.

## Definition of done

- [ ] The history protocol, snapshot/storage/index contract, frontend behavior, and read-only
  acceptance evidence are complete.
- [ ] Live behavior and existing Search/filter/group/wrap/virtualization/aggregate transport
  contracts remain covered.
- [ ] Limits, cleanup, cancellation, missing timestamps, source continuity, and `--previous`
  boundaries are explicit and tested or documented as limitations.
- [ ] No task is marked complete without owner evidence; no commit, packaging, or release activity
  is implied.
