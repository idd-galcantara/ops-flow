# Requirements - ops-union v1.2.1 application-oriented log source modal

## Scope

This specification replaces the confusing manual log-source selection flow with an
application-oriented source-selection modal. It extends the v1.2.0 structured log session
without introducing a second transport, changing the existing aggregated WebSocket contract, or
adding Kubernetes mutations.

The modal organizes eligible sources as `application > cluster/namespace > pod > container`. When
logs are opened for an application, the default selection includes every matching pod in the
explicitly selected target contexts and selects primary containers by default. Sidecars such as
`istio-proxy` and `envoy` remain available but are opt-in. The details/sidebar stays a compact
summary, while the viewer exposes structured source filters.

## Glossary

- **Application identity:** The normalized identity from v1.2.0 used to group pods. It is a
  grouping value, not an authorization scope.
- **Target context:** One explicit `(cluster, namespace)` pair. Context is always visible when a
  source is selected or rendered.
- **Source:** One `(cluster, namespace, pod, container)` tuple sent to the existing aggregate log
  session.
- **Primary container:** A container classified as application-serving by the available pod
  metadata and not identified as an injected or infrastructure sidecar.
- **Sidecar:** A non-primary container, including known proxy, telemetry, logging, or service-mesh
  containers such as `istio-proxy` and `envoy`.
- **Selection summary:** The compact count and context representation shown outside the modal.

## Requirements

### Requirement 1 - Open logs through an application-oriented modal

1. WHEN the user opens logs from an application, pod, or application-group action THEN the UI
   SHALL open the source-selection modal before creating a log session.
2. The modal SHALL present sources in the hierarchy `application > cluster/namespace > pod >
   container` and SHALL expose expand/collapse and selection state at each selectable level.
3. WHEN the modal is cancelled or closed without confirmation THEN the UI SHALL discard pending
   selection changes and SHALL not open a WebSocket.
4. WHEN the user confirms a non-empty selection THEN the UI SHALL close the modal and start the
   existing aggregate log session with exactly the confirmed source tuples.
5. The modal SHALL show selected counts and an actionable empty-selection state; confirmation SHALL
   be disabled or rejected when no valid source is selected.

### Requirement 2 - Select all matching application pods within explicit targets

1. WHEN logs are opened for an application THEN the UI SHALL identify matching pods using the
   normalized application identity key, not only the display name.
2. The default selection SHALL include every matching pod in the currently explicit target context
   or contexts and SHALL include no pod from an unselected cluster/namespace context.
3. IF matching pods exist in additional cluster/namespace contexts THEN the modal SHALL show those
   contexts with their cluster and namespace visible and SHALL require an explicit user action
   before adding their sources.
4. The UI SHALL preserve cluster and namespace on every source tuple even when application names
   and pod names repeat across contexts.
5. Selecting an application or context SHALL select only the descendants currently visible in that
   application/context group; it SHALL not broaden authorization or query unrelated namespaces.
6. IF a pod does not have a normalized application identity matching the opened application THEN it
   SHALL not be silently included, even if its name is similar.

### Requirement 3 - Default primary containers and optional sidecars

1. WHEN a pod is loaded into the modal THEN the UI SHALL classify its containers using available
   normalized metadata and known sidecar indicators, including common injected names such as
   `istio-proxy` and `envoy`.
2. The default selection SHALL include all containers classified as primary and SHALL leave
   sidecars unselected while keeping them visible and selectable.
3. A user SHALL be able to select or clear individual containers and to select or clear all
   containers within a pod or context.
4. IF a pod has no container classified as primary THEN the UI SHALL keep the pod actionable by
   selecting its available containers by default and SHALL make that fallback visible in the
   selection state.
5. Container classification SHALL be a selection convenience only. It SHALL never hide a
   container, prevent explicit sidecar selection, or change the source tuple sent to the server.
6. The selected source model SHALL retain container name and role metadata for display, while the
   authoritative source identity remains the `(cluster, namespace, pod, container)` tuple.

### Requirement 4 - Keep context visible and prevent accidental mixing

1. The modal SHALL display cluster and namespace on every context group and SHALL display the
   selected context set before confirmation.
2. WHEN the same application identity is present in multiple clusters or namespaces THEN the UI
   SHALL keep those contexts visibly separated and SHALL not auto-select them merely because their
   application display names match.
3. Adding an additional cluster/namespace context SHALL be an explicit selection action and SHALL
   update the selection summary before confirmation.
4. The details/sidebar outside the modal SHALL show the application identity, selected context
   names, selected pod/container counts, and whether sidecars are included; it SHALL not reproduce
   the full source tree.
5. The viewer and its source metadata SHALL preserve cluster, namespace, pod, and container labels
   for every event, including events from explicitly selected multiple contexts.

### Requirement 5 - Reuse one aggregated log session

1. WHEN a selection is confirmed THEN the frontend SHALL send all selected source tuples in one
   subscription to the existing `WS /api/logs` session.
2. The modal SHALL not open one connection per pod, container, cluster, or namespace.
3. WHEN the selected sources, application, range, or follow mode changes after a session exists THEN
   the frontend SHALL close or replace the existing session using the v1.2.0 lifecycle rules and
   SHALL not leave an orphaned source stream.
4. Application grouping and modal selection SHALL be client-side selection views over the same
   source contract; they SHALL not require a second log transport.
5. IF a source fails after confirmation THEN the UI SHALL preserve successful sources and show the
   failed source with its visible context in the existing partial-failure state.

### Requirement 6 - Filter the viewer without changing the session

1. The log viewer SHALL provide filters for pod, container, cluster, namespace, and free-text log
   content.
2. Each structured filter SHALL offer only values represented by the selected or received sources;
   an unset filter SHALL impose no constraint.
3. WHEN multiple filters are set THEN the viewer SHALL apply them with AND semantics, and text
   matching SHALL be case-insensitive against the log message.
4. Filtering SHALL run against structured event fields before virtualization and SHALL not open,
   close, or modify the WebSocket subscription.
5. The viewer SHALL show a clear no-results state distinct from no logs received and SHALL provide
   a way to clear individual filters and all filters.
6. Filter controls and result counts SHALL retain visible cluster/namespace context so equal pod or
   container names are not ambiguous.

### Requirement 7 - Handle discovery, stale, and empty states safely

1. WHILE application or pod data is loading THEN the modal SHALL expose a loading state and SHALL
   not present an apparently complete selection as final.
2. IF a context, pod, or container cannot be discovered THEN the modal SHALL show a scoped,
   actionable message while retaining valid discovered groups where possible.
3. IF all eligible sources disappear or become stale before confirmation THEN the UI SHALL prevent
   the session and require a refresh or new selection.
4. The UI SHALL never silently substitute a different cluster, namespace, pod, or container for a
   missing source.
5. Source discovery and selection failures SHALL use safe user-facing messages and SHALL not expose
   kubeconfig data, raw Kubernetes response bodies, or credentials.

### Requirement 8 - Preserve read-only and compatibility boundaries

1. All source discovery and log operations SHALL remain read-only Kubernetes list/get/log
   operations; this feature SHALL add no restart, scale, exec, delete, apply, patch, or other
   mutation.
2. The v1.2.0 aggregate structured event contract, limits, timestamps, cancellation, and legacy
   per-pod compatibility path SHALL remain supported.
3. The modal, summary, and viewer SHALL remain usable at narrow widths with keyboard navigation,
   visible focus, accessible names, and no overlapping controls or source metadata.
4. Selection state SHALL be bounded to the visible application/source inventory and SHALL not retain
   log payloads or kubeconfig data after the details/log surface is closed.

## Definition of done

- Opening application logs routes through a selectable hierarchy of application, explicit
  cluster/namespace context, pod, and container.
- Matching pods in selected contexts are included by default; unselected contexts are visible but
  never silently mixed into the session.
- Primary containers are selected by default, sidecars remain visible and opt-in, and the
  sidecar-only fallback is clear.
- Confirmation creates exactly one existing aggregate WebSocket session with the selected tuples.
- The sidebar/details surface shows a compact context-aware summary rather than a duplicate tree.
- The viewer filters by pod, container, cluster, namespace, and text before virtualization.
- Loading, empty, stale, partial-failure, responsive, accessibility, and read-only boundaries are
  covered by focused tests and validation scenarios.
- No previous specification history is rewritten and implementation remains a separate follow-up.
