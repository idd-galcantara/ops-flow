# Requirements - ops-union v1.2.0 log improvements

## Scope

This specification defines bounded, time-filtered, structured log viewing for one or more
Kubernetes pods. It extends the existing read-only log workflow with period presets, explicit
`from`/`to` ranges, structured timestamps, line and byte budgets, application identity, frontend
virtualization, and one WebSocket that multiplexes several pod/container sources.

The existing per-pod WebSocket remains supported for compatibility. This release does not add
Kubernetes mutations, authentication, kubeconfig persistence, arbitrary filesystem access, or a
second log transport.

## Glossary

- **Log source:** One `(cluster, namespace, pod, container)` stream identified by a stable
  `sourceId` within a WebSocket subscription.
- **Period preset:** A named relative interval (`5m`, `15m`, `1h`, `6h`, or `24h`) calculated from
  the time the subscription is created, plus an `All available` option.
- **Custom range:** An absolute UTC interval represented by `from` and optional `to` timestamps.
- **Structured log event:** A log record whose source, sequence, timestamp, message, and byte
  accounting are separate fields rather than a single display string.
- **Application identity:** A normalized identity derived from pod labels or its controller
  `ownerReference`, with a pod fallback when neither is available.
- **Partial failure:** A source-level failure that is reported for that source while other sources
  continue streaming.
- **Effective limit:** The server-applied value after requested line/byte limits are validated and
  clamped to the release maximum.

## Requirements

### Requirement 1 - Select a log period

1. WHEN the user opens logs THEN the frontend SHALL offer `All available`, `Last 5 minutes`,
   `Last 15 minutes`, `Last hour`, `Last 6 hours`, and `Last 24 hours` period presets, plus a
   custom range mode.
2. WHEN the user chooses a preset THEN the client SHALL calculate an absolute UTC `from` value at
   subscription time and SHALL send the selected period in the subscription metadata.
3. WHEN the user chooses a custom range THEN the UI SHALL provide `from` and `to` datetime
   controls and SHALL serialize them as ISO 8601 UTC timestamps.
4. The range SHALL be half-open: `from` is inclusive and `to` is exclusive. An omitted `to` means
   an open-ended live range; an omitted `from` means all available history subject to limits.
5. IF `from` is not earlier than `to` THEN the client SHALL prevent subscription and show an
   actionable validation message without opening a socket.
6. WHEN a finite `to` is reached THEN the affected source SHALL end with reason `to-reached`, while
   other sources remain active until their own end or limit.
7. WHEN a time boundary is active THEN the backend SHALL request timestamped Kubernetes logs and
   SHALL enforce the boundary using parsed timestamps, including stopping a follow stream after
   `to`.

### Requirement 2 - Emit structured, timestamped log events

1. WHEN a log line is delivered THEN the WebSocket SHALL send a structured event containing
   `type: "line"`, `sourceId`, a monotonically increasing source sequence, `timestamp` as an ISO
   UTC string or `null`, `message` without the Kubernetes timestamp prefix, and its UTF-8 byte
   count.
2. The backend SHALL request Kubernetes timestamps for every new log subscription and SHALL parse
   valid timestamp prefixes without treating the timestamp as message text.
3. IF a line cannot be parsed as timestamped content THEN the backend SHALL preserve the line with
   `timestamp: null` when no time boundary is active and SHALL exclude it from a bounded time range
   while reporting the dropped count in source summary metadata.
4. Structured events SHALL retain source identity, application identity, and ordering information
   even when several sources emit interleaved lines on one socket.
5. The legacy per-pod endpoint MAY retain its existing envelope for compatibility, but new
   aggregated subscriptions SHALL use the structured protocol defined by the design document.

### Requirement 3 - Enforce line and byte limits

1. WHEN a client subscribes THEN it SHALL be able to request per-source and aggregate
   `maxLines` and `maxBytes` limits.
2. The backend SHALL apply an effective limit for each source and for the whole subscription,
   SHALL reject non-positive or malformed values, and SHALL clamp values above the release caps.
3. The server SHALL enforce limits before sending an event that would exceed the corresponding
   budget; it SHALL never create an unbounded in-memory backlog while streaming.
4. WHEN a source reaches a per-source limit THEN it SHALL emit `sourceEnded` with reason `limit`
   and SHALL not prevent other sources from continuing.
5. WHEN the aggregate line or byte budget is reached THEN the server SHALL stop every active source,
   emit a terminal `summary` with reason `aggregate-limit`, and close the WebSocket normally.
6. The frontend SHALL retain no more than its configured client buffer and SHALL show effective
   source and aggregate counts/limits so the user can tell when history was truncated.

### Requirement 4 - Derive and expose application identity

1. WHEN pods are normalized THEN the backend SHALL expose a normalized application identity for
   each pod, derived without an additional mutating operation or arbitrary Kubernetes query.
2. The identity precedence SHALL be `app.kubernetes.io/name`, then `app`, then `k8s-app`, then the
   controller owner reference (`ownerReferences[].controller === true`), then a pod-name fallback.
3. The identity SHALL include a stable grouping key, a display name, and its source (`label`,
   `ownerReference`, or `pod`). Blank label values and non-controller owner references SHALL be
   ignored.
4. WHEN labels and owner references are absent THEN the fallback identity SHALL remain unique to
   the pod and SHALL be clearly marked as a pod fallback.
5. The frontend SHALL offer application grouping for the unified pod view and log view. Rows and
   log events with the same application key SHALL appear in the same group while preserving cluster
   and namespace context.
6. Application identity SHALL be a display/grouping value only; it SHALL not grant access to pods
   outside the selected cluster and namespace targets.

### Requirement 5 - Aggregate several pods through one WebSocket

1. WHEN the user selects logs for one or more pod/container sources THEN the frontend SHALL open
   exactly one `WS /api/logs` connection for that log session and SHALL send one subscription
   message containing all selected sources.
2. The subscription SHALL carry the source tuple `(cluster, namespace, pod, container)`, time range,
   follow mode, and requested line/byte limits. Duplicate source tuples SHALL be de-duplicated
   before streaming.
3. The backend SHALL enforce a maximum source count per subscription and SHALL return a clear
   protocol error for an empty, malformed, or over-sized subscription without starting partial
   streams.
4. The server SHALL send source lifecycle events (`sourceStarted`, `line`, `sourceEnded`) and a
   final aggregate `summary`, allowing the client to render interleaved lines without opening one
   socket per pod.
5. Disconnecting the client SHALL cancel all upstream Kubernetes log requests and release every
   source handle, including sources still being initialized.
6. A finite, non-following subscription SHALL close after all valid sources have ended. A following
   subscription SHALL remain open while at least one source is active, unless a global limit or
   fatal protocol error ends it.

### Requirement 6 - Preserve useful behavior during partial failures

1. IF one source cannot be authorized, found, connected, or parsed THEN the backend SHALL emit a
   source-scoped error and SHALL continue valid sources.
2. A source failure SHALL include the source tuple or `sourceId`, a safe user-facing message, and a
   terminal source status; it SHALL not expose kubeconfig credentials, response headers, or raw
   Kubernetes error bodies.
3. WHEN all sources fail THEN the client SHALL show the aggregate failure and the final summary,
   while retaining the individual reasons for diagnosis.
4. WHEN at least one source succeeds THEN the UI SHALL render successful lines and visibly indicate
   failed or ended sources without replacing valid output with a single generic error.
5. A transport failure that makes the WebSocket unusable SHALL be distinct from source failures and
   SHALL transition the whole session to an error state.

### Requirement 7 - Render large log streams with bounded frontend work

1. The log output SHALL use windowed/virtualized rendering so DOM nodes are proportional to the
   visible viewport rather than the total retained line count.
2. Virtualization SHALL preserve source labels, timestamps, application grouping, ordering,
   keyboard focus, text filtering, selection, auto-scroll, pause/resume, clear, and jump-to-end
   behavior.
3. WHEN the user scrolls away from the end THEN new events SHALL remain in the bounded buffer but
   SHALL not force-scroll the viewport; the UI SHALL expose an accessible action to return to the
   latest event.
4. Filtering SHALL operate on structured fields and SHALL not require rendering hidden rows.
5. The frontend SHALL expose connection, source, limit, empty, time-range, and partial-failure
   states with accessible names and visible focus states at desktop and narrow widths.

### Requirement 8 - Preserve read-only and compatibility boundaries

1. All new backend operations SHALL remain read-only Kubernetes log/list/get operations. No
   restart, scale, exec, delete, apply, patch, or other mutation SHALL be introduced.
2. The existing per-pod log URL SHALL continue to accept its established container, follow, and
   tail-line behavior until a separately approved removal.
3. New limits, time filters, identities, and aggregate failures SHALL be covered by backend and
   frontend tests, including source cancellation and StrictMode/effect teardown scenarios.
4. The implementation SHALL not expose or persist kubeconfig secrets, raw API responses, or
   unbounded log payloads.

## Definition of done

- The logs UI offers the documented presets and validated custom `from`/`to` ranges.
- New subscriptions deliver structured, timestamped, source-tagged events over one WebSocket for
  multiple pod/container sources.
- Per-source and aggregate line/byte limits are negotiated, enforced, surfaced, and tested.
- Pod and log grouping can use the deterministic application identity precedence.
- Source failures are isolated and visible while successful sources continue.
- Large output uses virtualization and bounded client retention without breaking existing controls.
- Legacy per-pod streaming, read-only guarantees, and safe error handling remain intact.
- Focused backend/frontend tests, typechecks, production builds, and read-only integration checks
  pass; package versioning, commit, tag, and publication remain separate release actions.
