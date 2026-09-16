# Requirements - ops-flow v0.5.4 preset modal flow

## Scope

This specification defines the frontend behavior for editing and selecting saved target
presets. It builds on the existing Zustand store, `PresetLibrary`, `PresetEditor`, and pod query
flow. It does not add backend endpoints, Kubernetes operations, or a new persistence mechanism.

## Glossary

- **Preset library:** The primary modal that lists saved presets.
- **Preset editor:** The modal used to edit one preset's name, description, and targets.
- **Active preset:** The preset identified by `activePresetId` in the existing store.
- **Apply attempt:** The complete operation that applies a preset's targets and waits for the
  existing `loadPods` promise to settle.

## Requirements

### Requirement 1 - Edit a preset without losing the library context

**User story:** As a user, I want to edit a preset while keeping the preset list available behind
it, so that saving or cancelling returns me to the same list context.

#### Acceptance criteria

1. WHEN the user clicks the edit action for a preset in the preset library THEN the system SHALL
   keep the preset library open and SHALL open the preset editor above it.
2. WHILE the preset editor is open from the library THEN the library SHALL remain rendered behind
   the editor, including its current search query, active-preset status, and visible list.
3. WHEN the user cancels, presses Escape, clicks the editor close action, or dismisses the editor
   backdrop THEN the system SHALL close only the preset editor and SHALL leave the preset library
   open.
4. WHEN the user saves a valid edit THEN the system SHALL call the existing preset state update
   operation with the edited id, name, description, and targets.
5. WHEN a valid edit is saved THEN the library SHALL reflect the updated preset immediately from
   the existing state, without a page reload or a separate local copy of the preset list.
6. IF the edited preset is not active THEN saving SHALL NOT change the current targets, active
   preset, or pod query solely because the preset was edited.
7. IF the edited preset is active THEN the system SHALL preserve the existing store contract for
   updating the active preset: the normalized targets and active state SHALL remain consistent,
   and stale query data SHALL NOT be presented as current. This edit flow SHALL NOT start an
   implicit pod query unless the user explicitly selects the preset afterward.
8. IF the editor data is invalid or the preset id no longer exists THEN the system SHALL NOT
   modify the stored preset and SHALL keep the editor open so the user can correct or abandon the
   edit.

### Requirement 2 - Select a preset and refresh the pod table before closing

**User story:** As a user, I want choosing a preset to immediately refresh the pod table, so that
when the list closes I am looking at the selected preset's result.

#### Acceptance criteria

1. WHEN the user selects a preset from the library THEN the system SHALL apply that preset's
   targets and active id through the existing store operation before starting the pod query.
2. WHEN a preset has been applied THEN the system SHALL automatically invoke the existing
   `loadPods` operation for the newly applied targets.
3. WHILE the apply attempt is pending THEN the preset library SHALL remain open, SHALL expose a
   clear pending state, and SHALL prevent a second preset selection from starting a competing
   apply attempt.
4. WHEN the pod query promise settles successfully THEN the system SHALL close the preset library
   and the table SHALL display the returned pods and per-target errors from that query.
5. WHEN the pod query completes with partial target failures THEN the system SHALL close the
   preset library after the query settles and SHALL leave the table and target-error UI showing
   successful results and isolated errors.
6. WHEN the pod query fails at the request level THEN the system SHALL wait for the failed query
   to settle, close the preset library, and SHALL preserve the existing `podsError` behavior for
   retry or error presentation.
7. IF the selected preset cannot be found THEN the system SHALL not change targets or active state,
   SHALL not start a pod query, and SHALL keep the preset library open.
8. WHEN the apply attempt finishes THEN the selected preset SHALL remain the active preset and the
   target selection SHALL match the selected preset, regardless of whether the query returned
   pods, partial errors, or a request-level error.

### Requirement 3 - Preserve existing product boundaries

#### Acceptance criteria

1. The implementation SHALL remain frontend-only and SHALL reuse the current Zustand state and
   persistence behavior for presets.
2. The implementation SHALL NOT add Kubernetes mutation operations, backend routes, or new
   renderer filesystem access.
3. The implementation SHALL preserve keyboard and backdrop dismissal behavior for both modal
   layers, with the editor receiving interaction priority while it is open.
4. The implementation SHALL preserve existing preset validation: a saved preset has a non-empty
   name and at least one valid target.

## Definition of done

- Editing opens a layered editor without unmounting the library and both cancel and save close only
  the editor.
- A saved edit is visible immediately in the library through the store state.
- Selecting a preset applies it, awaits the pod load, displays the resulting table state, and only
  then closes the library.
- Success, partial target failure, request-level failure, invalid edit, and missing-preset cases
  are covered by automated or documented focused validation.
- Frontend typecheck and tests pass, and no files outside the specification are changed by this
  spec-authoring work.
