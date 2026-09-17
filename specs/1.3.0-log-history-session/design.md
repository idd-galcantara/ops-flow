# Design - ops-union v1.3.0 log history session

## Overview

The current logs workspace is an aggregate live viewer. Version 1.3.0 adds a second applied
session mode while keeping the current live path authoritative for compatibility. History mode is
a backend-owned finite snapshot session: the backend performs one read-only `follow=false` read per
confirmed source, appends normalized records to temporary NDJSON, builds a bounded index, and
serves only requested windows over the existing aggregate WebSocket protocol.

The backend is deliberately not pretending that Kubernetes pod logs are a seekable paginated data
source. The snapshot is the pagination boundary. A complete snapshot contains everything returned
by the finite source read before a documented limit, failure, cancellation, or source EOF.

## Ownership boundaries

- `backend/src/kube` and the existing log protocol/session owner own read-only source acquisition,
  `follow=false`, source identity, safe errors, cancellation, and Kubernetes compatibility.
- A new backend history-session/storage module owns snapshot state, temporary NDJSON files, indexes,
  limits, TTL, orphan cleanup, cursor validation, and page/window reads. It does not own frontend
  filtering or Kubernetes mutations.
- The existing aggregate WebSocket route/protocol owner owns one authenticated desktop session and
  multiplexes versioned history lifecycle, progress, page/window, cancel, and transition messages.
  It must preserve the existing live message contract for clients that do not request History mode.
- `frontend/src` owns applied/draft mode state, history status, virtualized window requests, window
  cache eviction, historical/live presentation, grouping, wrapping, and accessible feedback.
- Existing Search/filter/session/presentation/range helpers remain authoritative where their current
  contract applies. v1.3.1 extends the history owner for server-side search; it does not move live
  filtering into the backend.
- `desktop/src/preload.ts` and the desktop bridge remain the only renderer boundary for any new
  history messages. The renderer never receives filesystem paths or reads snapshot files.
- `@ops-union-backend` owns protocol, acquisition, storage, limits, cleanup, and backend tests.
- `@ops-union-frontend` owns mode controls, history state, virtualization, transition UI, and
  frontend tests.
- `@ops-union-integration-qa` owns read-only integration, security, limit, compatibility, and
  multi-source evidence.
- Specification handoff is coordinated by the repository maintainer; no handoff task is evidence
  that implementation is complete.

## Applied session model

The existing draft/applied Search model gains explicit history fields without changing the meaning
of existing fields:

```ts
interface AppliedLogMode {
  mode: 'live' | 'history';
  historyPolicy?: 'complete-when-available' | 'bounded';
  range: AppliedRange;
  follow: boolean; // live contract; history is finite until explicit transition
  sources: SourceTuple[];
}

interface SourceTuple {
  cluster: string;
  namespace: string;
  pod: string;
  container: string;
}
```

History policy is applied atomically with the rest of Search. Draft edits remain inert. The initial
Live state preserves the current behavior. A History session is identified by a server-issued
`sessionId`, a `snapshotId`, and a monotonically increasing `generation`; all frontend state and
responses carry the generation so stale windows cannot cross sessions.

## State machine

```text
idle/live
  -> draft-history
  -> history-starting
  -> history-reading
  -> history-ready-partial-or-complete
  -> history-window-loading
  -> history-browsing
  -> history-tail-transition-pending
  -> live-starting -> live

history-starting/reading/browsing -> cancelling -> history-cancelled -> cleaned
history-* -> expired -> cleaned
history-reading -> history-failed-partial-or-terminal
```

A source can be `queued`, `reading`, `indexing`, `ready`, `partial`, `failed`, or `cancelled`
independently of the aggregate session. Aggregate status is derived from source statuses and the
storage lifecycle. A finite snapshot never uses `streaming` as its terminal state; the UI uses
`history ready`, `partial`, or `bounded` labels instead.

## Snapshot storage and index

The implementation uses one application-owned temporary directory per history session and one
NDJSON file per source. A session manifest records source tuple, snapshot version,
policy, applied range, byte/line counts, statuses, limit reasons, timestamps, and TTL metadata.
The manifest contains no credentials, request headers, raw response bodies, or filesystem paths in
renderer-facing payloads.

### Backend decisions for v1.3.0

- **Mode and generation:** `history.start` is the applied History-mode boundary. The server issues
  the session generation and the session carries immutable `sessionId` and `snapshotId` values.
  Draft mode and policy remain frontend concerns until Search confirmation.
- **History-to-live transition:** close the finite history session and start one new aggregate Live
  session after explicit confirmation. There is no same-socket attach and no per-source socket.
  This preserves the historical boundary and avoids presenting a finite snapshot as streaming.
- **Limits:** the implementation uses the named baseline table below plus a 512 KiB protocol frame,
  a 2,000-record/256 KiB window, two process-wide active sessions, eight concurrent source reads,
  120 window requests per minute, a 15-minute terminal TTL, and a one-hour orphan grace period.
  Both policies fail closed at these caps; cap hits always produce a partial/limit reason.
- **Timestamp and continuity:** timestamps are normalized when valid; missing or malformed values
  remain `null` and file/line order is authoritative. Each source is read exactly once with
  `follow=false`; no implicit reread or synthetic pagination occurs. Continuity is reported as
  single-read, or unknown if a future client reports a restart/rotation.
- **Previous logs:** `--previous` is excluded from v1.3.0. No previous-container read is inferred
  from an empty result or source failure; a future variant must be explicit and use a distinct source
  identity.
- **Cleanup and security:** session directories and files are random, mode `0700`/`0600`, backend
  owned, and removed on cancellation, TTL expiry, startup orphan cleanup, shutdown, or bounded
  cleanup retry exhaustion. Renderer payloads contain no local paths or raw Kubernetes errors.

Each record is one normalized NDJSON object containing the existing safe log event fields plus a
source-local sequence. The writer appends and flushes incrementally; it never accumulates the whole
source in memory. A companion index contains entries such as:

```text
sourceId | lineNumber | byteOffset | timestamp-or-null
```

The index is sparse only if a window reader can still resolve exact page boundaries; otherwise it is
one entry per line within the configured index budget. Timestamp indexes are lookup hints, not a
promise that records are globally time ordered. Null/malformed timestamps retain line order and are
reported as missing timestamp metadata rather than repaired from untrusted text.

### Implemented resource envelope

These are the implemented v1.3.0 baselines. They are represented as named configuration, tested at
boundary values, and surfaced as safe limit metadata; they are not permission to remove tighter
existing limits.

| Resource | Per source baseline | Per session baseline |
| --- | ---: | ---: |
| Snapshot records | 100,000 lines | 1,000,000 lines |
| Snapshot data | 32 MiB | 256 MiB |
| Temporary disk including index | 48 MiB | 384 MiB |
| In-flight decoded record memory | 4 MiB | 32 MiB |
| Delivered window | 2,000 records / 256 KiB | 8 windows cached |
| Source reads | 1 | 8 concurrent sources |
| History sessions | 1 active per desktop/backend owner | 2 process-wide |

The backend names the decoded-memory limits `maxInFlightDecodedBytesPerSource` and
`maxInFlightDecodedBytesPerSession`, with the 4 MiB and 32 MiB baselines above. A page is charged
for its on-disk page buffer, conservatively expanded decoded text, and fixed per-record object
overhead before its buffer is allocated or any record is decoded. The existing window record/byte
caps remain independent. The session accounts the sum of active page reservations, rejects a page
when either source or session budget would be exceeded with the stable error
`History page exceeds the in-flight decoded memory limit.`, and releases each reservation in a
`finally` block because page reads are synchronous.

The implementation also enforces a network/message cap for each protocol frame and a bounded
cursor/page request rate. Limits are fail-closed: captured records remain readable, but the status
becomes bounded/partial and no unbounded retry is attempted.

Focused tests verify the exact per-source and per-session decoded-memory envelope and release the
reservation after each page read. An RSS profiler was not run, so these byte budgets are not an
RSS measurement claim.

## Acquisition and source continuity

For every confirmed source tuple, the acquisition adapter invokes the existing read-only pod-log
operation with `follow=false`. It writes records as they arrive, updates the source manifest, and
builds offset/line/timestamp index entries. There is no attempt to ask Kubernetes for a page offset.
The adapter treats EOF as a normal finite boundary and source errors as source-scoped failures.

The implementation captures only the response associated with the source generation requested at
session start, marks continuity as `unknown` if a client reports a restart, and avoids automatic
rereads. A reread is a new explicit session, not an implicit page fetch. `--previous` is excluded
from the default source request; a future explicit variant must use a separate source/read identity
and metadata flag.

## Protocol contract

The existing aggregate WebSocket remains the single transport. Message names are illustrative and
must be versioned consistently with the existing protocol implementation:

```text
client -> server: history.start { requestId, generation, policy, range, sources }
server -> client: history.accepted { requestId, sessionId, generation }
server -> client: history.progress { sessionId, generation, aggregate, sources[] }
client -> server: history.window { sessionId, generation, cursor, direction, limit }
server -> client: history.window { sessionId, generation, cursor, records[], hasMore }
client -> server: history.cancel { sessionId, generation, reason }
server -> client: history.terminal { sessionId, generation, status, limits, sources[] }
```

All inbound values are schema-validated and bounded. A window response contains no local path and
is rejected when the session/generation/cursor does not match. Records are normalized through the
existing safe log event contract; raw Kubernetes response text is never used as a protocol error.
A protocol frame is capped independently from snapshot caps.

The frontend requests an initial window around the first visible range, prefetches only a small
adjacent window, and requests older/newer windows as the virtualizer approaches an edge. Window
cache eviction is bounded by bytes and count. A failed window request is retryable only while the
snapshot is valid; a cancelled/expired session is terminal.

## Historical-to-live transition

The recommended decision is **close history and start one new live session** when the user confirms
Follow/live at the historical tail. This keeps source and range semantics explicit, prevents a
finite snapshot from being presented as a stream, and uses the existing one aggregate WebSocket
replacement boundary. The UI retains the history session summary while the new live session is
connecting. If the implementation instead supports a server-side attach, it must prove that it
uses one socket, one source scope, and an explicit boundary marker; attach is not assumed by this
specification.

A transition that changes range, source scope, or Follow semantics uses the existing Search
confirmation. Duplicate transitions are disabled while connecting. A failed transition leaves the
history snapshot status visible and offers a retry without silently rereading Kubernetes.

## Frontend virtualization and presentation

The current output remains the scroll owner. History records are addressed by `(snapshotId,
sourceId, sequence)` or an equivalent stable key. The virtualizer renders only visible rows plus a
bounded overscan window, requests missing windows before they become visible, and invalidates row
measurements when Wrap lines changes. Grouping, text selection, source identity, timestamps in the
record, and safe highlight behavior remain compatible with the current presentation contract.

History loading indicators are distinct from a zero-record result. An empty complete snapshot,
partial snapshot, source failure, cancellation, expiry, and no-results-after-filter state each has
text/accessible status. The historical tail action is not the same as the immediate live Pause
control.

## Cleanup, security, and desktop isolation

The session registry owns TTL timers, cancellation tokens, active stream handles, file descriptors,
manifest/index writers, and cleanup retries. Startup scans only the application-owned temp root for
orphaned manifests older than the cleanup grace period; it never scans arbitrary user paths. Cleanup
is idempotent and bounded. A failed deletion is logged with an internal correlation id while the
renderer receives a generic cleanup status.

The desktop bridge forwards validated protocol messages only. It never grants renderer file access,
returns kubeconfig data, or stores snapshots in a user export directory. Export is intentionally
left to v1.4.0 and must use a user-selected destination with a separate security review.

## Validation strategy

### Backend checks

- Unit-test acquisition with finite fake streams, EOF, source errors, duplicate source names,
  missing timestamps, malformed timestamps, line/byte limits, disk failures, cancellation, and
  generation/cursor validation.
- Test NDJSON/index round trips at first/last/boundary lines and pages, including multi-byte UTF-8
  byte offsets and records containing newlines escaped inside JSON strings.
- Test TTL, startup orphan cleanup, cleanup retry bounds, concurrent session/source caps, and safe
  error mapping.
- Preserve existing backend protocol, logs subscription, security, and legacy endpoint tests.

### Frontend checks

- Test draft/applied mode and policy, Search confirmation, history status progression, page/window
  requests, stale generation rejection, bounded cache, virtualization, empty/partial/cancelled/
  expired states, transition to live, filters, grouping, wrapping, and keyboard/accessibility.
- Assert Live mode produces the existing payload and socket behavior and History mode uses one
  aggregate transport with no per-source sockets.

### Integration and scope checks

- Run workspace tests, backend/frontend typechecks, builds, and `git diff --check` after source
  implementation; this specification itself authorizes no source edit or release activity.
- Exercise read-only multi-source scenarios with repeated names, missing timestamps, limit hits,
  cancellation, restart/rotation policy, TTL cleanup, and historical/live transition.
- Record unsupported browser, Kubernetes, disk, or desktop-environment checks as limitations.
- Confirm no raw response body, headers, credentials, kubeconfig data, local paths, commit,
  packaging, or release artifact appears in evidence.
