# Design - ops-union v1.2.1 application-oriented log source modal

## Overview

Version 1.2.1 adds a source-selection layer in front of the v1.2.0 log session. The modal turns
application identity and explicit target context into a bounded list of source tuples. The
existing aggregate `WS /api/logs` protocol remains the only new log transport, and the legacy
per-pod path remains untouched.

The frontend owns selection interaction, container-role defaults, context visibility, summary
presentation, and viewer filters. Existing normalized pod/application data remains authoritative
for grouping. The backend remains authoritative for source access, timestamps, limits, lifecycle,
and safe errors.

## Ownership boundaries

- `frontend/src` owns the modal state machine, hierarchical source tree, selection defaults,
  pending selection, selection summary, and structured viewer filters.
- The existing normalized pod/application model owns the application key and display identity. A
  display name is never used as a substitute for the identity key.
- The source assembly boundary owns conversion from selected UI nodes to unique
  `(cluster, namespace, pod, container)` tuples. It preserves context and de-duplicates exact
  tuples before subscription.
- A small container-role classifier owns the primary/sidecar convenience decision. It does not
  authorize sources or remove containers from the inventory.
- The existing log session owns one WebSocket, subscription serialization, source lifecycle,
  limits, cancellation, structured events, and partial failures as defined by v1.2.0.
- The details/sidebar owns a compact summary only. The modal owns the full selection tree; the
  viewer owns filters and filtered presentation.
- `@ops-union-integration-qa` owns read-only cross-context, multi-source, and regression checks.

## Selection data model

The modal operates on an inventory snapshot and a pending selection. The conceptual model is:

```ts
interface ApplicationLogInventory {
  application: ApplicationIdentity;
  contexts: Array<{
    cluster: string;
    namespace: string;
    pods: Array<{
      pod: string;
      containers: Array<{
        container: string;
        role: 'primary' | 'sidecar' | 'unknown';
        roleReason?: string;
      }>;
    }>;
  }>;
}

interface LogSourceSelection {
  cluster: string;
  namespace: string;
  pod: string;
  container: string;
  application: ApplicationIdentity;
  containerRole: 'primary' | 'sidecar' | 'unknown';
}
```

The wire payload continues to use the v1.2.0 source tuple. Application and role fields are
presentation metadata and correlation data; they do not replace the authoritative cluster,
namespace, pod, or container fields.

An exact source tuple is selected at most once. The UI may retain node-level selection state for
convenience, but the confirmed payload is a normalized set of source tuples and cannot contain a
hidden or duplicate source.

## Context and application grouping

The tree is rendered as:

```text
Application identity
  Cluster / Namespace context
    Pod
      Container
```

The application node is the entry point, not an implicit cross-cluster authorization scope. The
originating cluster/namespace context is selected by default. Other contexts containing the same
application identity are displayed, but remain unselected until the user explicitly adds them.
Every context group keeps its cluster and namespace in its heading and in the selection summary.

If the same identity is intentionally selected in multiple contexts, the application parent may
visually group them, but the context groups remain separate selection and rendering boundaries.
The viewer never collapses context labels merely because pod, container, or application names are
equal.

The modal should make context selection legible with context-level counts, selected/available
counts, and an explicit add/remove affordance. A context that cannot be loaded is represented as a
scoped error row rather than silently omitted.

## Container-role defaults

Role classification is a UX default, not a security or backend contract. The classifier uses
available explicit metadata first, then known injected/infrastructure indicators. The initial
indicator set includes names such as `istio-proxy`, `envoy`, `linkerd-proxy`, and common telemetry
or logging agents. The indicator set must be centralized and testable rather than duplicated in
rendering code.

- `primary` containers are checked by default.
- `sidecar` containers are visible and unchecked by default.
- `unknown` containers follow the primary default unless explicit metadata marks them as
  infrastructure.
- If a pod has no primary/unknown container, all available containers are checked as a
  sidecar-only fallback and the pod row exposes that fallback.

The classifier must tolerate future sidecar names. A user can always override the default at
container level, and no classification may remove a container from the source tree.

## Modal state machine

```text
closed
  -> loading-inventory
  -> ready
  -> editing-selection
  -> confirmed
  -> session-started

loading-inventory -> error-with-retry
ready/editing-selection -> cancelled -> closed
ready/editing-selection -> empty-or-stale -> error-with-retry
confirmed -> session-started only when normalized selection is non-empty and current
```

Opening the modal snapshots the current application identity and originating context. Discovery
refreshes can add or remove inventory entries, but pending selections are reconciled by exact
identity. Removed sources are cleared and surfaced before confirmation. Confirming performs one
final validation against the current inventory, builds the normalized source list, and hands it to
the existing log-session owner.

Cancelling restores the pre-modal session state. It does not clear an already-running session
unless the user explicitly starts a new confirmed selection. Confirming a replacement selection
tears down the prior session through its existing effect/cancellation path.

## Summary and viewer contract

The details/sidebar summary contains:

- application identity and identity source;
- selected context names, with cluster and namespace visible;
- selected pod count and selected container count;
- primary versus sidecar/unknown counts;
- a compact indication of partial discovery or source failures;
- active time range and session status when logs are running.

It does not render the complete application/context/pod/container tree. A `Change sources` action
reopens the modal with the current selection.

The viewer filters are derived from structured event metadata and use AND semantics:

```text
pod AND container AND cluster AND namespace AND message-text
```

Each dropdown is scoped to values present in selected or received sources. Text filtering is
case-insensitive against the message field. Filtering runs before virtualization and is local to
the retained bounded event collection; it never changes the subscription or server budgets. The
viewer distinguishes no matching events from no events received and provides individual/all filter
clear actions.

## WebSocket integration

The modal hands one normalized source list to the existing v1.2.0 session creator. The session
sends one `subscribe` message to `WS /api/logs`, keeps the existing range/follow/limit fields, and
renders source lifecycle events as they arrive. The modal does not create a socket and the viewer
does not create additional sockets for filters or application groups.

When sources span multiple explicitly selected contexts, the subscription retains every source's
cluster and namespace. A source failure remains attached to its source tuple and context. A
transport failure remains a session-level state. No application identity is used to expand the
selection after confirmation.

## Error and security behavior

Inventory errors are scoped to the affected cluster/namespace or pod where possible. A partial
inventory remains selectable, but its missing scope is visible. An empty or stale inventory blocks
confirmation. The frontend does not invent replacements for disappeared sources.

All discovery and log operations remain read-only. Application identity, container role, and
selection counts are presentation metadata and cannot broaden Kubernetes access. Safe error
formatting from v1.2.0 is reused; raw Kubernetes response bodies, headers, kubeconfig fields, and
credentials do not enter the modal, summary, or viewer state.

## Validation strategy

### Frontend unit/component tests

- Build the application/context/pod/container hierarchy and preserve repeated names across
  clusters and namespaces.
- Include all matching pods in the originating selected context, keep additional contexts
  unselected, and require explicit context selection.
- Classify known sidecars, select primary containers by default, and exercise the sidecar-only
  fallback and individual overrides.
- Cancel without opening a socket; confirm one normalized, de-duplicated source list; replace a
  session without an orphaned socket.
- Render compact summary counts and explicit context labels without reproducing the full tree.
- Apply pod/container/cluster/namespace/text filters with AND semantics before virtualization,
  including clear and no-results states.
- Cover loading, partial discovery, stale selection, empty selection, keyboard focus, and narrow
  layout states.

### Backend and integration checks

- Confirm the existing structured subscription receives exactly the selected source tuples and
  continues to enforce v1.2.0 limits, timestamps, cancellation, and safe source failures.
- Exercise explicitly selected sources across two read-only cluster/namespace contexts without
  automatic expansion.
- Confirm no mutation client method or second WebSocket path is introduced.

### Commands and read-only scenarios

- `npm test --workspaces --if-present`
- `npm run typecheck --workspaces --if-present`
- `npm run build --workspaces --if-present`
- `git diff --check`
- Read-only UI and WebSocket scenarios for one application, multiple contexts, repeated pod names,
  primary plus sidecar containers, missing inventory entries, partial source failure, and viewer
  filtering.
