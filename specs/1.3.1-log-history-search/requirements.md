# Requirements - ops-union v1.3.1 log history search

## Scope

Version 1.3.1 adds server-side filtering and text search over the immutable historical snapshots
created by v1.3.0. The browser SHALL receive paginated or bounded streaming results and SHALL not
load the complete snapshot merely to search it. The search operates on one consistent snapshot
version and preserves source identity, safe errors, progress, and cancellation.

This release depends on v1.3.0's History session, snapshot IDs/generations, temporary NDJSON/index
contract, limits, and one aggregate transport. It does not change Kubernetes access, pod-log
acquisition, or the meaning of `follow=false`; Kubernetes remains outside the search operation.
The existing Live mode keeps local retained-event filters when that is the appropriate behavior.

## User stories

- As a history user, I can apply pod/container/cluster/namespace filters and case-insensitive text
  search without loading the complete snapshot into browser memory.
- As a history user, I can see progress, paginated/streamed result windows, match counts when known,
  cancellation, and a clear no-results state.
- As a history user, I can review matched text with safe highlights that identify the requested
  term without altering the stored record.
- As a live user, I can continue using the existing local filters and Search confirmation without
  introducing a server search request for retained live events.
- As an operator, I can reason about search cost, snapshot consistency, limits, concurrency, and
  cancellation without any Kubernetes mutation or sensitive-data exposure.

## Glossary

- **History search:** A server-side query evaluated against one v1.3.0 immutable snapshot version.
- **Search draft:** Editable query/filter fields that are not active until Search is confirmed.
- **Applied query:** The last query/filter set confirmed by Search for the current history session.
- **Snapshot version:** Immutable `(snapshotId, generation, source set)` identity selected for a
  search. A new acquisition is never silently substituted into an existing query.
- **Text query:** Plain text message term under the documented case/normalization contract. Regex
  and arbitrary query languages are out of scope unless separately approved.
- **Result window:** Bounded ordered matches delivered to the frontend with a cursor and metadata.
- **Highlight range:** Validated record-local offsets identifying matched text; it is not executable
  markup and must be escaped by the renderer.
- **Local live filter:** Existing frontend predicate over retained live records, applied after Search
  confirmation without a backend search operation.

## Requirements

### HS-1 - Snapshot dependency and consistency

1. A history search SHALL require a ready or valid partial v1.3.0 snapshot session and SHALL include
   its exact `snapshotId` and generation in the request.
2. The backend SHALL bind the query to one immutable snapshot version. It SHALL reject, rather than
   silently mix, a request for an expired, cancelled, deleted, or mismatched snapshot.
3. Search results SHALL preserve source tuple identity `(cluster, namespace, pod, container)` and
   source-local sequence/line position from the snapshot.
4. A partial snapshot MAY be searched when the user explicitly accepts the partial/bounded status;
   every result and terminal response SHALL retain the partial/limit/source-failure indication.
5. Search SHALL not reread Kubernetes, open a new pod-log stream, change the source scope, mutate
   the snapshot, or create a new snapshot as a side effect.

### HS-2 - Server-side filters and text contract

1. History search SHALL support exact or contract-defined matching filters for pod, container,
   cluster, and namespace, with AND semantics across populated fields.
2. Text search SHALL be plain text by default and SHALL be case-insensitive using the documented
   Unicode normalization/case-folding contract. Regex, shell syntax, and arbitrary expressions
   SHALL not be interpreted unless a future version explicitly adds them.
3. Empty filter values SHALL mean no restriction for that field. A filter SHALL apply to structured
   source metadata, not to an untrusted concatenated display label.
4. The applied query SHALL include a bounded text length, bounded field lengths, and a defined
   behavior for whitespace-only input. The implementation SHALL reject invalid/oversized queries
   with a safe validation response before scanning.
5. Search SHALL define whether text matching covers message only or message plus selected metadata;
   the initial contract SHALL be message text, with source fields controlled by their own filters.
6. Case/normalization behavior SHALL be deterministic for ASCII and Unicode examples and SHALL be
   covered by focused tests. The original record and stored byte offsets SHALL remain unchanged.

### HS-3 - Indexing and scan strategy

1. The backend SHALL use the v1.3.0 offset/line/timestamp index and source metadata to skip sources
   that cannot match structured filters and to seek to bounded record ranges where possible.
2. The implementation MAY use an auxiliary token or field index, but it SHALL define its build cost,
   disk budget, invalidation/versioning, and fallback behavior. An index is not required to make a
   search claim that cannot be supported by the snapshot contract.
3. If no suitable text index exists, the backend SHALL perform a bounded sequential scan of the
   immutable NDJSON records, yielding progress and checking cancellation at bounded intervals.
4. Search SHALL not allocate the whole snapshot or all matches in memory. It SHALL maintain bounded
   scan buffers, result buffers, highlight data, and transport frames.
5. Search order SHALL be deterministic: source order and snapshot line/sequence order are the
   default unless an explicit timestamp order is approved. Missing timestamps SHALL use stored
   line/sequence order and SHALL not be silently sorted as zero or current time.
6. A scan that reaches resource or time limits SHALL terminate with a visible bounded/partial search
   status, captured result counts where known, and a machine-readable reason.

### HS-4 - Results, pagination, streaming, and highlights

1. Search results SHALL be delivered as bounded result windows or a bounded result stream over the
   existing aggregate WebSocket/session transport; one page SHALL not contain the entire match set.
2. Each result response SHALL include snapshot ID/version, query fingerprint or request ID, cursor,
   result order, record count, `hasMore`, and source/partial status. Cursors SHALL be opaque and
   validated server-side.
3. The frontend SHALL request additional result windows as needed and SHALL virtualize result rows
   or reuse the existing bounded output virtualizer. It SHALL not retain unlimited result pages.
4. A result MAY include validated highlight ranges for message text. Ranges SHALL be bounds-checked,
   non-overlapping or explicitly ordered, and rendered as escaped text/marks rather than HTML.
5. Highlights SHALL preserve selectable message text, Wrap lines behavior, grouping where supported,
   accessible names, and readable no-match/source metadata. The backend SHALL never return HTML.
6. Result pages from an old query, snapshot generation, or cancelled request SHALL not be appended to
   the current result set. Out-of-order responses SHALL be ignored or rejected safely.

### HS-5 - Progress, debounce, Search confirmation, and cancellation

1. Editing history query/filter fields SHALL update a draft only. It SHALL not scan, change visible
   applied results, or create a request before the existing `Search` confirmation.
2. The UI SHALL debounce only optional request preparation or validation; debounce SHALL not replace
   the explicit Search action or make a query active without confirmation.
3. Search SHALL expose validating/queued/scanning/streaming/complete/partial/cancelled/expired,
   no-results, and error states with accessible text and safe detail.
4. Cancellation SHALL be idempotent, stop or abandon the scan at a bounded checkpoint, prevent
   further result delivery, and release search buffers/cursors. It SHALL not delete the underlying
   valid snapshot unless the v1.3.0 lifecycle says that the session itself was cancelled.
5. Duplicate Search activation SHALL be prevented from producing overlapping active scans for the
   same applied query. A new confirmed query SHALL cancel or supersede the old query by generation.
6. Progress SHALL report scanned sources/lines or another honest unit. It SHALL be indeterminate
   when totals are unavailable and SHALL not claim completion before all eligible records are
   scanned or an explicit limit is reached.

### HS-6 - Live-mode preservation and filter semantics

1. In Live mode, Pod, Container, Cluster, Namespace, and Message filters SHALL remain local
   predicates over retained structured events, applied only after the existing Search confirmation.
2. Live filter edits SHALL not invoke History search, read snapshot files, open a backend scan, or
   alter the aggregate live subscription.
3. Grouping, Wrap lines, Pause, retained-event Clear, Jump to latest, bounded retention,
   virtualization, one-socket transport, partial-source feedback, and safe errors SHALL retain
   their existing behavior in Live mode.
4. The UI SHALL identify whether displayed results are live-local or history-server results, so a
   user cannot mistake a bounded history match set for the live retained buffer.
5. A transition between History and Live SHALL use the v1.3.0 mode/session boundary and existing
   Search confirmation. It SHALL not combine local live predicates with stale history cursors.

### HS-7 - Limits, concurrency, security, and errors

1. The search contract SHALL define and enforce limits for query length, structured field length,
   concurrent searches, scan bytes/lines, CPU/time, result count, result-window size, highlight
   ranges, memory, disk index use, network/frame size, and cursor lifetime.
2. Search limits SHALL be no weaker than v1.3.0 snapshot limits and SHALL be applied per request and
   per session so many clients/queries cannot multiply unbounded work.
3. The backend SHALL bound concurrent scans and queue or reject excess work with a safe capacity
   status. A cancelled query SHALL release its slot deterministically.
4. Errors SHALL distinguish validation, snapshot unavailable, expired, cancelled, limit reached,
   capacity, and internal failure without exposing raw stack traces, filesystem paths, Kubernetes
   bodies/headers, credentials, kubeconfig data, or request payloads.
5. Query text, field values, highlights, cursors, and snapshot IDs SHALL be schema-validated and
   bounded. Search SHALL not become an arbitrary file-read or path-selection API.
6. Search remains read-only. No Kubernetes mutation, new permission, authentication bypass, or
   desktop renderer filesystem access is introduced.

### RA-1 - Regression and acceptance

1. Backend tests SHALL cover filter combinations, case/Unicode behavior, missing timestamps,
   deterministic ordering, scan/index fallback, windows/cursors, highlights, no results, limits,
   cancellation, supersession, expiry, partial snapshots, concurrency, and safe errors.
2. Frontend tests SHALL cover draft/applied Search, debounce boundaries, stale result rejection,
   pagination/virtualization, highlight rendering/selection/wrap, status announcements, Live local
   filters, and History/Live transitions.
3. Existing v1.3.0 history-session, v1.2.3 Search confirmation, source scope, presentation,
   aggregate transport, legacy endpoint, and safe-error tests SHALL continue to pass.
4. Read-only integration validation SHALL prove that the browser does not receive the full snapshot
   for a search, that cancellation stops result delivery, and that no Kubernetes mutation occurs.
5. No task SHALL be considered complete without executable evidence or an explicitly documented
   environment limitation.

## Definition of done

- History queries use one immutable v1.3.0 snapshot version and never reread Kubernetes.
- Structured filters and bounded case-insensitive plain-text message search run server-side with
  deterministic ordering, progress, cancellation, pagination/streaming, and safe highlights.
- The browser retains only bounded result windows and does not load the whole snapshot to search.
- Search confirmation and optional debounce are distinct; duplicate/stale/cancelled queries cannot
  contaminate current results.
- Live filters remain local and preserve current Search, grouping, wrapping, virtualization,
  aggregate WebSocket, read-only, and safe-error behavior.
- Limits, security, no-results, partial/expired/cancelled states, and integration evidence are
  explicit and tested by named owners.
- This specification does not change Kubernetes behavior, source code, commit state, packaging,
  or release artifacts.
