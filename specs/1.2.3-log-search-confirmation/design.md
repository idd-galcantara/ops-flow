# Design - ops-union v1.2.3 log search confirmation

## Overview

Version 1.2.3 adds an explicit confirmation boundary to the v1.2.2 `LogViewer`. The component
keeps editable search controls in a draft and derives active behavior from an applied snapshot.
This prevents range, `Follow`, and filter edits from taking effect on every control event while
keeping the existing aggregate log session and local event model.

The design deliberately distinguishes transport changes from local filtering. Applying a changed
period/range or `Follow` replaces the aggregate session. Applying only pod/container/cluster/
namespace/text changes filters the existing bounded event buffer and does not replace the socket.
Grouping and `Wrap lines` remain independent presentation state, matching the current v1.2.2
behavior.

## Ownership boundaries

- `frontend/src/components/LogViewer.tsx` owns draft/applied search state, Search confirmation,
  validation timing, transport-session replacement, and immediate pause/clear controls.
- `frontend/src/logsRange.ts` remains the authority for custom range conversion and validation;
  validation is invoked for Search confirmation, not for every draft edit as a session trigger.
- `frontend/src/logsSession.ts` remains the authority for local AND filtering, retained event
  values, source identity, bounded retention, and source lifecycle helpers.
- `frontend/src/logsPresentation.ts` owns grouping and wrap state. These values are not part of
  the search model or subscription dependencies.
- The existing backend aggregate protocol, WebSocket route, limits, safe errors, and legacy
  endpoint remain unchanged. `@ops-union-backend` performs a contract check only if implementation
  exposes a missing compatibility field.
- `@ops-union-integration-qa` owns read-only integration, transport-count, accessibility,
  responsive, security, and release-scope evidence.

## Search state model

The viewer needs two equivalent-shaped snapshots so a control edit cannot mutate active behavior:

```ts
interface LogSearchValues {
  period: LogPeriod;
  customFrom: string;
  customTo: string;
  follow: boolean;
  filters: LogRecordFilters;
}

interface LogSearchState {
  draft: LogSearchValues;
  applied: LogSearchValues;
  validationError?: string;
}
```

`grouping`, `wrapLines`, `paused`, retained events, and auto-scroll are intentionally outside
`LogSearchValues`. A structural equality check compares all fields, including every filter field,
and determines whether Search has pending work.

The session effect consumes the applied transport projection only:

```ts
type TransportSearchValues = Pick<LogSearchValues, 'period' | 'customFrom' | 'customTo' | 'follow'>;
```

The local filtering projection consumes `applied.filters`. The subscription payload continues to
carry the resolved UTC range, `follow`, selected sources, and existing limits. It never carries
filters, grouping, or wrap mode.

## State transitions

```text
initial applied == draft
  -> validating -> connecting -> streaming / paused / ended / partial / error

draft edit
  -> pending-search (no socket or event change)

pending-search -- Search, filter-only change --> applied-local-filter (same socket and events)
pending-search -- Search, transport change --> validating -> connecting -> streaming / ...

pending-search -- invalid Search --> pending-search (previous applied session preserved)

any active state -- Pause --> paused or streaming (immediate, same socket)
any active state -- Clear buffer --> same session state with empty retained events
any active state -- Group/Wrap --> same session state with updated presentation
```

Search confirmation first validates a candidate snapshot, then commits it as one applied value.
When its transport projection changed, the existing effect cleanup closes the prior socket before
the new effect opens one. The effect's active guard rejects late events from the replaced socket.
When only filters changed, the applied snapshot changes without changing the transport effect
dependencies; the retained events remain available for the new local predicate.

Pause is not equivalent to `Follow: false`: Pause is a client-side immediate viewing/receipt
control for the current session, while `Follow` is a subscription parameter that changes only on
Search. The buffer Clear button is also separate from the filter-specific clear affordances.

## Toolbar and interaction contract

The toolbar keeps the existing period, custom range, Follow, structured filters, grouping, wrap,
Pause, and Clear controls. The period/range, Follow, and structured filter controls write to the
draft. A labelled `Search` button is placed with those controls and is enabled when the draft is
different from the applied snapshot. A small pending indicator and the current applied range/
filter summary make the confirmation boundary visible.

The presentation controls remain outside the Search group:

- `Group` changes the row grouping immediately and does not touch search state.
- `Wrap lines` changes row measurement/rendering immediately and does not touch search state.
- `Pause` toggles the existing immediate session behavior.
- The log-buffer `Clear` action removes retained events immediately.

`Clear filters` sets the filter fields in the draft to empty values. It does not apply them until
Search, so the user can revise several filters and confirm once. The separate log-buffer Clear
button retains its current immediate behavior.

## Session and filtering matrix

| User action | Draft/applied state | Socket | Retained events |
| --- | --- | --- | --- |
| Edit period, range, or Follow | Draft only | Unchanged | Unchanged |
| Edit pod/container/cluster/namespace/text | Draft only | Unchanged | Unchanged |
| Search with transport change | Commit all fields | Replace with one session | Reset per existing session start |
| Search with filter-only change | Commit all fields | Unchanged | Preserved and refiltered |
| Search with no changes | No change | Unchanged | Unchanged |
| Pause/resume | Immediate local state | Unchanged | Existing behavior |
| Log-buffer Clear | No search change | Unchanged | Cleared immediately |
| Grouping or Wrap lines | Presentation only | Unchanged | Preserved |

## Validation and error behavior

Draft custom values may be incomplete while the user is typing. On Search, `resolveLogRange` and
its existing half-open interval validation produce the user-facing error. An invalid candidate is
not committed, does not clear events, and does not close or open a socket. The previous applied
range and filters remain authoritative.

Search must be serialized at the UI boundary. While a transport replacement is validating or
connecting, a duplicate activation cannot create a second replacement session. Existing cleanup
and connection-state handling remain the source of truth for close/error/partial outcomes. Safe
messages continue to hide raw Kubernetes bodies, headers, credentials, and kubeconfig data.

If a Search action arrives while the current socket is paused, the pause state is not silently
converted into a new `Follow` value. The replacement session follows the applied transport values,
and the existing paused-view behavior remains visible until the user resumes it.

## Compatibility and tradeoffs

The design does not turn local filters into server-side query parameters because v1.2.2 already
retains structured events and applies filters before virtualization. This keeps the wire contract,
source limits, partial-failure behavior, and one-socket rule stable. The tradeoff is that a
filter-only Search does not fetch older events; it searches the bounded events already retained by
the current session.

The explicit distinction between `Follow` and Pause avoids a surprising reconnect from a quick
pause interaction. Grouping and wrap remain presentation-only because changing row organization or
height must not affect source scope, event retention, or server state.

## Validation strategy

### Focused frontend tests

- Draft edits for every period/range, Follow, pod, container, cluster, namespace, and text field
  do not change applied state, socket trigger inputs, or retained events.
- Search atomically applies mixed draft values; invalid range Search preserves the old session.
- Transport-only Search replacement opens one aggregate session and rejects late events.
- Filter-only Search updates visible records locally and preserves the socket and event buffer.
- No-op Search, duplicate Search, Pause, buffer Clear, grouping, and Wrap lines preserve their
  specified boundaries.
- Applied filter AND semantics, custom range validation, pending indicators, and accessible
  labels/statuses remain covered.

### Backend and integration checks

- Reuse existing backend protocol/security tests and document that no backend change is required
  unless the unchanged subscription contract proves insufficient.
- Run workspace tests, typechecks, builds, and `git diff --check`.
- Exercise a read-only live aggregate session with a transport Search replacement, a filter-only
  Search, pause, clear, grouping, wrap, partial source failure, limits, and cancellation.
- Record unavailable browser/network/accessibility checks as limitations rather than implementation
  evidence.