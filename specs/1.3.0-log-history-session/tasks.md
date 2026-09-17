# Implementation Tasks - ops-union v1.3.0 log history session

These tasks define the history-session contract and handoff. Checkboxes below reflect recorded owner
evidence against each task definition; residual limitations remain explicit and do not imply release
approval. They do not authorize Kubernetes mutation, source changes outside the implementation
scope, commit, packaging, or release publication.

## Convergence evidence status

Recorded during the final v1.3.0 specification and QA reconciliation on 2026-09-16. A checked task
means its task definition has implementation or validation evidence; the limitations below remain
open and are not claims that unsupported environment checks passed.

- **1.3.0-HS-1 - checked; implementation evidence recorded.** Applied Live/History mode, both
  completeness policies, Search-gated draft state, generation identity, and the close-history/start-
  one-live-session transition are present. Backend protocol tests, frontend search/serializer tests,
  and source review support the contract. Browser/Electron interaction remains unverified.
- **1.3.0-HS-2 - checked; implementation evidence recorded.** Named byte, line, disk, record,
  window, frame, per-source/session decoded-memory, concurrency, request-rate, TTL, orphan-grace,
  and retained-session limits are implemented. Missing or malformed timestamps retain line order;
  `--previous` is excluded; continuity is explicitly single-read/unknown. Rotation/restart was not
  live-verified and no RSS profiler was run.
- **1.3.0-HS-3 - checked; focused evidence recorded.** Tests cover finite `follow=false` acquisition,
  complete history without silent tail truncation, multi-source identity, UTF-8 byte accounting,
  NDJSON/index windows, cursor boundaries, snapshot limits, accurate byte/line reasons, parser/index/
  page decoded-memory boundaries and release, cancellation, TTL, orphan cleanup, shutdown cleanup,
  storage/window errors, and sanitized errors. Cleanup-retry failure and desktop restart cleanup were
  not live-verified.
- **1.3.0-HS-4 - checked; focused evidence recorded.** Tests cover progress, source and aggregate
  terminal statuses, idempotent cancellation, TTL expiry, orphan cleanup, active-only capacity,
  configured frame limits, and shutdown cleanup. History WebSocket integration was not run under the
  QA policy; cleanup-retry failure and desktop restart behavior remain unverified.
- **1.3.0-HS-5 - checked; implementation and focused test evidence recorded.** Applied search values,
  generation-carrying messages, stale-window rejection, bounded cache eviction, local filters, source
  identity, windowed delivery, and virtualized rendering are present. No browser/Electron interaction
  test verifies rendering, keyboard behavior, or accessibility states.
- **1.3.0-HS-6 - checked; implementation and focused test/source evidence recorded.** The frontend
  labels the historical boundary, preserves it while Live connects, starts one new aggregate Live
  session, prevents duplicate transition work, and provides retry state. Browser/Electron interaction
  and QA history WebSocket integration were not run.
- **1.3.0-HS-7 - checked; QA evidence recorded with explicit limitations.** Read-only QA passed
  health, contexts, namespaces/pods, describe, metrics, `kubectl top`, and finite backend WebSocket
  logs. No mutating calls were made. `/api/pods` POST fan-out and history WebSocket integration were
  not run under QA policy; both clusters had metrics, so missing-metrics behavior was unit-tested
  only. Browser/Electron interaction, rotation/restart, cleanup-retry failure, desktop restart
  cleanup, and RSS profiling remain unverified.
- **1.3.0-HS-8 - checked; handoff reconciliation complete.** The stable snapshot identifiers,
  limits, statuses, transition choice, v1.3.1 boundary, evidence counts, and residual limitations
  are now recorded. This is a specification handoff, not release approval.

### Validation record

- Backend focused history/protocol/WebSocket suite: 13/13 passed.
- Full backend suite: 83/83 passed.
- Frontend suite: 91/91 passed.
- Backend, frontend, and desktop typechecks/builds passed; root build passed.
- `git diff --check` passed.
- Final repaired checks cover complete history with no silent tail truncation, cursor boundaries,
  bounded parser/index/page decoded-memory envelopes (4 MiB/source and 32 MiB/session), safe
  storage/window errors, accurate byte/line reasons, active-only capacity, the configured frame
  limit, shutdown cleanup, `follow=false`, one aggregate socket, stale generations, and live
  compatibility.
- Read-only integration passed health, contexts, namespaces/pods, describe, metrics, `kubectl top`,
  and finite backend WebSocket logs in `kubernetes-qa-tb` and `kubernetes-qa-gt`, namespace
  `bank-overdraft`. No mutating calls were made.
- QA did not run `/api/pods` POST fan-out or history WebSocket integration under policy. Both clusters
  had metrics, so missing-metrics behavior was unit-tested only. Browser/Electron interaction,
  rotation/restart, cleanup-retry failure, desktop restart cleanup, and RSS profiling remain
  unverified.
- No Kubernetes mutation, packaging, publishing, commit, or release action was performed.

## Corrective follow-up - adaptive history windows

The following tasks were added after the UI exposed a contract gap: a valid history capture could
finish while its initial requested byte span exceeded the 256 KiB storage-read page limit, leaving
the frontend in `Loading historical window...`. Existing checked task evidence above is preserved;
these follow-up tasks remain unchecked until the focused implementation and validation below pass.

- [x] 1.3.0-HS-FU-1 Implement adaptive byte-aware per-source windows.
  - Treat requested record count as a maximum and use the on-disk index to select the largest
    contiguous forward prefix or backward suffix within `maxWindowBytes` before decoding.
  - Return exact boundaries and `hasMore` flags; preserve cursor exclusivity, stale/session checks,
    decoded-memory reservations, and frame limits. Return a sanitized record-too-large error when
    one encoded record cannot fit.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-5.1-HS-5.2, HS-5.7-HS-5.8, HS-8.1-HS-8.2
  - _Dependencies: 1.3.0-HS-3, 1.3.0-HS-4
  - _Validation: focused backend tests for adaptive forward/backward windows, exact byte boundary,
    oversized single record, cursor boundaries, and decoded-memory/frame preservation.
  - _Definition of done: every valid requested span returns the largest fitting range or the
    specific single-record error, never the old whole-span byte-limit error.

- [x] 1.3.0-HS-FU-2 Define and implement deterministic multi-source window semantics.
  - Keep windows explicitly scoped by exact tuple-derived `sourceKey`. Permit cursorless requests
    only for one source; reject cursorless multi-source requests safely instead of defaulting to
    the first source. Ensure the frontend requests and merges every selected source over one socket.
  - _Owner: @ops-union-backend, @ops-union-frontend
  - _Copilot agents: @ops-union-backend, @ops-union-frontend
  - _Requirements: HS-2.5, HS-5.2, HS-5.9, HS-7.3
  - _Dependencies: 1.3.0-HS-FU-1
  - _Validation: backend tests for two and multiple sources, duplicate tuple identity, and
    cursorless behavior; frontend tests for per-source initial requests and merged display.
  - _Definition of done: no history request or response can silently reduce a selected multi-source
    session to the first source.

- [x] 1.3.0-HS-FU-3 Repair frontend history loading, paging, and retry states.
  - Treat smaller windows as normal, continue edge paging from returned boundaries, clear loading on
    window errors, expose a safe retry action, and keep loading and terminal window error mutually
    exclusive. Preserve stale-generation handling, cache bounds, local presentation behavior,
    Search confirmation, and Live mode.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: HS-5.3-HS-5.6, HS-5.10, HS-7.1-HS-7.3
  - _Dependencies: 1.3.0-HS-FU-2
  - _Validation: frontend tests for short windows, paging/cache, retry/error/loading state, stale
    generation, and live regression.
  - _Definition of done: a failed window cannot leave the UI indefinitely loading, and valid partial
    windows remain navigable.

- [x] 1.3.0-HS-FU-4 Run corrective acceptance validation and converge evidence.
  - Run focused backend/frontend tests first, then full backend/frontend tests, typechecks/builds,
    and `git diff --check`. Record exact outcomes and limitations without changing prior task
    evidence or release/package state.
  - _Owner: @ops-union-integration-qa, @ops-union-docs-convergence
  - _Copilot agents: @ops-union-integration-qa, @ops-union-docs-convergence
  - _Requirements: RA-1.1-RA-1.5, Definition of done
  - _Dependencies: 1.3.0-HS-FU-1, 1.3.0-HS-FU-2, 1.3.0-HS-FU-3
  - _Validation: commands and results recorded below after implementation.
  - _Definition of done: corrective behavior is evidenced and documentation convergence reports
    ready or names an unresolved limitation.

### Corrective follow-up evidence

- **1.3.0-HS-FU-1 - checked; focused backend evidence recorded.** Indexed forward and backward
  reads select the largest contiguous range within `maxWindowBytes`, return exact boundaries and
  `hasMore` flags, preserve cursor and decoded-memory checks, and return the sanitized
  `History record exceeds the storage read limit.` error for an oversized single record.
- **1.3.0-HS-FU-2 - checked; backend/frontend evidence recorded.** Multi-source cursorless reads
  return `History source cursor is required for multiple sources.`; explicit source-key requests
  return every source, and frontend cache identity uses the exact source key so duplicate source IDs
  remain visible over one aggregate socket.
- **1.3.0-HS-FU-3 - checked; focused frontend evidence recorded.** Smaller windows are accepted,
  edge paging continues from returned boundaries, stale generations remain rejected, cache bounds
  remain active, and protocol or transport window errors clear loading and expose retry without
  changing Live, Search, filters, grouping, wrapping, selection, or scroll ownership.
- **1.3.0-HS-FU-4 - checked; validation and local documentation-convergence evidence recorded.**
  Focused adaptive/protocol backend invocation passed; full backend suite: 85/85 passed. Focused
  history/cache frontend invocation passed; full frontend suite: 92/92 passed. Backend, frontend,
  and desktop typechecks passed;
  backend, frontend, and desktop builds passed; `git diff --check` passed. The normative
  requirements/design/tasks text now records adaptive byte-aware windows, explicit per-source
  multi-source semantics, and retryable loading/error behavior. No package, release, commit, push,
  or Kubernetes mutation was performed.

## Corrective follow-up - initial History position

- [x] 1.3.0-HS-FU-5 Open History at the first captured records.
  - The terminal History event SHALL request the initial window from `line: 0` in the `forward`
    direction for every source with captured records. It SHALL NOT reuse Live's automatic
    scroll-to-tail behavior while the initial History window is being delivered.
  - An explicit `Jump to latest` action SHALL request the actual final window when the snapshot
    exceeds one window, then reveal that tail. It SHALL not merely scroll to the end of the first
    loaded window.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: HS-5.3-HS-5.6, HS-7.1
  - _Dependencies: 1.3.0-HS-FU-3
  - _Validation: frontend suite, initial-window request regression, frontend typecheck/build, and
    read-only validation against a source whose `kubectl logs` output begins with initialization.
  - _Definition of done: History opens at the first captured record, Live retains its existing
    tail-follow behavior, and explicit tail navigation remains available.

### Initial History position evidence

- **1.3.0-HS-FU-5 - implemented; focused validation recorded.** History now requests each source
  from line zero forward, disables initial History auto-scroll, and loads the actual final window
  for explicit `Jump to latest`. The initial-window helper regression and frontend suite passed
  (93/93 after the new assertion). Browser/Electron interaction remains to be validated by the
  user against the real application logs; no Kubernetes mutation was performed.

- [x] 1.3.0-HS-FU-6 Stabilize bidirectional History scrolling and cache navigation.
  - Edge pagination SHALL request only the edge toward which the user is scrolling. Repeated
    scroll events SHALL remain deduplicated while a cursor is pending and SHALL not re-request
    the same edge merely because a bounded cache discarded its opposite-side window. A cursor
    whose response was evicted MAY become eligible again when the user reverses direction.
  - Cache eviction SHALL preserve the loaded side needed by the active direction: backward loads
    evict newer windows first, while forward loads evict older windows first. Adding a historical
    window SHALL not enable Live auto-scroll or lose the user's scroll direction.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: HS-5.3-HS-5.6, HS-5.10, HS-7.1
  - _Dependencies: 1.3.0-HS-FU-5
  - _Validation: frontend regression for opposite-edge eviction, full frontend tests, typecheck,
    build, and manual History navigation down then up without a rate-limit error.
  - _Definition of done: scrolling down and then back up keeps pagination bounded, preserves the
    current direction, and does not produce `History window request rate exceeded.`.

### Bidirectional History scrolling evidence

- **1.3.0-HS-FU-6 - implemented; automated validation pending manual app confirmation.** Edge
  requests are now directional, repeated edge requests remain deduplicated, evicted cursor keys
  become eligible only when their window is actually discarded, backward loads evict the newer
  side, forward loads evict the older side, and historical pages cannot trigger Live auto-scroll.
  The targeted cache regression was added; manual Electron validation remains required for the
  down-then-up interaction.

## Phase 1 - Contract and limit decisions

- [x] 1.3.0-HS-1 Confirm the applied mode and compatibility contract.
  - Define the Live/History control, single finite History semantics, draft/applied Search behavior,
    session generation, and the historical-to-live transition.
  - Decide whether transition closes history and starts one live session (recommended) or supports a
    proven same-socket attach. Document the decision and rejected alternatives.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: HS-1.1-HS-1.5, HS-6.1-HS-6.5, HS-7.1-HS-7.4
  - _Dependencies: none
  - _Validation: protocol/state contract review against v1.2.0-v1.2.6 Search, source, and aggregate
    WebSocket behavior; no source or Kubernetes mutation.
  - _Definition of done: mode, finite History semantics, generation, and transition behavior are
    unambiguous and compatible with the existing live path.

- [x] 1.3.0-HS-2 Establish resource, concurrency, timestamp, restart, and `--previous` decisions.
  - Reconcile the implemented per-source/session byte and line caps, disk and memory budgets, window
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

- [x] 1.3.0-HS-3 Implement read-only per-source acquisition and temporary snapshot storage.
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

- [x] 1.3.0-HS-4 Extend the aggregate protocol with validated history lifecycle and windows.
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

- [x] 1.3.0-HS-5 Implement explicit History mode, progress states, and windowed virtualization.
  - Add the draft/applied mode control behind the existing Search confirmation boundary.
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

- [x] 1.3.0-HS-6 Implement and validate the historical-tail to live transition.
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

- [x] 1.3.0-HS-FU-7 Remove the unused History policy and Follow-after-history controls.
  - Keep only the Live/History session mode selector. History uses one finite `follow=false`
    snapshot contract with the existing technical limits; it no longer exposes Complete/Bounded
    policy choices or a misleading Follow-after-history checkbox.
  - Keep Follow available for Live sessions and keep the explicit historical-tail transition,
    which starts one new Live session with `follow=true`.
  - Remove the policy field from frontend/backend state, protocol validation, lifecycle events,
    manifests, tests, and the v1.3.0 design/requirements language.
  - _Owner: repository maintainer (spec convergence)
  - _Requirements: HS-1.1-HS-1.5, HS-2.1-HS-2.5, HS-6.1-HS-6.5, HS-7.1-HS-7.4
  - _Dependencies: 1.3.0-HS-1, 1.3.0-HS-4, 1.3.0-HS-5, 1.3.0-HS-6
  - _Validation: frontend 94/94 tests and typecheck; backend 85/85 focused History/protocol tests;
    residual-reference search for HistoryPolicy, historyPolicy, and selectable Bounded policy.
  - _Definition of done: the UI exposes only Session mode for Live/History, the transport has no
    policy dimension, and the spec describes the same behavior as the implementation.

## Phase 4 - Integration, security, and handoff

- [x] 1.3.0-HS-7 Run read-only integration, limits, cleanup, and security validation.
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

- [x] 1.3.0-HS-8 Complete specification handoff for v1.3.1 and implementation readiness.
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

- [x] The history protocol, snapshot/storage/index contract, frontend behavior, and read-only
  acceptance evidence are complete.
- [x] Live behavior and existing Search/filter/group/wrap/virtualization/aggregate transport
  contracts remain covered.
- [x] Limits, cleanup, cancellation, missing timestamps, source continuity, and `--previous`
  boundaries are explicit and tested or documented as limitations.
- [x] No task is marked complete without owner evidence; no commit, packaging, or release activity
  is implied.
