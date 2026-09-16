# Requirements - ops-union v0.6.3 close pod details on fetch

## Scope

This specification covers the stale pod-details panel that remains open while the user fetches
pods for a new target or namespace selection. The panel must not present details for a pod outside
the result set that is being queried. The existing read-only query behavior remains unchanged.

## Requirements

### Requirement 1 - Close stale details on an explicit pod fetch

1. WHEN a normal pod fetch starts THEN the application SHALL close the currently open pod-details
   panel immediately.
2. The behavior SHALL apply to the sidebar `Fetch pods` action, manual table refresh, retry after a
   query error, and preset application followed by a pod query.
3. The behavior SHALL apply whether the query succeeds, returns partial target errors, or fails at
   the request level.
4. If no pod-details panel is open, starting a fetch SHALL have no visible side effect beyond the
   existing loading state.

### Requirement 2 - Preserve details during silent auto-refresh

1. WHEN silent auto-refresh starts THEN the application SHALL keep the currently open details
   panel visible.
2. Silent refresh SHALL continue using the existing `refreshing` state and SHALL not be converted
   into a full loading transition solely to close the panel.
3. The existing details-panel cleanup SHALL prevent late describe, metrics, or log responses from
   repopulating a panel after it has been closed.

### Requirement 3 - Preserve product boundaries

1. The change SHALL remain frontend-only.
2. The change SHALL reuse the existing `podsLoading` and `refreshing` state instead of adding a
   second fetch mechanism.
3. The change SHALL not add Kubernetes operations, backend routes, or renderer filesystem access.

## Definition of done

- An open pod-details panel closes when any explicit `loadPods()` query begins.
- Auto-refresh leaves the panel open.
- Frontend typecheck, tests, and production build pass.
- The change remains uncommitted and untagged until manual validation is approved.
