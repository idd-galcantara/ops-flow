# Design - ops-union v1.2.0 log improvements

## Overview

The current log path opens one WebSocket per pod/container and emits plain line messages. Version
1.2.0 keeps that path as a compatibility adapter while adding a multiplexed `/api/logs` socket. A
single subscription owns the time range, effective budgets, source lifecycle, structured events,
and cancellation for all selected sources.

The backend remains the authority for timestamp parsing, safe errors, Kubernetes limits, source
lifecycle, and application identity. The frontend owns period controls, session state, filtering,
virtualized presentation, and user actions. Neither layer persists log content or kubeconfig data.

## Ownership boundaries

- `backend/src/kube/normalizePod.ts` and a focused application-identity helper derive the stable
  identity from `V1Pod` labels and controller owner references while normalizing pod responses.
- `backend/src/kube/logsService.ts` owns timestamped Kubernetes log reads, time-boundary parsing,
  per-source budgets, and cancellation of one upstream request.
- A log subscription/multiplexer module owns protocol validation, source de-duplication, source
  fan-out, aggregate budgets, lifecycle events, and final summaries.
- `backend/src/logsWebSocket.ts` owns WebSocket upgrade routing, safe protocol errors, and
  disconnect propagation. The old `/api/pods/:cluster/:namespace/:pod/logs` handler remains a
  compatibility path and does not become the aggregate protocol.
- `frontend/src/api.ts` owns URL construction and the typed wire contract. A log-session hook or
  equivalent frontend module owns one socket per visible log session, subscription serialization,
  teardown, and source state.
- `LogViewer` or its replacement owns period/range controls, structured filtering, bounded client
  retention, virtualization, scrolling, accessibility, and partial-failure presentation. It does
  not open a socket for each source.
- Existing pod selection and store state remain the source of truth for selected pods. Log session
  state is local to the details/log surface and is discarded when that surface closes.

## Application identity contract

The normalized pod response gains an `application` object:

```ts
interface ApplicationIdentity {
  key: string;
  name: string;
  source: 'label' | 'ownerReference' | 'pod';
  labelKey?: 'app.kubernetes.io/name' | 'app' | 'k8s-app';
  ownerKind?: string;
  ownerName?: string;
}
```

The backend selects the first non-empty label in this order:

1. `app.kubernetes.io/name`
2. `app`
3. `k8s-app`

If none is present, it selects the `ownerReferences` entry with `controller: true`, using its
kind/name pair. If no controller owner exists, it uses the pod name. The key is namespaced by the
identity source and value so a label and an owner with the same display text do not accidentally
collide. Values are trimmed for display and encoded for the key; no owner lookup is performed.

This is a snapshot from pod normalization. A later label or owner change becomes visible after the
next pod refresh. The frontend groups by `application.key`, but keeps cluster and namespace in the
row/source context so equal names in different clusters remain distinguishable.

## Period and range contract

The UI exposes these presets:

| UI choice | Wire meaning |
| --- | --- |
| All available | no `from` and no `to` |
| Last 5 minutes | `from = subscriptionCreatedAt - 5m` |
| Last 15 minutes | `from = subscriptionCreatedAt - 15m` |
| Last hour | `from = subscriptionCreatedAt - 1h` |
| Last 6 hours | `from = subscriptionCreatedAt - 6h` |
| Last 24 hours | `from = subscriptionCreatedAt - 24h` |
| Custom | explicit UTC `from` and optional `to` |

The wire contract uses ISO 8601 timestamps with `Z`. `from` is inclusive and `to` is exclusive.
Datetime-local controls are converted in the browser using the selected instant, not by string
concatenation. The frontend rejects `from >= to` and impossible dates before opening a socket.

For `from`, the backend passes the value to the Kubernetes log request as `sinceTime` where the
client supports it. Kubernetes timestamps are still requested and parsed locally. A `to` boundary
is enforced locally because the upstream API does not provide a reliable cross-client `untilTime`
contract: a line at or after `to` is not emitted, and a source ends with `to-reached`. A line with a
missing timestamp is omitted when either boundary is active and counted in the source summary.

A range with `to` is finite even when follow was requested. `follow` without `to` stays active
until cancellation, an upstream end, a source limit, or a global aggregate limit.

## Multiplexed WebSocket protocol

### Endpoint and initial message

The new endpoint is:

```text
WS /api/logs
```

The client sends exactly one initial JSON message before any source is started:

```json
{
  "type": "subscribe",
  "period": "1h",
  "follow": true,
  "from": "2026-09-16T10:00:00.000Z",
  "to": null,
  "sources": [
    {
      "sourceId": "cluster-a/ns-a/pod-a/app",
      "cluster": "cluster-a",
      "namespace": "ns-a",
      "pod": "pod-a",
      "container": "app"
    }
  ],
  "limits": {
    "maxLinesPerSource": 2000,
    "maxBytesPerSource": 2097152,
    "maxLinesTotal": 10000,
    "maxBytesTotal": 10485760
  }
}
```

`sourceId` is a client correlation value only; the backend validates and normalizes the source
tuple and de-duplicates identical tuples. The server returns the effective limits in an `accepted`
event. A malformed message, empty source list, invalid range, or source count over the server cap
is a global protocol error and starts no upstream request.

The initial source metadata may include the application identity already present in the pod
response. The backend treats it as display metadata and does not use it to authorize access; the
selected cluster, namespace, pod, and container are authoritative. If authoritative metadata is
available while opening a source, the server includes it in `sourceStarted`.

### Server-to-client events

All events are JSON objects with a `type` field:

- `accepted`: effective range, follow mode, limits, and normalized source count.
- `sourceStarted`: `sourceId`, source tuple, application identity, and zeroed counters.
- `line`: `sourceId`, source sequence, `timestamp: string | null`, `message`, and `bytes`.
- `sourceWarning`: source-scoped condition such as dropped unparseable lines, with a count.
- `sourceError`: source tuple, safe message, counters, and terminal status.
- `sourceEnded`: source tuple, counters, and reason `eof`, `to-reached`, `limit`, or `cancelled`.
- `summary`: all source statuses, emitted/dropped counts, effective aggregate budgets, and reason
  `completed`, `aggregate-limit`, `cancelled`, or `all-failed`.
- `error`: a fatal protocol or transport-independent error that prevents the subscription from
  being established.

A line sequence starts at one for each source and increases only for emitted lines. Byte counters
use UTF-8 encoded message bytes plus the normalized line separator accounting used by the backend;
the same value is used for per-source and aggregate budget decisions. Event envelopes are not
counted against log byte budgets. Counters are emitted in terminal source and summary events.

A source error is terminal for that source. It does not close the socket unless it is the last
source and no source has emitted a line, in which case the summary reason is `all-failed`. A global
limit stops all active handles and closes after the terminal summary. Closing the client socket
cancels every handle, including handles created after the disconnect race.

### Limits

The initial release defaults and caps are protocol constants, subject to later configuration:

| Budget | Default | Hard maximum |
| --- | ---: | ---: |
| Lines per source | 2,000 | 10,000 |
| Bytes per source | 2 MiB | 10 MiB |
| Lines per subscription | 10,000 | 50,000 |
| Bytes per subscription | 10 MiB | 50 MiB |
| Sources per subscription | 20 | 50 |

The server clamps values above the hard maximum and reports the effective value. Values that are
not finite positive integers are rejected. A source's upstream `tailLines`/`limitBytes` request is
bounded by its effective budgets; aggregate accounting remains in the multiplexer because several
upstreams share one connection. The frontend defaults to retaining at most 5,000 structured events
(or the lower effective aggregate line budget) and displays when older events were discarded.

## Backend source flow

```text
WebSocket upgrade /api/logs
  -> wait for and validate subscribe
  -> normalize ranges, sources, and effective limits
  -> send accepted
  -> start bounded sources with disconnect cancellation registered
  -> interleave structured lines through one sender
  -> source end/error/limit updates counters
  -> aggregate limit or all sources terminal
  -> send summary and close when appropriate
```

Each source uses the existing read-only Kubernetes `Log.log()` path with `timestamps: true`,
`follow`, `sinceTime`, and bounded tail/byte options. The stream parser retains a partial UTF-8
line until a separator arrives, parses the Kubernetes timestamp prefix, and emits the remainder as
`message`. A source must stop reading and abort upstream as soon as its per-source or aggregate
budget is exhausted.

The legacy endpoint continues to send its current `started`, `line`, `error`, and `end` envelopes.
It uses the same safe error and abort primitives but does not participate in aggregate accounting.

## Frontend state and rendering

The log session has these states:

```text
idle
  -> validating
  -> connecting
  -> streaming
  -> paused (socket remains active; bounded events continue to be counted)
  -> ended / partially-ended / error
```

Changing the period, custom range, source set, or container closes the prior session, clears its
buffer, and starts one new subscription. Pause stops visual append/render updates according to the
client buffer policy but does not leave an unbounded hidden queue; the UI reports lines received
while paused and applies the same retention limit. Clear removes retained events without changing
the server subscription.

The renderer stores structured events in a bounded ring or equivalent capped collection. Filtering
checks timestamp, message, source, container, cluster, namespace, and application fields before
virtualization. The visible list is passed to a windowing implementation with stable row keys based
on `(sourceId, sequence)`, not array index. Variable row measurement is allowed, but scrolling must
remain stable when new events arrive above or below the viewport. Auto-scroll is enabled only when
at the end; a focused `Jump to latest` control restores it.

Application grouping is a view of the same ordered event collection, not a second stream. Each
source remains individually identifiable inside its application group, and partial errors remain
visible beside the group that failed.

## Error, security, and compatibility decisions

- Safe error formatting from the existing pod service is reused. Raw `ApiException` bodies,
  headers, kubeconfig fields, and credentials never cross the WebSocket.
- Protocol validation errors are global and deterministic; Kubernetes access errors are source
  scoped so fan-out remains useful.
- The backend does not trust a frontend application label for authorization and does not perform
  owner traversal that could broaden the selected target scope.
- The server chooses and reports effective limits. The client may request smaller limits but cannot
  bypass server caps through query-string changes or multiple source entries.
- One WebSocket reduces browser connection overhead and makes aggregate budgets enforceable. The
  tradeoff is that the client must render source lifecycle and partial errors explicitly.
- Virtualization is required for DOM cost, while server/client caps are required for memory and
  network cost; either one alone is insufficient.

## Validation strategy

### Backend unit tests

- Parse timestamped and malformed lines, preserve messages, enforce inclusive/exclusive boundaries,
  and count dropped unparseable lines.
- Normalize positive limits, reject invalid values, clamp over-cap values, and stop at source and
  aggregate budgets.
- Derive application identity for each label precedence case, controller owner, and pod fallback.
- Validate subscription messages, de-duplicate sources, isolate source failures, emit summaries, and
  cancel all upstream handles after disconnect.
- Retain legacy per-pod WebSocket behavior and sanitized error messages.

### Frontend unit/component tests

- Convert each preset and custom datetime range to UTC and reject invalid ranges.
- Decode interleaved structured events, preserve source/application grouping, show partial failures,
  and apply client retention limits.
- Verify one socket per session, teardown on source/range changes, pause/clear/auto-scroll behavior,
  stable virtualization keys, and filtering without rendering hidden rows.
- Verify accessible limit, connection, range, and source error states at narrow widths.

### Commands and read-only checks

- `npm test --workspaces --if-present`
- `npm run typecheck --workspaces --if-present`
- `npm run build --workspaces --if-present`
- `git diff --check`
- Read-only integration test with multiple pods/containers, a missing source, finite `to`, follow,
  line/byte limits, disconnect cancellation, and an application identity fallback.
