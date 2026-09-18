# Design - ops-union v1.3.1 repeatable log search

## Overview

The current logs workspace uses equality between draft and applied Search values to decide whether
Search is actionable. That is sufficient for first confirmation but makes a completed Search look
like a permanently disabled action. Version 1.3.1 separates three concepts:

1. draft/applied equality, which says whether there are edits waiting for confirmation;
2. Search operation state, which says whether a request is currently being processed; and
3. an explicit Search activation, which is meaningful even when the values are unchanged.

The existing draft/applied model remains the source of truth for pending edits. A repeat activation
adds a new request/session boundary without inventing a second set of user-facing search values.
Every accepted Search also owns one invocation of the existing `Jump to latest` action when its
mode-specific initial results are ready. This applies to Live and History, including filter-only
confirmation, while preserving each mode's existing viewport and loading behavior.

## Ownership boundaries

- `frontend/src/components/LogViewer.tsx` owns Search activation, draft/applied snapshots, the
  immutable operation snapshot, busy presentation, mode-specific completion, session replacement
  triggers, and the one-shot `Jump to latest` request latch.
- `frontend/src/logsSearch.ts` remains the authority for value equality, cloning, transport/local
  projections, and pending-change classification. Equality SHALL no longer determine whether an
  idle Search button is actionable by itself.
- `frontend/src/logsRange.ts` remains the authority for resolving the candidate range at the
  activation boundary. The resolved range belongs to the operation snapshot and is not recalculated
  later from mutable draft state.
- Existing Live session effects and History generation/query helpers remain authorities for socket
  cleanup, source identity, stale response rejection, window caches, and local/History filtering.
- `LogViewer.tsx` owns the request-scoped `Jump to latest` latch and invokes the existing action.
  In Live the latch is fulfilled once the accepted request has current rendered rows; in History it
  is fulfilled once the current-generation query or initial result is sufficient. It is not reused
  for initial workspace setup, superseded sessions/generations, or later History window loading.
- The aggregate backend protocol owner SHALL verify that an explicit repeat can produce a distinct
  Live session or History generation. No new backend endpoint is expected.
- `frontend/src/index.css` and existing icon primitives own stable button geometry, busy styling,
  focus treatment, and responsive layout.
- `@ops-union-frontend` owns implementation and focused frontend behavior/accessibility evidence.
- `@ops-union-backend` owns a protocol compatibility check and backend tests only if the existing
  session/generation contract needs a narrow adjustment.
- `@ops-union-integration-qa` owns read-only transport-count, History-generation, responsive,
  keyboard, accessibility, security, and release-scope evidence.

## Search state model

The conceptual state remains:

```ts
interface LogSearchState {
  draft: LogSearchValues;
  applied: LogSearchValues;
}

type SearchOperation =
  | { status: 'idle' }
  | {
      status: 'applying';
      requestId: number;
      kind: 'live' | 'history' | 'local';
      snapshot: {
        values: LogSearchValues;
        range: { from?: string; to?: string };
        sources: LogSource[];
      };
    };
```

The exact implementation names may differ. The important invariant is that `searchHasPendingChanges`
answers only whether draft values differ from applied values, while `SearchOperation.status` answers
whether duplicate activation must be blocked. An idle Search button is enabled when the workspace
has a valid confirmed source scope, whether or not `searchHasPendingChanges` is true.

Every accepted activation validates and captures a request snapshot containing cloned candidate
values, the UTC range resolved at that activation, and the exact selected source tuples. It receives
a monotonically increasing request identity. The request identity is used to reject completion or
data from a superseded session and is distinct from the user-visible search values, so two
equal-value activations can still be separate operations. The automatic `Jump to latest` action is
eligible only for the accepted request identity, runs once at most, and is not armed by setup or
completed by a superseded session/generation. A Live repeat uses a new WebSocket because the backend
accepts one initial subscription per socket; a History repeat uses a new socket and a new positive
generation.

## Activation matrix

| Draft vs applied | Mode | Search behavior | Socket/generation | Busy completion | Automatic `Jump to latest` |
| --- | --- | --- | --- | --- | --- |
| Different, local filters only | Live | Commit and refilter retained events | Same socket | Local projection committed | Once after current accepted-request rows are rendered |
| Different, transport/mode values | Live | Commit and replace session | One new aggregate session | Session accepted or terminal error | Once after current accepted-request rows are rendered |
| Different, local filters only | History | Commit and start the confirmed query | Same History generation | Search returns idle after commit; query/window loading remains independent | Once when the initial query/result is sufficient; tail-window requests remain independent |
| Different, transport/mode values | History | Commit and create new generation | One new History session | Initial result boundary or error | Once when the initial query/result is sufficient; tail-window requests remain independent |
| Equal, Repeat Search | Live | Refresh current confirmed request | One new aggregate session | Session accepted or terminal error | Once after current accepted-request rows are rendered |
| Equal, Repeat Search | History | Recreate finite snapshot/query | One new History generation | Initial result boundary or error | Once when the initial query/result is sufficient; tail-window requests remain independent |

The matrix deliberately preserves v1.2.3 filter-only behavior when filters are newly changed, while
making an explicit no-change activation a refresh. This gives the user a way to refresh a relative
range without requiring a meaningless draft edit.

## State transitions

```text
idle + draft == applied
  -- Search --> live/history operation

idle + draft != applied
  -- Search --> validate
       -- invalid --> idle + pending draft
       -- local-only --> apply local values -> idle
       -- transport/mode --> replace session/generation -> busy

busy
  -- draft edit --> busy + pending draft (same operation snapshot)
  -- duplicate Search --> ignored
  -- completion/error/cancel --> idle

history terminal + initial query ready
  -- window request --> independent history-window loading

accepted Search + mode-specific initial results ready
  -- existing Jump to latest --> latest result visible once for requestId
```

A repeat Live Search must force a new session boundary even when the transport projection is equal;
updating an equal React state object alone is not a sufficient trigger. A repeat History Search must
similarly advance the session/generation identity, because stale windows from the previous snapshot
must never be accepted into the new result. Every accepted Search, including filter-only confirmation,
arms one request-scoped invocation of the existing `Jump to latest` action. Live waits for current
rows; History waits for sufficient initial query/results and does not replace or wait for tail-window
requests. The action is not armed by initial setup and cannot be completed by a superseded
session/generation. Existing `Pause` behavior remains authoritative and the action does not change
Pause, busy/completion, draft values, or source scope.

## Busy and completion contract

The button's busy state represents the main Search operation, not every later virtualized fetch.

- For Live, busy ends when the replacement aggregate session is accepted, or when connection/error
  handling makes that operation terminal. Existing source-level streaming and summary behavior
  remains visible through the connection status.
- For a transport-affecting History Search, busy continues through snapshot preparation until the
  current-generation `history.terminal` and `history.query.ready` events establish the initial
  result boundary. The first and later window requests have their own loading indicator; they must
  not be confused with Search activation.
- For filter-only Live confirmation, no transport busy indicator is needed. The local projection
  commits synchronously from the applied filter snapshot.
- For filter-only History confirmation, the Search operation returns idle after the applied filter
  snapshot is committed. The existing `history.query.start`, `history.query.ready`, and window
  loading states continue independently on the same History generation.
- After any accepted Search, the workspace invokes the existing `Jump to latest` action once for its
  requestId when initial results are ready. Live waits for current rows; History waits for sufficient
  initial query/results while preserving later tail-window requests. This is distinct from continuous
  auto-follow. If `Pause` is active, the existing paused behavior wins: the action does not resume the
  stream, change Pause, or reset paused counters.
- Invalid input never becomes busy. Safe errors and validation feedback remain separate from the
  idle/busy visual treatment.

If a newer operation supersedes an older one, only the current request identity may clear busy state
or mutate applied result state. Cleanup of the old WebSocket/session remains responsible for
cancelling or retiring its work.

## Toolbar interaction contract

Search remains in the existing primary action position and keeps its accessible name. In idle state
it is enabled both for `Search changes pending` and `Search applied` statuses. During an operation it
shows a loading affordance and `aria-busy="true"`; the control is disabled only for the duration
needed to prevent concurrent activation. The button's min-height, width, focus ring, and neighboring
layout remain stable when the icon changes.

Suggested status distinctions, using the existing live status region:

- `Search changes pending ...` when draft and applied values differ;
- `Applying search ...` or an equivalent mode-specific busy message during the operation; and
- `Search ready ...` when idle, including the applied filter count/mode as existing context permits.

The text is a contract for meaning, not a requirement to use these exact strings. Status changes
must be concise, polite, and free of raw source content.

Draft controls remain editable during busy. Their values are not included in the in-flight request
snapshot, so a user can prepare the next Search without causing a second operation. A subsequent
Search after busy ends applies that prepared draft or repeats the then-current applied values.

## Session and filtering compatibility

- A pending local-filter-only Search still uses retained Live records or starts the existing
  History query path; it does not broaden source scope or add a server endpoint.
- An equal-value Repeat Search is intentionally different from a pending local-filter-only Search:
  it refreshes the session/generation so a relative Live range can acquire newer records and a
  History snapshot can be recreated.
- Each operation uses its captured source tuples and resolved range. The effect or transport layer
  must not read later draft values when starting or completing that operation.
- `Pause`, retained-event `Clear`, `Group`, and `Wrap lines` remain immediate/presentation actions
  and never become Search operations. A successful Live Search tail reveal must not toggle or
  otherwise alter `Pause`.
- History Search keeps its current viewport, virtualized window, and explicit tail-request behavior;
  the automatic action uses the existing `Jump to latest` function after initial results and does not
  replace or wait for later tail-window requests.
- The automatic action is keyed by the accepted Search `requestId`: setup, ordinary initial loads,
  and superseded sessions/generations do not invoke it, and one request cannot invoke it twice.
- The selected source tuple list is captured for each operation. Changes to source selection remain
  outside this workspace's Search draft and continue through the existing Change sources flow.
- Existing limits, partial failures, cancellation, safe errors, virtualization, and stale-event
  guards remain authoritative.

## Validation strategy

### Focused frontend checks

- Render Search with equal draft/applied values and assert it is enabled while idle.
- Activate equal-value Search in Live and History and assert exactly one replacement session or
  generation, including a newly resolved relative range for Live.
- Assert pending local-filter-only and pending transport changes retain their existing matrix.
- Assert busy blocks duplicate activation, while draft edits during busy remain pending.
- Assert busy clears at Live acceptance/error and History initial result readiness/error, without
  clearing it prematurely at History acceptance alone.
- Assert each accepted Live and History Search, including filter-only confirmation, invokes the
  existing `Jump to latest` action exactly once per requestId at the mode-specific initial-results
  boundary. Assert Live waits for current rows, History waits for sufficient initial query/results,
  and History tail-window requests remain independent.
- Assert setup, ordinary initial loads, and superseded sessions/generations do not invoke the action;
  assert `Pause`, busy/completion, draft edits, applied values, and source scope remain unchanged.
- Assert filter-only History confirmation returns the main Search control to idle after commit while
  its same-generation query/window loading remains independent.
- Assert invalid custom ranges preserve the prior applied state and never show busy.
- Assert accessible name, `aria-busy`, status announcement, focus, stable geometry, and responsive
  behavior in idle, pending, and busy states.

### Backend and integration checks

- Reuse existing backend protocol, history, WebSocket, and security suites; add only narrow tests
  for a distinct repeat identity if the current contract requires them.
- Count aggregate Live sessions and History generations under repeated, rapid, failed, and partial
  operations using read-only fixtures or read-only cluster checks.
- Verify stale Live events and History windows cannot cross a repeat boundary.
- Run `npm test`, `npm run typecheck`, and `npm run build` in `frontend/`, reuse the backend test
  and typecheck commands when the protocol check requires them, and run `git diff --check` after
  implementation.
- Record unavailable browser, Electron, screen-reader, or cluster checks as limitations rather than
  implementation evidence. In particular, browser/E2E evidence for the request-scoped automatic
  action SHALL be recorded as unavailable when no suitable harness exists.
