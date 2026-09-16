# Design - ops-union v1.2.2 logs workspace and source scope

## Overview

Version 1.2.2 is a frontend refinement of the v1.2.1 application log flow. It changes how the
current inventory becomes a pending selection and how the confirmed session is laid out, while
reusing the v1.2.0 aggregate structured log session. The backend remains the authority for source
access, limits, timestamp semantics, lifecycle, safe errors, and the legacy compatibility path.

The controlling scope rule is explicit: `consultedContexts` is the set of cluster/namespace
pairs used by the current inventory query or target selection. The opened application key is
matched inside that set. Primary containers in all matching pods across that set are selected by
default. A context merely present in some broader discovery result is not part of the default set
until it is explicitly consulted.

## Ownership boundaries

- `frontend/src` owns consulted-context state, default selection, sidecar bulk actions, compact
  modal state, workspace layout, local filters, wrap mode, and responsive/accessibility behavior.
- Existing normalized application identity and source inventory models remain authoritative for
  `application.key`, cluster, namespace, pod, container, and container-role metadata.
- The source-selection model owns exact tuple normalization and reconciliation against inventory;
  it does not authorize a context or invent a replacement source.
- The existing log-session owner continues to own exactly one `WS /api/logs`, subscription
  serialization, limits, timestamps, cancellation, bounded retention, source lifecycle, and
  partial failures.
- The logs workspace owns presentation only. Filter and wrap state are local view state and never
  feed back into the confirmed source payload or WebSocket.
- `@ops-union-backend` is involved only if implementation discovers that the existing normalized
  inventory or aggregate contract cannot provide the metadata required by this design. No backend
  feature is planned by default.
- `@ops-union-integration-qa` owns read-only integration, regression, packaging/build, security,
  responsive, and accessibility validation evidence.

## Source scope and selection model

The inventory snapshot is interpreted with an explicit context boundary:

```ts
interface ConsultedContext {
  cluster: string;
  namespace: string;
}

interface ApplicationSourceScope {
  application: ApplicationIdentity;
  consultedContexts: ConsultedContext[];
  inventory: ApplicationLogInventory;
  pendingSources: Set<string>; // exact cluster/namespace/pod/container tuple key
  sidecarPolicy: 'exclude' | 'include-all' | 'include-by-context';
}
```

The existing `ApplicationLogInventory` and `LogSourceSelection` models from v1.2.1 remain the
source of pod and container metadata. `consultedContexts` is normalized by exact cluster and
namespace values. Matching uses `application.key` plus exact context membership; display names are
never used to merge contexts.

Default construction is deterministic:

1. retain inventory groups whose context is in `consultedContexts` and whose pod application key
   equals the opened key;
2. select every primary container in each matching pod;
3. if a matching pod has no primary container, select its available containers and mark the
   pod-level `sidecarOnlyFallback` state;
4. keep sidecars in the inventory but unselected for pods that have a primary/unknown application
   container;
5. de-duplicate only exact source tuples and retain context/role metadata for presentation.

A partial inventory is not silently treated as complete. The summary exposes loading, stale, and
missing-context state, and confirmation requires the current source set to be valid.

## Sidecar actions and state transitions

The modal exposes two levels of bulk sidecar action:

- **Application scope:** include or exclude all sidecars under the opened application and consulted
  contexts.
- **Context scope:** include or exclude sidecars under one selected cluster/namespace context.

The effective selection is the union of primary defaults, sidecar bulk actions, and optional
individual overrides. A context action cannot reach a non-consulted context. A pod-only-sidecar
fallback is an explicit exception to the normal sidecar default: those available containers are
selected so the pod remains useful, and the summary explains the exception.

The modal state is:

```text
closed
  -> loading-scope
  -> scope-ready
  -> details-expanded
  -> editing-sidecars
  -> validating
  -> confirmed -> workspace-started

loading-scope -> partial-or-stale
scope-ready/details-expanded/editing-sidecars -> cancelled -> closed
scope-ready/details-expanded/editing-sidecars -> empty-or-invalid -> editing-sidecars
```

Opening snapshots the application key and consulted contexts. Inventory refresh reconciles pending
sources by exact tuple. Sources removed from the current inventory are cleared and surfaced as
stale. Confirmation validates non-empty, current tuples once more, then hands one normalized list
to the existing session owner. Cancellation discards pending changes and does not open a socket.

## Compact modal contract

The modal's first viewport is a scope summary, not the full tree. It contains:

- application identity and identity source;
- consulted context names and context count;
- selected/available pod and container counts;
- primary, sidecar, and sidecar-only-fallback counts;
- loading, partial, stale, and empty status;
- application-level sidecar action and confirmation/cancellation controls.

A secondary `Review pod and container details` disclosure renders the existing context/pod/container
hierarchy. The hierarchy preserves cluster and namespace headings, repeated names, individual
selection overrides, and accessible expansion state. The summary remains visible while details are
expanded. No source connection is created by modal rendering or expansion.

## Dedicated logs workspace

After confirmation, the route/surface changes from the source-selection/details presentation to a
main-area logs workspace. The workspace layout is:

```text
Logs workspace
  compact context/session header
  fixed filter and display toolbar
  virtualized structured output
  status/footer region for limits, partial failures, and terminal state
```

The header shows application identity, selected context chips or compact labels, selected pod and
container counts, sidecar inclusion state, time range, and session status. It does not render the
confirmed source inventory as a long list. A compact status or secondary inspection affordance may
show source errors and exact identities when diagnosis requires them.

Filters remain fixed while the output region scrolls. Cluster, namespace, pod, container, and text
filters are derived from retained structured events/selected sources, use the existing AND
semantics, and run before virtualization. No filter or display control changes the source session.
The workspace keeps the v1.2.0/v1.2.1 pause/follow, clear, jump-to-latest, effective-limit,
no-events, no-results, partial, and terminal states.

## Rendering and wrap contract

The output is a horizontally scrollable structured grid by default:

```text
[timestamp] [cluster / namespace] [pod] [container] [message]
```

Metadata columns have stable minimum/max widths and overflow handling. The message column owns its
horizontal overflow; metadata is not allowed to blend into message text. Long metadata is
truncated with an accessible full-value path or can be inspected without widening the page.

`Wrap lines` is a local presentation toggle. In no-wrap mode, each row uses a stable single-line
height and the output viewport supplies horizontal scrolling. In wrap mode, the message cell uses
normal wrapping and the virtualization strategy measures or estimates the resulting row height;
there is no fixed row height that clips wrapped content. Toggling modes preserves structured
content and keeps focus/scroll behavior predictable. Empty and whitespace messages retain a visible
row shape, while multiline messages remain readable and selectable.

Virtualization continues to use stable `(sourceId, sequence)` keys and filters before the virtual
window. Any row measurement cache is keyed or invalidated by wrap mode and relevant content so a
mode change cannot leave stale heights.

## Transport, compatibility, and error behavior

The workspace calls the existing session owner with the confirmed source tuples. The session opens
one aggregate `WS /api/logs`, sends one subscription, and keeps the existing range, follow, line
and byte budgets, source lifecycle, cancellation, bounded retention, and partial-failure handling.
Local filter/wrap changes do not restart it. The legacy per-pod endpoint remains untouched.

Source discovery and rendering errors reuse safe user-facing formatting. A missing context, stale
source, or partial source failure is scoped and actionable; raw Kubernetes response bodies,
headers, kubeconfig fields, and credentials never enter UI state. A missing source is never
replaced by a same-named source from another context.

No Kubernetes mutation or new authorization scope is introduced. The only conditional backend work
is a compatibility correction if the existing response contract lacks a required normalized field;
that work must preserve the v1.2.0/v1.2.1 wire behavior and be separately tested.

## Validation strategy

### Frontend unit/component tests

- Build defaults from all matching pods in all consulted contexts and exclude non-consulted
  contexts, including repeated application/pod/container names.
- Verify primary defaults, sidecar exclusion, application/context sidecar actions, individual
  overrides, and the sidecar-only fallback explanation.
- Verify compact-first modal rendering, secondary detail expansion, cancellation, stale/partial
  states, and confirmation guards.
- Verify main-area workspace composition, fixed filters, compact header, removed long source list,
  local filter/wrap state, and preservation of one session.
- Verify no-wrap horizontal scrolling, wrapped dynamic heights, mode changes, stable metadata
  columns, long/empty/multiline messages, and virtualization keys.
- Verify accessible names, keyboard focus/order, live status states, high zoom, narrow layout, and
  no overlap using available browser tooling.

### Backend and conditional contract checks

- Reuse v1.2.1/v1.2.0 backend protocol and security regression tests for one subscribe, limits,
  timestamps, cancellation, partial failures, safe errors, and the legacy endpoint.
- Only if a missing normalized field blocks the frontend contract, add the smallest backend change
  needed and cover it with focused backend tests. Otherwise record that no backend change was
  required.

### Integration and release checks

- Run `npm test --workspaces --if-present`, `npm run typecheck --workspaces --if-present`,
  `npm run build --workspaces --if-present`, and `git diff --check`.
- Exercise read-only scenarios for one and multiple consulted contexts, sidecar actions, sidecar-
  only fallback, one aggregate socket, local filters/wrap, partial failure, limits, cancellation,
  legacy logs, responsive layout, and keyboard interaction.
- Record unavailable environment checks as limitations rather than marking implementation complete.
