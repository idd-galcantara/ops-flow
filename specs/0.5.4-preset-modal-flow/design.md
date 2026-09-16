# Design - ops-union v0.5.4 preset modal flow

## Overview

The existing `TargetSelector` owns the preset launcher and coordinates two modal components:
`PresetLibrary` and `PresetEditor`. The existing Zustand store remains the source of truth for
presets, targets, active preset state, and pod results.

The change is an orchestration change in the frontend. It does not change the preset data model,
persistence adapter, REST API, or backend behavior.

## Ownership boundaries

- `PresetSection` owns modal coordination state:
  - `libraryOpen: boolean`;
  - `editingPresetId: string | null`;
  - an apply-pending identifier, such as `applyingPresetId: string | null`.
- `PresetLibrary` renders the list and emits `onEdit` and `onApply` events. It does not own a
  second copy of the preset collection and does not call the backend directly.
- `PresetEditor` owns draft form fields and validation. It emits cancel/close and a valid draft
  to its parent.
- `useOpsFlowStore` remains authoritative:
  - `updatePreset` persists the edited preset and updates `presets` synchronously;
  - `applyPreset` synchronously updates `targets`, `activePresetId`, and query state;
  - `loadPods` queries the current targets and updates `pods`, `targetErrors`, `podsLoading`,
    `podsError`, and `hasQueried`.

## Layered modal contract

The library and editor are rendered together when editing:

```text
PresetSection
|- PresetLibrary (preset-library-backdrop, primary layer)
`- PresetEditor  (preset-editor-backdrop, top layer)
```

Clicking edit sets `editingPresetId` but SHALL NOT set `libraryOpen` to false. The editor backdrop
and panel must have the higher stacking order and receive pointer/keyboard interaction while the
library remains visible behind them. Existing Escape and backdrop handling remains local to each
modal: the editor handles the first dismissal and invokes only its `onClose`; the library can be
dismissed after the editor is closed.

When the editor saves, `PresetSection` calls:

```text
updatePreset(id, name, description, targets)
setEditingPresetId(null)
```

The library reads `presets` from Zustand on every render, so its row name, description, target
summary, and search results update from the store immediately. No callback should maintain a
parallel edited preset list. The editor's existing validation remains the gate before `onSave`.

For an active preset, `updatePreset` keeps its existing behavior: it normalizes targets, updates
the active target selection, marks the preset clean, and clears stale pod-query state. Editing is
not selection, so it does not initiate `loadPods`.

## Preset selection state transition

The apply handler is asynchronous and must preserve this order:

```text
Library idle
  -> apply pending: applyPreset(id)
  -> query pending: await loadPods()
  -> query settled: clear pending state
  -> close library
```

The implementation should use the store after `applyPreset` when obtaining `loadPods`, so the
query observes the newly applied targets. Conceptually:

```text
store.applyPreset(id)
await store.loadPods()
setApplyingPresetId(null)
setLibraryOpen(false)
```

The close operation belongs after the awaited promise. A `finally` path should clear the pending
indicator and close the library after an unexpected rejection; the store's normal `loadPods`
implementation already records request-level errors and resolves after updating `podsError`.

While `applyingPresetId` is set:

- the selected row shows a pending label or loading indicator;
- apply actions are disabled to prevent competing requests;
- edit, delete, close, and search behavior should follow the chosen UI policy, but no action may
  start a second preset application. Closing the library early is discouraged because it would
  violate the visible ordering contract; the implementation should keep it open until settle.

After `loadPods` settles:

- successful results are in `pods` and `targetErrors` before the library closes;
- partial target failures remain visible through the existing target-error UI;
- request-level failures remain in `podsError` for the existing error state and retry action;
- `activePresetId` and `targets` remain those of the selected preset.

The existing request-id, configuration-revision, and target-signature guards in `loadPods` remain
the authority for stale responses. The preset flow must not bypass those guards or write pod data
locally.

## Failure and edge behavior

| Situation | Required behavior |
| --- | --- |
| Edit is cancelled | Close editor only; library and its search context remain open. |
| Edited name/targets are invalid | Do not emit save; keep editor open. |
| Edited preset was deleted before save | `updatePreset` makes no state change; keep the editor open or surface the existing validation path rather than closing as if saved. |
| Save targets an inactive preset | Update the library row only; current query selection is unchanged. |
| Save targets the active preset | Use existing store semantics; clear stale pod data and do not auto-query. |
| Apply id is missing | No store or query change; library remains open. |
| Apply returns pods and target errors | Await settlement, then close; table shows both. |
| Apply has a request-level error | Await settlement, then close; existing `podsError` UI remains available. |
| Configuration changes during query | Existing revision/request guards decide whether the response is committed; the flow still clears pending state and closes after the promise settles. |

## Accessibility and interaction

- Keep `role="dialog"` and `aria-modal="true"` on both modal panels.
- The editor must be the visually and interactively topmost dialog while open.
- The pending apply state must be announced through an accessible label or live status and must
  not rely only on animation.
- Existing Escape, backdrop, close-button, and form validation behavior must remain available.

## Validation strategy

### Frontend automated validation

- Add focused tests for the orchestration boundary where practical: edit preserves library state,
  save updates the store-backed row, and apply awaits `loadPods` before closing.
- Verify partial pod errors and request-level errors leave the expected store fields.
- Run `npm run typecheck --workspace=frontend` and `npm test --workspace=frontend`.

### Integration/manual validation

With the frontend connected to a usable backend:

1. Open the preset library, search for a preset, edit it, and verify the library remains behind the
   editor.
2. Cancel with the button, Escape, and backdrop; verify only the editor closes.
3. Save a changed name, description, and target list; verify the library row changes immediately.
4. Select a preset and observe that the library remains open while the query is pending.
5. Verify the library closes only after the table has received successful or partial results.
6. Force a request-level query failure and verify the library closes after settlement while the
   existing error/retry UI remains usable.
