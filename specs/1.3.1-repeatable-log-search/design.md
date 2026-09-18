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

## Ownership boundaries

- `frontend/src/components/LogViewer.tsx` owns Search activation, draft/applied snapshots, busy
  presentation, mode-specific completion, and session replacement triggers.
- `frontend/src/logsSearch.ts` remains the authority for value equality, cloning, transport/local
  projections, and pending-change classification. Equality SHALL no longer determine whether an
  idle Search button is actionable by itself.
- Existing Live session effects and History generation/query helpers remain authorities for socket
  cleanup, source identity, stale response rejection, window caches, and local/History filtering.
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
  | { status: 'applying'; requestId: number; kind: 'live' | 'history' | 'local' };
```

The exact implementation names may differ. The important invariant is that `searchHasPendingChanges`
answers only whether draft values differ from applied values, while `SearchOperation.status` answers
whether duplicate activation must be blocked. An idle Search button is enabled when the workspace
has a valid confirmed source scope, whether or not `searchHasPendingChanges` is true.

Every activation captures a request snapshot and receives a monotonically increasing request
identity. The request identity is used to reject completion or data from a superseded session. It
is distinct from the user-visible search values so two equal-value activations can still be
separate operations.

## Activation matrix

| Draft vs applied | Mode | Search behavior | Socket/generation | Busy completion |
| --- | --- | --- | --- | --- |
| Different, local filters only | Live | Commit and refilter retained events | Same socket | Local projection committed |
| Different, transport/mode values | Live | Commit and replace session | One new aggregate session | Session accepted or terminal error |
| Different, local filters only | History | Commit and start the confirmed query | Same History generation | Initial query ready or error |
| Different, transport/mode values | History | Commit and create new generation | One new History session | Initial result boundary or error |
| Equal, Repeat Search | Live | Refresh current confirmed request | One new aggregate session | Session accepted or terminal error |
| Equal, Repeat Search | History | Recreate finite snapshot/query | One new History generation | Initial result boundary or error |

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
```

A repeat Live Search must force a new session boundary even when the transport projection is equal;
updating an equal React state object alone is not a sufficient trigger. A repeat History Search must
similarly advance the session/generation identity, because stale windows from the previous snapshot
must never be accepted into the new result.

## Busy and completion contract

The button's busy state represents the main Search operation, not every later virtualized fetch.

- For Live, busy ends when the replacement aggregate session is accepted, or when connection/error
  handling makes that operation terminal. Existing source-level streaming and summary behavior
  remains visible through the connection status.
- For History, busy continues through snapshot preparation until the terminal snapshot status and
  initial confirmed query readiness establish a usable result boundary. Initial window requests may
  have their own loading indicator; later scrolling/window loading must not be confused with Search
  activation.
- For filter-only Live confirmation, no transport busy indicator is needed. The local projection
  commits synchronously from the applied filter snapshot.
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
- `Pause`, retained-event `Clear`, `Group`, and `Wrap lines` remain immediate/presentation actions
  and never become Search operations.
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
- Assert invalid custom ranges preserve the prior applied state and never show busy.
- Assert accessible name, `aria-busy`, status announcement, focus, stable geometry, and responsive
  behavior in idle, pending, and busy states.

### Backend and integration checks

- Reuse existing backend protocol, history, WebSocket, and security suites; add only narrow tests
  for a distinct repeat identity if the current contract requires them.
- Count aggregate Live sessions and History generations under repeated, rapid, failed, and partial
  operations using read-only fixtures or read-only cluster checks.
- Verify stale Live events and History windows cannot cross a repeat boundary.
- Run workspace tests, typechecks, builds, and `git diff --check` after implementation.
- Record unavailable browser, Electron, screen-reader, or cluster checks as limitations rather than
  implementation evidence.
