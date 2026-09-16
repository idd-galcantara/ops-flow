# Requirements - ops-union v1.2.3 log search confirmation

## Scope

This specification refines the v1.2.2 logs workspace interaction model. Search parameters are
edited as a pending draft and are not applied while the user is changing them. A visible
`Search` action applies the draft explicitly. The release preserves the existing aggregate log
transport, bounded retention, local structured filtering, pause behavior, clear behavior, source
scope, and legacy endpoint.

This release does not add a backend search API. The existing aggregate `WS /api/logs` session
remains the transport authority. Period/range and `Follow` affect the subscription; pod,
container, cluster, namespace, and message-text filters remain local predicates over retained
structured events, but are applied only when `Search` is confirmed.

## Glossary

- **Search draft:** The editable values currently shown in the period/range, `Follow`, pod,
  container, cluster, namespace, and text controls. Draft changes are not active search state.
- **Applied search:** The last search draft confirmed through `Search` and used by the workspace.
- **Transport parameters:** Period/range and `Follow`, which determine the aggregate subscription
  and may require a new session when applied values change.
- **Local search parameters:** Pod, container, cluster, namespace, and message-text filters,
  which select retained structured events in the client.
- **Presentation state:** Grouping and `Wrap lines`, which affect rendering only and are not
  search parameters.
- **Immediate controls:** `Pause` and the log-buffer `Clear` action. They act at interaction time
  and are not held in the search draft. `Clear filters` edits the filter draft and therefore still
  requires `Search`.

## Requirements

### LS-1 - Draft and applied search state

1. The workspace SHALL represent one search draft and one applied search state containing period,
   custom range, `Follow`, pod, container, cluster, namespace, and message-text values.
2. WHEN the user changes any search parameter THEN the workspace SHALL update the draft only and
   SHALL leave the applied search, active session, retained events, and session status unchanged.
3. The workspace SHALL indicate when the draft differs from the applied search and SHALL expose a
   visible, keyboard-accessible `Search` control to confirm it.
4. A draft change SHALL NOT open, close, replace, or send a new subscription on the aggregate
   WebSocket before `Search` is activated.
5. The initial workspace state MAY start its initial session using the initial applied values, but
   subsequent edits SHALL require explicit `Search` confirmation.

### LS-2 - Search confirmation and session application

1. WHEN `Search` is activated with a valid draft THEN the workspace SHALL apply all draft values
   atomically, so the range, `Follow`, and local filters cannot be applied from mixed revisions.
2. IF the applied period/range or `Follow` differs from the draft THEN the workspace SHALL close
   the previous aggregate session, clear the prior session's retained event/lifecycle state as
   required by the existing session contract, and start exactly one new `WS /api/logs` session
   with the applied sources and transport parameters.
3. IF only local filters differ THEN `Search` SHALL apply the filters to the retained structured
   events without opening another socket, changing the subscription, or discarding retained
   events.
4. IF no search value differs THEN `Search` SHALL be a no-op for transport and retained events.
5. A new session SHALL preserve v1.2.2 source tuples, limits, timestamps, cancellation, bounded
   retention, source lifecycle, partial-failure handling, and legacy per-pod compatibility.
6. Search confirmation SHALL prevent stale events from a replaced session from being appended to
   the new session, using the existing effect cleanup/active-session boundary.

### LS-3 - Range, Follow, and local filter semantics

1. Period presets and custom `from`/`to` values SHALL remain draft values until `Search` is
   confirmed. Invalid or inverted custom ranges SHALL be rejected without changing the active
   session or applied search.
2. `Follow` SHALL remain a draft transport parameter until `Search`; changing it SHALL not act as
   `Pause`, resume a paused view, or reconnect immediately.
3. After confirmation, pod, container, cluster, namespace, and text filters SHALL use the existing
   AND semantics over retained structured events, with the existing source/value options.
4. Editing a local filter SHALL not change the currently displayed applied results until `Search`
   is confirmed. The filter controls MAY show their draft values and an unsaved indicator.
5. Clearing a local filter through a filter-specific clear affordance SHALL edit the draft. It SHALL
   not be confused with the immediate log-buffer `Clear` action.

### LS-4 - Immediate controls and presentation-only state

1. `Pause` SHALL remain immediate: it SHALL change the current visual/receipt behavior without
   requiring `Search`, opening a socket, or changing the applied search parameters.
2. The log-buffer `Clear` action SHALL remain immediate: it SHALL remove retained events without
   requiring `Search`, opening a socket, or changing the applied search parameters.
3. Grouping SHALL remain a presentation-only choice over the same retained event collection. It
   SHALL update immediately and SHALL not restart the session, clear events, or alter the
   subscription.
4. `Wrap lines` SHALL remain a presentation-only choice. It SHALL update row rendering and any
   required virtualization measurements immediately, without restarting the session, clearing
   events, or altering the subscription.
5. Grouping and `Wrap lines` SHALL not be included in the search draft, applied search, or Search
   subscription payload.

### LS-5 - UI, validation, and accessibility contract

1. The toolbar SHALL label the `Search` action clearly and SHALL expose its current pending/applied
   state through visible text and accessible state.
2. WHEN `Search` is activated with invalid range input THEN the workspace SHALL show a safe,
   actionable validation error and SHALL retain the previous applied search and session.
3. While a transport-affecting search is being applied, the workspace SHALL expose connecting or
   validating status and SHALL prevent duplicate concurrent Search submissions from creating more
   than one replacement session.
4. The UI SHALL preserve keyboard navigation, visible focus, accessible names, live status
   announcements, and usable controls at narrow widths and high zoom.
5. The workspace SHALL keep `Pause`, log-buffer `Clear`, grouping, and `Wrap lines` visually and
   behaviorally distinct from the deferred `Search` action.

### RA-1 - Regression and safety boundaries

1. Existing v1.2.2 source selection, one aggregate socket per active transport session, limits,
   timestamps, cancellation, partial failures, safe errors, virtualization, and legacy endpoint
   behavior SHALL remain covered by focused regression tests.
2. Search confirmation SHALL not broaden selected source scope, alter source tuple identity, add
   Kubernetes permissions, or introduce a mutation path.
3. No raw Kubernetes response body, headers, credentials, or kubeconfig data SHALL be rendered as
   part of search validation or session errors.

### IQ-1 - Integration acceptance gate

1. Read-only validation SHALL prove that changing each search parameter individually does not
   reconnect or alter active results before `Search`.
2. Validation SHALL prove that one confirmed range/`Follow` change creates one replacement
   aggregate session, while filter-only confirmation remains local and preserves retained events.
3. Validation SHALL prove that `Pause`, log-buffer `Clear`, grouping, and `Wrap lines` retain their
   immediate/current behavior and do not create a replacement session.
4. Validation SHALL cover valid and invalid custom ranges, rapid draft edits, duplicate Search
   activation, partial source failure, limits, cancellation, narrow layout, and keyboard/accessibility
   smoke where the environment supports it.

## Definition of done

- Search parameters are staged in a draft and only applied by the `Search` action.
- Period/range and `Follow` changes restart exactly one aggregate session only after confirmation.
- Pod, container, cluster, namespace, and text filters wait for confirmation and then filter
  retained events locally without reopening the socket.
- `Pause` and log-buffer `Clear` remain immediate.
- Grouping and `Wrap lines` remain presentation-only, immediate, and excluded from session
  restart logic and subscription payloads.
- Existing v1.2.2 source scope, transport, limits, errors, virtualization, accessibility, and
  legacy behavior remain intact and are covered by named-owner validation.
- This specification changes no product source code, does not alter earlier specification history,
  and does not authorize commit, packaging, or release publication.