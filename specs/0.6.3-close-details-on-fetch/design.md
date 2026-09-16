# Design - ops-flow v0.6.3 close pod details on fetch

## Overview

The selected pod is local UI state owned by `App`, while query lifecycle state is already exposed
by the Zustand store. `App` observes the transition into the normal `podsLoading` state and clears
its selected pod. Silent auto-refresh uses `refreshing` instead, so it does not trigger the close.

## Behavior mapping

- Sidebar `Fetch pods`: closes through the normal `podsLoading` transition.
- Manual refresh and query retry: use the same normal transition and close the panel.
- Preset apply and load: clears the active details when its normal query begins.
- Silent auto-refresh: keeps details open because it sets `refreshing`, not `podsLoading`.
- Query success, partial errors, and request-level failure: panel is already closed and existing
  result/error rendering remains unchanged.

## Ownership and boundaries

- `App.tsx` owns the selected pod and is the single place that reacts to query lifecycle state.
- `store.ts` keeps ownership of request IDs, loading states, target signatures, and result data.
- `PodDetailsPanel.tsx` keeps its existing effect cleanup for in-flight detail requests.
- No backend or Kubernetes client changes are required.

## Validation

Run frontend typecheck and tests, backend tests, and the production build. Manually open a pod,
start a sidebar fetch, refresh, retry, and preset query, then confirm the panel closes. Enable
silent auto-refresh and confirm the panel remains open across refresh ticks.
