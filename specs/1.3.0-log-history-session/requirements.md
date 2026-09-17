# Requirements - ops-union v1.3.0 log history session

## Scope

Version 1.3.0 adds an explicit historical-session mode to the logs workspace. The existing live
session remains the default compatibility path. A historical session obtains a bounded snapshot
from each selected source with `follow=false`, stores the snapshot temporarily on the backend,
and serves progress plus bounded windows to the frontend for virtualized navigation.

This release defines the snapshot/session contract and the storage lifecycle. Server-side search
is specified in v1.3.1 and explicit export is specified in v1.4.0; both consume the immutable
snapshot contract defined here. This release does not change Kubernetes permissions, add resource
mutation, or claim that Kubernetes provides native pagination for pod logs.

Kubernetes pod logs do not provide native page/offset pagination. In this specification, **complete**
means every line made available by the requested `follow=false` read for the selected source,
subject to the configured byte, line, disk, time, concurrency, and transport limits. A bounded
session is an explicitly limited snapshot, not an incomplete implementation of Kubernetes
pagination.

## User stories

- As a logs user, I can explicitly choose Live or History mode and understand which mode is active.
- As a logs user, I can request a complete-when-available or bounded historical snapshot without
  loading the entire snapshot into browser memory.
- As a logs user, I can see per-source and aggregate progress, partial failures, cancellation, and
  safe limit reasons while a historical session is being prepared.
- As a logs user, I can navigate historical output through virtualized pages/windows and move from
  the historical tail into Follow/live without silently losing the session boundary.
- As a logs user, I can keep Search confirmation, local filters, grouping, wrapping, and existing
  live behavior unchanged.
- As a platform operator, I can rely on read-only Kubernetes access, temporary cleanup, safe errors,
  and explicit resource limits for multi-source history.

## Glossary

- **Live mode:** The existing aggregate log session with its current Follow/live behavior, bounded
  client retention, local filters, grouping, wrapping, and one WebSocket contract.
- **History mode:** A session that reads a finite `follow=false` snapshot for each selected source.
- **Complete snapshot:** All lines returned by the source read before configured limits, subject to
  the availability caveat above; it does not mean all historical data in Kubernetes.
- **Bounded snapshot:** A snapshot deliberately limited by bytes, lines, time, disk, or another
  documented session cap. The limit reason is visible and machine-readable.
- **Snapshot:** Immutable temporary NDJSON records plus an index and metadata for one session/source
  set. It is not a durable log archive.
- **Window/page:** A bounded range of snapshot records requested by the frontend for rendering.
- **Session generation:** The immutable identity of one applied mode, source set, and range request.
- **Source tuple:** Exact `(cluster, namespace, pod, container)` identity from the confirmed scope.
- **Historical tail:** The newest available snapshot window. It is finite until an explicit live
  transition creates or attaches to a live session.

## Requirements

### HS-1 - Explicit mode and Search boundary

1. The workspace SHALL expose an explicit mode choice between the existing Live mode and History
   mode. The selected mode SHALL be visible in the header and accessible state announcements.
2. History mode SHALL expose an explicit completeness policy: `complete when available` and
   `bounded` (or equivalent labels approved by UX). The active policy SHALL be part of the applied
   search/session state, not an implicit timeout or UI default.
3. Draft mode, policy, range, Follow, and filters SHALL remain unapplied until the existing
   `Search` confirmation is activated, except for existing immediate controls such as Pause,
   retained-event Clear, and presentation-only Group/Wrap lines.
4. A mode or policy change before Search SHALL not open a session, read Kubernetes, create a
   snapshot, or replace retained output.
5. A confirmed Live search SHALL preserve the current live transport and rendering behavior. A
   confirmed History search SHALL create exactly one history session generation for the selected
   sources and applied range.

### HS-2 - Read-only source acquisition and completeness semantics

1. For each confirmed source tuple, the backend SHALL issue the existing read-only pod-log
   operation with `follow=false` and the applied source/range parameters.
2. The backend SHALL NOT represent Kubernetes pod logs as natively paginated. It SHALL read the
   available finite response/stream, record it incrementally, and apply local snapshot limits.
3. `complete when available` SHALL mean all lines received from the `follow=false` read until EOF,
   source failure, cancellation, or a configured cap. If a cap or source failure stops capture,
   the session SHALL be marked bounded/partial with a reason rather than reported as complete.
4. A bounded policy SHALL stop or truncate according to the documented byte/line/time/disk caps,
   preserve the records already captured, and expose the exact cap category without leaking raw
   Kubernetes output.
5. Multiple sources SHALL retain exact cluster, namespace, pod, and container identity even when
   names repeat across contexts. A source failure SHALL not hide successfully captured sources.
6. Backend acquisition SHALL remain read-only list/get/log or equivalent existing read paths. No
   Kubernetes mutation, arbitrary command execution, or new permission scope is authorized.

### HS-3 - Temporary NDJSON persistence and indexes

1. Each history session SHALL persist records in a backend-owned temporary local file or equivalent
   local temporary storage. NDJSON SHALL be the canonical internal record format unless an existing
   storage abstraction proves safer and preserves the same contract.
2. The storage layer SHALL enforce per-source and aggregate byte and line limits before allocating
   additional unbounded memory or disk. It SHALL expose used and configured limits in progress
   metadata, without exposing record contents through status messages.
3. The index SHALL support at least record line number, byte offset, and normalized timestamp when a
   timestamp is present. Index entries SHALL point to immutable snapshot positions and SHALL support
   page/window reads without replaying the entire file.
4. Index creation SHALL tolerate missing or malformed timestamps. Timestamp ordering SHALL never be
   assumed when a source record has no timestamp; file/line order remains the stable fallback.
5. Snapshot files, indexes, and metadata SHALL be placed in an application-owned temporary area
   with restrictive permissions, random non-user-controlled names, and no renderer filesystem
   access.
6. Snapshot data SHALL be removed on explicit cancellation, terminal cleanup, TTL expiry, startup
   orphan cleanup, and unrecoverable storage failure, subject to a bounded cleanup retry policy.

### HS-4 - Progress, cancellation, limits, and lifecycle

1. The session SHALL expose aggregate progress and per-source state including queued, reading,
   indexing, ready, partial, failed, cancelled, expired, and cleaned-up as applicable.
2. Progress SHALL include a determinate value only when a trustworthy total is known. Otherwise it
   SHALL expose indeterminate progress plus captured bytes/lines and source counts.
3. Cancellation SHALL be idempotent. It SHALL stop pending reads where the client/library permits,
   close owned streams, prevent further page delivery, and schedule immediate temporary cleanup.
4. A cancelled or expired session SHALL reject new windows/search/export consumers with a safe,
   stable status and SHALL not resume Kubernetes reads implicitly.
5. TTL SHALL begin at the terminal snapshot state (or last activity according to the chosen policy)
   and SHALL be configurable. Cleanup SHALL cover normal completion and orphaned sessions after
   desktop/backend restart.
6. The backend SHALL bound concurrent history sessions and concurrent source reads. Excess work
   SHALL queue or fail with a safe capacity status; it SHALL not bypass limits by spawning
   untracked workers.

### HS-5 - Paged/windowed delivery and frontend virtualization

1. The history protocol SHALL deliver metadata and bounded pages/windows, not the full snapshot,
   unless a page itself is within the configured transport cap.
2. Every page/window response SHALL identify the session generation, snapshot identity/version,
   source scope, start/end cursor or line, record count, and whether more data exists.
3. The frontend SHALL request windows around the visible virtualized range, cache only a bounded
   number/size of windows, and release windows outside the retention budget where safe.
4. Virtualization SHALL preserve selectable messages, grouping, Wrap lines measurement, stable
   source/sequence keys, no page-level horizontal overflow, keyboard focus, and output-owned
   scrolling from the existing workspace.
5. A stale generation, expired snapshot, invalid cursor, or out-of-order response SHALL be ignored
   or rejected safely and SHALL not append records to a different history session.
6. The UI SHALL distinguish loading a window, an empty snapshot, a partial snapshot, a source
   failure, a cancelled session, an expired session, and a no-results state.

### HS-6 - Historical-to-live transition

1. The workspace SHALL provide an explicit transition from the historical tail to Follow/live. The
   transition SHALL be visible, keyboard-accessible, and confirmed in the applied session state.
2. Transitioning SHALL never pretend that a finite snapshot is still streaming. The UI SHALL retain
   the historical boundary and status until the live session is connected and acknowledged.
3. The implementation SHALL choose and document one transition contract before implementation:
   attach to a compatible live session at the tail, or close history and start one new aggregate
   live session. It SHALL not create duplicate aggregate sockets.
4. If the source scope, range, or Follow parameters are incompatible, the transition SHALL require
   the existing Search confirmation and SHALL not silently widen source scope or range.
5. Disconnect, cancellation, or partial failure during transition SHALL preserve the historical
   snapshot status and provide a safe retry path without losing the immutable snapshot metadata.

### HS-7 - Existing logs behavior and transport preservation

1. Live mode SHALL preserve Search confirmation, draft/applied state, local Pod/Container/
   Cluster/Namespace/Message filters, Group, Wrap lines, Pause, Clear, Jump to latest, bounded
   retention, partial failures, timestamps, virtualization, and legacy per-pod compatibility.
2. In History mode, local display filters MAY be applied to delivered historical records, but they
   SHALL not cause the backend to reread Kubernetes or change the immutable snapshot. The 1.3.1
   server-side search contract is the authority for historical filtering/search once implemented.
3. The aggregate WebSocket SHALL remain the transport authority. History messages MAY extend its
   versioned protocol, but the implementation SHALL not open one socket per source or per page.
4. Source scope SHALL remain the confirmed exact tuple set from v1.2.2. Mode selection SHALL not
   add contexts, containers, permissions, or authentication behavior.
5. Errors shown to users SHALL use the existing sanitized error boundary and SHALL exclude raw
   Kubernetes bodies, headers, credentials, kubeconfig values, and arbitrary response metadata.

### HS-8 - Resource limits and edge cases

1. The design SHALL define and enforce separate per-source and aggregate limits for bytes, lines,
   temporary disk, in-flight memory, page/window size, network response size, concurrent sessions,
   and concurrent source reads. No limit may be unlimited by omission.
2. Limits SHALL apply consistently to one source and many sources. Aggregate caps SHALL prevent a
   large source set from multiplying per-source allowances without bound.
3. Logs without timestamps SHALL remain readable and addressable by line/offset order. Mixed
   timestamped and untimestamped records SHALL not be silently reordered.
4. Rotation or restart observed during acquisition SHALL be reported as source continuity state,
   not treated as synthetic pagination. The implementation SHALL define whether a resumed/restarted
   read is disallowed, deduplicated, or captured as a new source generation before coding.
5. Container restart logs via `--previous` are outside the default 1.3.0 history scope. If supported,
   `--previous` SHALL be an explicit source/read variant in the applied contract, stored and labeled
   separately from current-container history; it SHALL not be inferred from a failure or empty result.
6. History SHALL not become a durable archive, background cluster collector, or cross-user shared
   cache. Retention ends with TTL/cleanup and is bounded by local resource policy.

### HS-9 - Security and desktop boundaries

1. Snapshot files and indexes SHALL remain in the privileged/backend process or its controlled
   temporary area. The renderer SHALL receive only validated pages, metadata, progress, and safe
   errors through the existing desktop bridge/API boundary.
2. File names, paths, cursors, source labels, and user-provided filters SHALL be validated and
   encoded; path traversal and arbitrary file access SHALL be rejected.
3. Sensitive material including kubeconfig contents, tokens, client certificates, authorization
   headers, request bodies, raw Kubernetes errors, and unrelated local files SHALL never be written
   to the snapshot, returned in metadata, shown in the UI, or included in diagnostics.
4. Cleanup failures SHALL produce bounded diagnostic state without exposing local paths or sensitive
   filesystem details to the renderer.

### RA-1 - Regression and read-only acceptance

1. Focused backend tests SHALL cover one and multiple sources, duplicate names across contexts,
   follow=false acquisition, NDJSON/index reads, page cursors, missing timestamps, limits,
   cancellation, TTL cleanup, restart/orphan cleanup, and safe errors.
2. Focused frontend tests SHALL cover mode/policy draft and Search confirmation, progress/status
   transitions, window requests, stale generation handling, virtualization, historical tail to
   live transition, filters, grouping, wrapping, and accessibility states.
3. Existing live session, Search confirmation, source scope, logs presentation/range, aggregate
   WebSocket, legacy endpoint, and safe-error coverage SHALL continue to pass.
4. Integration validation SHALL be read-only and SHALL not use Kubernetes mutation, expose
   kubeconfig data, package the desktop app, publish a release, or mark tasks complete without
   recorded evidence.
5. Every configured limit and cleanup path SHALL have executable evidence or an explicitly recorded
   environment limitation before implementation is considered complete.

## Definition of done

- Live mode remains behaviorally compatible and History mode is an explicit Search-applied choice.
- Each historical source is read with `follow=false`, with complete-when-available versus bounded
  semantics visible and no false claim of Kubernetes-native pagination.
- Temporary NDJSON storage, offset/line/timestamp indexing, limits, progress, cancellation, TTL,
  cleanup, safe errors, and desktop isolation are implemented and tested.
- Frontend delivery is paged/windowed and virtualized; stale responses cannot cross session
  generations; historical-to-live behavior is explicit and does not duplicate sockets.
- Missing timestamps, multi-source identity, rotation/restart, and `--previous` scope are recorded
  and tested according to the chosen contract.
- Search confirmation, local/live filters, grouping, wrapping, aggregate transport, read-only
  Kubernetes behavior, and legacy compatibility remain intact.
- Named owners provide focused automated and read-only evidence; open limitations and risks remain
  explicit rather than inferred as passed.
- This specification changes no source code, does not commit, package, or publish a release.
