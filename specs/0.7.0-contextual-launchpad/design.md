# Design - ops-union v0.7.0 contextual launchpad

## Overview

The main panel currently shows a large centered empty state while the sidebar contains the only
entry points for presets and pod fetching. Version 0.7.0 turns that empty state into a small,
contextual launchpad. It accelerates the two common first actions without turning the main panel
into a dashboard or duplicating target-selection state.

## Behavior mapping

- No targets, no pods, and no active query: show the launchpad with an `Open presets` action and
  a short list of saved preset shortcuts when available.
- A preset shortcut: apply the preset and await the existing `loadPods` operation. The normal
  loading, partial-error, request-error, and active-preset behavior remains unchanged.
- No saved presets: show the launchpad guidance without an empty preset list.
- Targets selected, no pods, and no active query: show a ready state with a direct `Fetch pods`
  action and the selected target count.
- Querying: keep the existing querying state as the highest-priority content.
- Query completed with no pods: keep the existing no-results state.
- Filtered table with no visible rows: keep the existing filter-specific empty state.
- Request-level error: keep the existing error and retry surface authoritative.
- Preset applied from either entry point: persist `lastUsedAt` through the existing preset save
  path, then show that preset first in the library and launchpad on the next render.
- Header brand button: call the existing `clearTargets`, clear the local selected pod, and send a
  reset request to the target selector so open preset layers close without touching preferences or
  saved presets.

## Ownership and boundaries

- `App.tsx` owns the main-panel state selection and renders launchpad actions using existing store
  operations.
- `TargetSelector.tsx` continues to own the preset library and target configuration. A small
  request signal allows the main-panel preset button to open that existing library without moving
  modal ownership or duplicating preset state.
- `presets.ts` owns the optional persisted usage metadata and stable recent-use ordering helper.
- `store.ts` updates and persists `lastUsedAt` inside `applyPreset`, which is shared by both the
  library and launchpad apply flows.
- `App.tsx` owns the brand reset action and local pod-details cleanup; `TargetSelector.tsx` receives
  a reset signal only to close its preset library/editor layers.
- `Feedback.tsx` keeps the generic `EmptyState` primitive; the launchpad-specific content is
  composed by `App.tsx`.
- `index.css` styles the launchpad as a compact action group and responsive preset list, matching
  the existing restrained ops-union visual language.
- `presetFlow.ts` and `store.ts` remain the only path for applying presets and loading pods.
- No new backend route, Kubernetes operation, Electron storage location, or persistence mechanism
  is required; the existing preset format and storage paths are extended in place.

## Interaction contract

The primary initial action opens the existing preset library. A preset shortcut starts the same
apply-and-load operation as the library. During that operation the existing query state replaces
the launchpad. The ready-state action invokes the same `loadPods` callback used by the sidebar.
All actions are buttons with visible labels and keyboard focus behavior.

## Persistence and migration

Web mode continues to use `localStorage` under the existing preset key. Desktop mode continues to
use the existing Electron `presets.json` user-data file and IPC contract. `lastUsedAt` is optional,
so older records hydrate unchanged and naturally sort after records with a timestamp. Usage is
local to the browser profile or desktop user-data directory; no backend synchronization is added.

## Brand reset contract

The brand lockup is rendered as one button so both the mark and the app name perform the same
action. The reset reuses `clearTargets` for store-owned query state and clears only transient UI
layers owned by the current view. It does not delete saved presets or reset view preferences.

## Validation

Run frontend tests and typecheck, the production build, backend tests, full typecheck, and
`git diff --check`. Manually verify the initial state with and without saved presets, direct preset
application, the ready-to-query state, loading transition, partial/request errors, and responsive
layout. Confirm no backend or Kubernetes mutation surface changed. Leave the version bump local
until the user validates the behavior. Apply several presets in a non-creation order and verify
that both the library and the four launchpad shortcuts follow most-recent-use order after reload.
