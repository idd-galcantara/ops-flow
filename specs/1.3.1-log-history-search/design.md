# Design - ops-union v1.3.1 log history search

## Overview

Version 1.3.1 adds a query execution layer above the immutable snapshot/session boundary from
v1.3.0. The backend owns filter evaluation, text matching, scan/index strategy, result cursors,
progress, cancellation, and safe result metadata. The frontend owns draft/applied controls,
virtualized result presentation, highlight rendering, and the existing local filter path for Live
mode.

The query is bound to one snapshot version. A new source read, snapshot replacement, or implicit
Kubernetes request is never used to satisfy an existing query. This makes a result set explainable
even when the underlying cluster changes after the snapshot was captured.

## Dependencies and ownership boundaries

- v1.3.0 history storage is authoritative for snapshot identity, source metadata, NDJSON records,
  line/offset/timestamp indexes, TTL, cleanup, limits, and session generation.
- A backend history-search owner reads snapshots through a bounded reader abstraction. It does not
  read arbitrary paths and does not call Kubernetes.
- The existing aggregate WebSocket/session owner carries versioned search start, progress, result
  window, cancel, and terminal messages on the same authenticated desktop connection used by
  history sessions. No socket is opened per query or source.
- `frontend/src` owns search draft/applied state, explicit Search, optional debounce before Search,
  result-window cache, virtualized rows, highlight rendering, and History/Live labeling.
- Existing Live filter helpers remain authoritative for retained live records. They are not reused
  by passing live buffers to the backend and are not replaced by History search.
- `desktop/src/preload.ts` forwards validated messages only; the renderer never receives a path or
  opens a snapshot file.
- `@ops-union-backend` owns search protocol, query execution, indexing/scan, limits, and tests.
- `@ops-union-frontend` owns controls, state, result virtualization, highlights, accessibility,
  and tests.
- `@ops-union-integration-qa` owns read-only integration, security, resource, compatibility, and
  browser evidence.

## Query and result model

The applied query is deliberately narrow and structured:

```ts
interface HistoryQuery {
  snapshotId: string;
  generation: string;
  pod?: string;
  container?: string;
  cluster?: string;
  namespace?: string;
  message?: string; // plain text, Unicode case-folded by contract
  order: 'snapshot-line';
}

interface HistoryResult {
  source: SourceTuple;
  sourceId: string;
  sequence: number;
  lineNumber: number;
  timestamp: string | null;
  message: string;
  highlights: Array<{ start: number; end: number }>;
}
```

Values are validated and bounded before execution. The initial query searches `message` only;
source fields have their own exact filters. Empty/whitespace-only message behavior is specified as
no message predicate after trimming according to the final contract, and that behavior must be
covered by tests. Regex, fuzzy matching, shell syntax, and HTML are not part of this release.

Search ordering is snapshot line order within a deterministic source order. This avoids inventing a
time order for null timestamps or interleaving sources with incompatible timestamp quality. If a
future timestamp order is needed, it must be a separate contract with explicit tie and null rules.

## Consistency and lifecycle

The frontend copies the active `snapshotId` and generation into every query request. The backend
resolves them through the v1.3.0 session registry and opens a read-only snapshot handle. The handle
contains the snapshot manifest/version and immutable file descriptors/index readers. It is not a
filesystem path supplied by the client.

```text
history-ready snapshot
  -> query-draft
  -> query-validating
  -> query-queued
  -> query-scanning
  -> query-results
  -> query-complete | query-partial | query-no-results

query-scanning -> query-cancelling -> query-cancelled
query-* -> query-superseded | query-expired | query-error
```

A new confirmed query increments the frontend query generation and cancels/supersedes the previous
scan. Every result frame carries query generation, snapshot version, request ID, cursor, and order.
The frontend discards frames that do not match the current applied query and history session.

A partial v1.3.0 snapshot is searchable only after the UI makes its bounded/partial status clear.
Search terminal metadata repeats that status so a result list cannot be interpreted as a complete
cluster history.

## Matching and normalization

Structured filter matching uses exact normalized field values from the stored source tuple. Display
labels are not split or reparsed. The text matcher uses the approved Unicode case-folding and
normalization function consistently for query and message text, while highlight offsets are mapped
back to the original message string. The implementation must test ASCII, mixed case, composed and
decomposed Unicode, empty input, whitespace, and multi-byte characters.

The matcher returns original message text plus offsets. The backend never sends markup. The frontend
escapes text by construction and wraps only validated ranges in the existing accessible mark/highlight
presentation. Invalid, overlapping, or out-of-bounds ranges are rejected and the record may render
without highlights rather than falling back to unsafe HTML.

## Index and scan strategy

The first implementation should use a two-stage bounded plan:

1. Apply source metadata filters before opening records, using manifest/source indexes.
2. For each eligible source, use line/offset entries to seek the scan start and read NDJSON in
   bounded chunks. Apply message matching, construct result metadata/highlights, and emit windows.

A sequential scan is an accepted fallback because Kubernetes is not involved and the snapshot is
finite. An auxiliary text index is optional and must earn its disk/memory cost. If added, its key
includes snapshot version and normalization version; it is deleted with the snapshot and falls back
to a bounded scan when missing or corrupt. No index may cause the backend to hold all matches in
memory.

The reader accounts UTF-8 bytes separately from decoded characters, checks line and byte budgets,
and yields to cancellation/time checkpoints after bounded records or bytes. It returns an honest
indeterminate progress state when total eligible lines are unknown. Search limits are terminal
metadata, not silent truncation.

## Protocol and pagination

The history WebSocket remains the single transport. A versioned contract can use messages equivalent
to:

```text
client -> server: history.search.start {
  requestId, sessionId, generation, snapshotId, query, pageSize
}
server -> client: history.search.accepted { requestId, queryGeneration }
server -> client: history.search.progress {
  requestId, queryGeneration, scannedLines, scannedBytes, eligibleSources, status
}
server -> client: history.search.results {
  requestId, queryGeneration, cursor, results[], hasMore, partial
}
client -> server: history.search.cancel { requestId, queryGeneration }
server -> client: history.search.terminal {
  requestId, queryGeneration, status, matchCount, limitReason
}
```

The actual names must follow the existing protocol style. Every field is schema-validated and
bounded; `pageSize` is clamped to server limits, cursor values are opaque, and a cursor is bound to
snapshot/query/normalization version. Result frames have their own byte cap. Streaming is allowed
only as a sequence of bounded result frames with the same consistency metadata.

The frontend uses an applied query fingerprint for cache ownership. It keeps a small result window
cache and virtualizes rows. Requesting the next window is a view concern and never changes the
applied query. Backpressure is explicit: the server pauses result emission or closes with a safe
capacity status when the client does not acknowledge/consume according to the existing transport
contract.

## Search confirmation, debounce, and Live behavior

The toolbar retains the v1.2.3 draft/applied distinction. Editing text or structured filters marks
the query pending. A short debounce may validate query shape or prepare an input locally, but only
Search applies the query. Search is disabled while the same request is applying and a confirmed new
query supersedes the old one through generation/cancellation.

Live mode remains local: after Search, existing retained events are filtered by the current local
predicate without a backend search request. Group, Wrap lines, Pause, Clear, Jump to latest, and
virtualization preserve their immediate/presentation behavior. The UI labels History server results
separately from Live retained results, and switching modes goes through the v1.3.0 session boundary.

## Status, errors, and security

The UI presents validating, queued, scanning, streaming, complete, partial/limited, no results,
cancelled, expired, unavailable, and error states as text and accessible status. No-results is a
successful terminal state with zero result windows, not a transport error. A partial snapshot or
search limit is shown alongside any matches.

Backend errors are mapped to stable safe codes such as `invalid_query`, `snapshot_expired`,
`query_cancelled`, `search_limit_reached`, `search_capacity`, and `internal_search_error`. Internal
logs may use a correlation ID under the existing security policy, while renderer messages omit raw
paths, stacks, headers, credentials, kubeconfig values, Kubernetes bodies, and query secrets beyond
what the user entered.

## Validation strategy

### Backend checks

- Test exact structured filters, AND semantics, message-only matching, case-fold/Unicode behavior,
  empty/whitespace queries, missing timestamps, deterministic ordering, multi-source identity,
  partial snapshots, and source-index pruning.
- Test sequential fallback, optional index versioning/invalidation if implemented, UTF-8 offsets,
  bounded memory/disk, query/page/frame limits, cursors, progress, cancellation, supersession,
  expiry, concurrency, and safe error codes.
- Preserve v1.3.0 storage/session, existing aggregate WebSocket, live subscription, security, and
  legacy endpoint tests.

### Frontend checks

- Test draft/applied Search, debounce not applying early, duplicate Search, stale result rejection,
  page/window cache bounds, virtualized results, highlights, selection, wrapping, no-results,
  partial/limit/expired/cancelled states, accessible announcements, and History/Live labels.
- Prove Live filter changes remain local and do not create a history query or alter the socket.

### Read-only integration checks

- Use fixed snapshots or a read-only cluster fixture to prove the browser receives windows rather
  than the full snapshot, filters combine correctly, result order is stable, cancellation stops
  delivery, and partial/limit status is retained.
- Run workspace tests, typechecks, builds, and `git diff --check` after implementation; no source
  edit or release action is authorized by this specification.
- Record unavailable browser, cluster, disk, or desktop checks as limitations, never as passes.
