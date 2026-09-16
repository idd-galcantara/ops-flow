# Requirements - ops-union v1.2.2 logs workspace and source scope

## Scope

This specification refines the v1.2.1 application-oriented log source flow into a predictable
source scope and a dedicated logs workspace. It changes frontend selection defaults and log
presentation without changing the aggregate log transport, Kubernetes access scope, or read-only
boundary.

The default source set is every primary container for every pod with the opened
`application.key` in every cluster/namespace context explicitly consulted by the current query.
Sidecars remain available but are controlled by global or context-level actions. The source modal
starts with a compact scope summary and keeps pod/container details behind secondary expansion.
After confirmation, logs occupy the main workspace with fixed filters and a compact context header.

This release depends on the normalized application identity, source inventory, aggregate
`WS /api/logs` session, limits, partial-failure behavior, virtualization, and legacy endpoint from
v1.2.0 and the application-oriented selection flow from v1.2.1.

## Glossary

- **Application key:** The normalized, stable grouping key from v1.2.0/v1.2.1. Display names do
  not substitute for this key.
- **Explicitly consulted context:** A `(cluster, namespace)` pair included in the current source
  inventory request or explicitly selected target set. A context merely discovered elsewhere is
  not consulted for default selection.
- **Primary container:** A container classified as application-serving by existing normalized
  metadata and sidecar indicators.
- **Sidecar:** A visible, non-primary container such as `istio-proxy`, `envoy`, telemetry, logging,
  or infrastructure agents.
- **Scope summary:** The compact application, context, pod, and container selection summary shown
  before source details in the modal and in the workspace header.
- **Logs workspace:** The main-area log surface containing the session header, fixed filters, and
  virtualized output; it is not a narrow details-panel viewer.

## Requirements

### SS-1 - Default source scope across explicitly consulted contexts

1. WHEN the user opens logs for an application THEN the UI SHALL match pods by the normalized
   `application.key`, never by display name alone.
2. WHEN a pod matches the application key and belongs to an explicitly consulted cluster/namespace
   context THEN the default selection SHALL include all of that pod's primary containers.
3. The default SHALL include matching pods from every explicitly consulted context in the current
   inventory, while preserving cluster and namespace on every selected source tuple.
4. The default SHALL include no source from a context that was not explicitly consulted, even when
   its application display name or key appears elsewhere in the session.
5. IF a matching pod has no primary container THEN the UI SHALL select its available containers as
   a visible sidecar-only fallback and SHALL identify that exception in the scope summary and pod
   detail state.
6. IF discovery is partial, loading, stale, or empty THEN the UI SHALL not present an incomplete
   inventory as a final default and SHALL require refresh or an explicit valid selection before
   opening a session.

### SS-2 - Sidecar defaults and bulk actions

1. Sidecars, including `istio-proxy` and `envoy`, SHALL remain visible and unselected by default
   when a pod has at least one primary container.
2. The modal SHALL provide an explicit global action to include or exclude all sidecars in the
   current application scope and a contextual action to include or exclude sidecars in one
   cluster/namespace context.
3. Bulk sidecar actions SHALL update all eligible descendants in their scope and SHALL not require
   the user to repeat the action pod by pod.
4. The UI MAY expose individual container overrides, but no individual override SHALL hide a
   sidecar, alter its source identity, or broaden the consulted context set.
5. A pod containing only sidecars SHALL remain actionable through the defined fallback; the UI
   SHALL explain why its available containers are selected despite the normal sidecar default.
6. The confirmed source payload SHALL contain only explicit
   `(cluster, namespace, pod, container)` tuples and SHALL preserve the existing role metadata only
   as presentation data.

### CM-1 - Compact source-selection modal

1. WHEN the source modal opens THEN its first visible region SHALL show application identity,
   consulted-context count/names, selected pod/container counts, primary/sidecar counts, and
   discovery or stale-state indicators.
2. The modal SHALL keep pod and container details behind a secondary expandable region or view;
   the compact scope summary SHALL remain usable without opening the full tree.
3. Context details SHALL remain visibly separated by cluster and namespace when names or pods are
   repeated across contexts.
4. Global and contextual selection actions SHALL expose current state, affected scope, and result
   counts before confirmation.
5. Confirmation SHALL be disabled or rejected when no valid source is selected, when inventory is
   loading, or when selected sources are stale; cancellation SHALL discard pending changes.
6. The modal SHALL not open a second log transport and SHALL not start a session before a valid
   confirmation.

### LW-1 - Dedicated logs workspace

1. WHEN a source selection is confirmed THEN logs SHALL render in a dedicated main-area workspace
   that can use the primary available width and height, rather than a narrow details panel.
2. The workspace header SHALL compactly show application identity, consulted/selected contexts,
   selected source counts, session status, and partial-failure indicators.
3. The workspace SHALL keep filters fixed and available while output scrolls; filters SHALL include
   cluster, namespace, pod, container, and local message text as supported by v1.2.1.
4. The workspace SHALL remove the long confirmed-source list from the primary view. Source identity
   and failures SHALL remain available through compact metadata, filter values, status summaries,
   or an accessible secondary inspection surface.
5. Local filter changes SHALL operate on retained structured events and SHALL not create, close,
   replace, or modify the active WebSocket subscription.
6. The workspace SHALL retain pause/follow, clear, jump-to-latest, limits, time-range, empty,
   no-results, partial-failure, and terminal session states from v1.2.0/v1.2.1.

### LW-2 - Transport and compatibility preservation

1. A confirmed selection SHALL use exactly one `WS /api/logs` connection and one subscription for
   the selected sources.
2. The frontend SHALL preserve bounded retention, server/client limits, timestamps, source
   lifecycle, cancellation, virtualization, and source-scoped partial failures.
3. The legacy per-pod log endpoint SHALL remain supported with its existing contract.
4. The application/source workspace SHALL remain read-only and SHALL not add Kubernetes mutation,
   arbitrary query, authentication, or kubeconfig persistence behavior.
5. Changing local filters, wrap mode, or display density SHALL not affect source scope, limits, or
   the server subscription.

### RW-1 - Predictable line rendering and wrapping

1. Log lines SHALL render without wrapping by default, with horizontal scrolling available for
   long messages.
2. A visible `Wrap lines` control SHALL toggle wrapping for the rendered message column only and
   SHALL not change the retained event data or the server subscription.
3. Enabling wrapping SHALL allow row height to grow according to content; it SHALL not impose an
   incorrect fixed height that clips or overlaps wrapped text.
4. Disabling wrapping SHALL restore stable single-line row sizing and horizontal scroll behavior
   without losing the user's vertical position unexpectedly.
5. Virtualization SHALL measure or estimate wrapped rows consistently enough to keep visible text,
   keyboard focus, auto-scroll, and jump-to-latest usable.

### RW-2 - Stable metadata and legible messages

1. Each rendered row SHALL keep timestamp, context/source metadata, and message in stable columns
   or grid tracks so long values do not mix into adjacent metadata.
2. Cluster, namespace, pod, and container labels SHALL remain distinguishable when equal names are
   present in multiple contexts.
3. Metadata SHALL truncate or scroll within its own bounded area, while the message remains
   readable and selectable.
4. Empty, whitespace-only, multiline, very long, timestamp-null, and error messages SHALL have
   legible accessible presentation without exposing raw Kubernetes response content.
5. The row layout SHALL not overlap controls, metadata, messages, or status indicators at desktop,
   tablet, or narrow widths.

### RA-1 - Regression and safety boundaries

1. Existing v1.2.0/v1.2.1 source selection, one-socket behavior, limits, timestamps, cancellation,
   partial failures, application identity, and legacy endpoint behavior SHALL remain covered by
   focused regression tests.
2. The default-scope change SHALL not silently add contexts outside the explicitly consulted set
   and SHALL not remove context identity from the wire payload or rendered events.
3. The implementation SHALL retain safe user-facing errors and SHALL not render kubeconfig data,
   credentials, raw Kubernetes response bodies, or response headers.
4. All Kubernetes operations involved in this feature SHALL remain read-only list/get/log or
   equivalent existing read paths.

### RA-2 - Responsive and accessible interaction

1. The modal and workspace SHALL support keyboard navigation, visible focus, accessible names,
   logical reading order, and an accessible state announcement for loading, stale, empty, partial,
   no-results, and terminal states.
2. Scope summary, expansion controls, global/contextual sidecar actions, filters, wrap control,
   pause/follow, clear, and jump-to-latest SHALL expose their current state and action to assistive
   technology.
3. Responsive layouts SHALL keep controls reachable and text readable without horizontal page
   overflow or overlapping UI; line-level horizontal scroll SHALL remain available where needed.
4. The UI SHALL preserve safe behavior when reduced motion, high zoom, or a narrow viewport is
   active.

### IQ-1 - Integration acceptance gate

1. Read-only integration validation SHALL cover one application across one and multiple explicitly
   consulted contexts, repeated pod/container names, primary plus sidecar pods, and sidecar-only
   pods.
2. Validation SHALL prove default source tuples, global/contextual sidecar actions, one aggregate
   WebSocket, local-only filters/wrap changes, partial source failure, limits, cancellation, and
   legacy endpoint compatibility.
3. Validation SHALL include desktop and narrow responsive scenarios plus keyboard/accessibility
   smoke coverage when the environment supports it.
4. No integration scenario SHALL mutate Kubernetes resources, persist kubeconfig secrets, or mark
   implementation tasks complete without recorded evidence.

## Definition of done

- All matching primary containers for the application are selected by default across every
  explicitly consulted context, with no silent expansion beyond that set.
- Sidecars remain visible and opt-in through global/contextual actions, and sidecar-only pods have
  a clear actionable fallback.
- The modal presents a compact scope summary first and defers pod/container detail expansion.
- Confirmed logs occupy a dedicated main workspace with a compact header, fixed filters, and no
  long primary source list.
- Lines are no-wrap by default with horizontal scrolling; `Wrap lines` works with correct dynamic
  row sizing, stable metadata columns, and readable messages.
- One aggregate WebSocket, local filters, limits, virtualization, partial failures, the legacy
  endpoint, read-only behavior, responsiveness, and accessibility remain intact.
- Focused frontend tests, any necessary backend regression tests, typechecks/builds, and documented
  read-only integration/accessibility validation are recorded by the named owners.
- This specification does not implement source code, change earlier specification history, commit
  changes, or perform release publication.
