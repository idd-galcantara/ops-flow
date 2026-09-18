# Requirements - ops-union v1.3.1 repeatable log search

## Scope

Version 1.3.1 refines the logs workspace `Search` action so it remains explicitly repeatable after
an applied search. The action is available whenever the workspace is idle, even when the draft and
applied search values are equal. A click with pending draft changes continues to confirm those
changes; a click without pending changes becomes an explicit repeat/refresh request.

The change preserves the v1.2.3 draft/applied confirmation boundary, the v1.3.0 Live/History
contracts, local filter semantics, bounded retention, source scope, and read-only Kubernetes
behavior. It does not add a separate backend search API, expose filesystem state, or authorize
Kubernetes mutation.

## User stories

- As a logs user, I can repeat Search with the same filters and range after the previous operation
  completes.
- As a logs user, I can refresh a relative Live range such as "Last 5 minutes" without editing a
  control first.
- As a logs user, I can see that Search is busy while the requested operation is in progress and
  know when it is available again.
- As a logs user, I can continue editing a new draft while an operation is in progress without
  accidentally applying that newer draft to the operation already running.
- As a platform operator, I can rely on the existing one-session, bounded, safe, and read-only
  log contracts.

## Glossary

- **Search draft:** The editable period, range, Follow, mode, and local filter values.
- **Applied search:** The last confirmed Search values used by the workspace.
- **Pending search:** A draft that differs from the applied search.
- **Repeat Search:** An explicit Search activation when the draft equals the applied search. It is
  a meaningful refresh request, not a no-op.
- **Search operation:** The transport or query work started by a Search activation and tracked by
  the busy state until its defined completion or failure.
- **Transport values:** Mode, period, custom range, and Follow values that determine a session or
  history generation.
- **Local filters:** Pod, container, cluster, namespace, and message-text predicates over the
  retained Live events or the confirmed History query.

## Requirements

### RS-1 - Repeatable Search action

1. The workspace SHALL keep the `Search` control enabled whenever no Search operation is active,
   regardless of whether the draft differs from the applied search.
2. WHEN the draft differs from the applied search and the draft is valid THEN activating `Search`
   SHALL retain the existing atomic draft-to-applied confirmation behavior.
3. WHEN the draft equals the applied search THEN activating `Search` SHALL start one explicit
   Repeat Search operation and SHALL NOT be treated as a no-op.
4. A Repeat Search in Live mode SHALL start exactly one replacement aggregate session for the
   confirmed sources and transport values. Relative ranges SHALL be resolved at activation time,
   so a repeated "last N minutes" search refreshes its time window.
5. A Repeat Search in History mode SHALL create exactly one new history session generation for the
   confirmed sources and range, even when mode, range, and filters are unchanged.
6. A Repeat Search SHALL preserve the current applied local filters and presentation state while
   the refreshed session or query is established.
7. Search SHALL remain unavailable only while the current Search operation is active, not merely
   because no draft changes are pending.

### RS-2 - Draft, applied, and operation boundaries

1. The existing draft/applied distinction SHALL remain authoritative for edits to mode, period,
   custom range, Follow, and local filters.
2. A Search operation SHALL capture one coherent request snapshot at activation. Draft edits made
   while that operation is busy SHALL not alter the request already in progress.
3. A pending transport change SHALL replace the active Live session or History generation exactly
   once when Search is confirmed.
4. A pending local-filter-only change SHALL apply the filters using the existing local or History
   query behavior and SHALL not open an additional Live socket or widen source scope.
5. A Repeat Search with no pending changes SHALL refresh the transport/session boundary as defined
   in RS-1, rather than silently only re-evaluating the current rendered rows.
6. Invalid custom range input SHALL leave the previous applied search and active session intact;
   it SHALL not enter a busy state and SHALL expose the existing safe validation feedback.
7. A failed, cancelled, closed, or superseded operation SHALL clear the busy state according to
   its existing safe error/transition behavior and SHALL leave the user able to initiate a new
   Search when no replacement operation remains active.

### RS-3 - Busy state and completion semantics

1. While a Search operation is active, the `Search` control SHALL expose a visible loading state,
   an accessible busy state, and a status announcement identifying that Search is in progress.
2. The busy control SHALL prevent duplicate concurrent Search submissions from creating more than
   one replacement session or History generation.
3. In Live mode, the Search operation SHALL remain busy until the replacement aggregate session is
   accepted, or until a terminal connection/error outcome makes the operation no longer active.
4. In History mode, the Search operation SHALL remain busy until the new generation reaches a
   usable initial result boundary: the history capture has emitted its terminal status and the
   initial confirmed query is ready, or a failure/cancellation outcome ends the operation.
   Subsequent virtualized window loading SHALL use its existing independent loading state.
5. A local-filter-only confirmation SHALL complete its Search operation after the applied filter
   state is committed and the existing local result projection is updated; it SHALL not show a
   transport loading state.
6. When the operation reaches its defined completion or failure outcome, the Search control SHALL
   return to its idle, enabled state even if the draft has no pending changes.
7. The busy state SHALL not prevent the workspace from reporting partial results, safe errors,
   limits, History expiry, or the existing connection status.

### RS-4 - Interaction and accessibility contract

1. The Search button SHALL retain its primary action hierarchy, clear label, keyboard activation,
   visible focus, and stable dimensions in idle, pending, busy, success, partial, and error states.
2. Busy presentation MAY replace the search icon with the existing icon library's loading icon or
   animate the icon, but it SHALL not cause surrounding controls to shift or the button label to
   become ambiguous.
3. The workspace SHALL announce the distinction between pending draft changes, an active Search
   operation, and an applied/ready state through the existing status region without exposing raw
   Kubernetes response data.
4. A user SHALL be able to edit draft controls while Search is busy. Those edits SHALL remain
   pending for a later Search activation and SHALL not create a second concurrent operation.
5. Keyboard and pointer activation of an idle Search with unchanged values SHALL perform the same
   repeat operation as an activation with equivalent values from another input method.
6. The action SHALL remain usable at supported desktop, tablet, mobile, and high-zoom widths
   without overlap or page-level horizontal overflow.

### RS-5 - Compatibility and read-only boundaries

1. Existing v1.2.3 draft confirmation, filter AND semantics, `Pause`, retained-event `Clear`,
   `Group`, and `Wrap lines` behavior SHALL remain unchanged.
2. Existing v1.3.0 Live/History source identity, limits, timestamps, cancellation, partial
   failures, virtualized windows, stale-generation rejection, and History-to-Live boundaries SHALL
   remain intact.
3. Repeated Search SHALL use the existing aggregate log transport and History protocol boundaries;
   no raw filesystem path, snapshot file, credential, kubeconfig value, or Kubernetes response body
   SHALL reach the renderer or accessibility content.
4. The change SHALL not add Kubernetes mutation, arbitrary command execution, elevated permission,
   authentication bypass, or a new source-selection path.
5. A repeated Search SHALL preserve the selected source tuples exactly and SHALL not broaden the
   confirmed cluster, namespace, pod, or container scope.

### RA-1 - Regression and safety boundaries

1. The implementation SHALL cover both a same-value Repeat Search and a pending-change Search in
   Live and History modes.
2. Tests SHALL prove that one idle activation creates one new operation, while rapid duplicate
   activation during busy creates no second operation.
3. Tests SHALL prove that draft edits during busy remain pending and are applied only by a later
   Search activation.
4. Existing backend protocol and security tests SHALL remain green; a backend code change is not
   required unless the current generation/session contract cannot express the repeat boundary.
5. This specification SHALL not authorize source-code implementation, commit, packaging, release,
   or completion of implementation without recorded evidence.

### IQ-1 - Integration acceptance gate

1. Read-only validation SHALL exercise Search with unchanged values after an initial Live result,
   confirm one replacement session, and verify that a relative range is refreshed at activation.
2. Validation SHALL exercise same-value Repeat Search in History mode and verify one new generation,
   no stale-window mixing, and an enabled Search after the initial result boundary is ready.
3. Validation SHALL cover pending filter-only Search, pending transport Search, invalid custom
   ranges, partial/error outcomes, rapid repeated activation, and draft edits during busy.
4. Validation SHALL verify keyboard focus, accessible busy/status state, stable button geometry, and
   responsive behavior at supported narrow and high-zoom layouts.
5. Kubernetes and desktop validation SHALL remain read-only; no mutation, packaging, publishing,
   or release action is part of this acceptance gate.

## Definition of done

- Search remains enabled after an applied search and can explicitly repeat the same request.
- Live Repeat Search refreshes relative ranges and creates exactly one replacement session.
- History Repeat Search creates exactly one new generation without mixing stale results.
- The button shows loading only during the active Search operation and returns to enabled idle state
  after the defined completion or failure boundary.
- Draft edits, local filter behavior, presentation controls, source scope, read-only boundaries,
  and v1.3.0 History semantics remain intact.
- Focused frontend tests, typecheck/build checks, and documented read-only integration/accessibility
  evidence are recorded by the named owners.
- This specification changes no product source code, does not alter earlier specification history,
  and does not authorize commit, packaging, or release publication.
