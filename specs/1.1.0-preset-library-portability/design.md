# Design - ops-union v1.1.0 preset library portability

## Overview

The existing `PresetLibrary` remains the interaction owner and the Zustand store remains the
source of truth. The feature adds a small portable-file boundary around the existing `Preset`
model and a destructive-action confirmation layer. No backend or Electron bridge changes are
needed: browser file APIs work in both the web renderer and the desktop renderer.

## Ownership boundaries

- `frontend/src/presets.ts` owns the portable document contract, serialization, parsing,
  validation, target normalization, semantic duplicate keys, and fresh-id creation.
- `useOpsFlowStore` owns collection mutations:
  - append accepted imported presets and persist them;
  - clear all presets and persist an empty collection;
  - clear `activePresetId` and `activePresetDirty` only when the active preset is removed.
- `PresetSection` coordinates library-level modal state and delegates collection actions to the
  store.
- `PresetLibrary` renders export/import controls, the import preview, and the delete-all trigger.
  It does not maintain a second preset collection.
- A small `PresetImportPreview` or equivalent local dialog renders parsed results and emits cancel
  or confirm. It must not apply imported presets automatically.
- Browser download and file selection use `Blob`, an object URL, and a hidden file input. No
  renderer filesystem access, IPC method, or backend route is introduced.

## Portable document contract

The supported document shape is:

```json
{
  "format": "ops-union.presets",
  "version": 1,
  "exportedAt": "2026-09-16T12:00:00.000Z",
  "presets": [
    {
      "name": "Example preset",
      "description": "Clusters de QA",
      "targets": [
        { "cluster": "cluster-a", "namespace": "namespace-a" }
      ]
    }
  ]
}
```

`id` and `lastUsedAt` are deliberately not portable. Imported presets receive new ids through
`createPreset`, have no usage timestamp, and preserve only non-empty trimmed descriptions.
Unknown fields may be ignored, but the envelope, version, and array are required.

## Import state flow

```text
Library idle
  -> file selected
  -> parse and validate (no store mutation)
  -> preview: valid / invalid / duplicate counts
  -> cancel: discard preview
  -> confirm: append accepted presets, persist, close preview
```

A parser result should be structured enough for the UI to explain each rejected entry. Suggested
result fields are `accepted`, `invalid`, `duplicates`, and a top-level `error` for unsupported
files. The parser should normalize target whitespace and deduplicate targets within each imported
preset before accepting it.

Semantic duplicate identity is based on the sorted unique target pairs, for example:

```text
cluster-a/namespace-a|cluster-b/namespace-b
```

The existing library and accepted import entries participate in the same duplicate set. Duplicate
names alone are not an import conflict; two differently named views can intentionally share the
same targets only if their target sets are different.

When confirmation succeeds, the store appends accepted presets in file order after the current
collection. The current targets, pods, active preset, and view preferences are untouched.

## File-operation loading state

`PresetLibrary` owns a local `fileOperation` state with `null`, `importing`, and `exporting`
values. It is set before `File.text()` starts and cleared in both success and failure paths. The
export path uses the same state around serialization, Blob creation, link activation, and URL
cleanup so the action cannot be double-triggered while the browser is preparing the download.

While `fileOperation` is non-null:

- the library shows an `aria-live` pending status with an operation-specific message;
- export, import, save, delete, apply, edit, search, and modal close actions are disabled;
- the visible import action cannot start a second read; the hidden file input remains enabled only
  long enough for the already-requested native chooser to open and return its result;
- the state is cleared even when file reading fails.

The loading state is local to the library and does not affect targets, pods, or global query state.
It must remain visible for a short minimum duration even when `File.text()` or download
preparation resolves immediately, while still lasting longer for genuinely slow operations. The
existing import preview remains available after parsing completes, and read failures return to the
idle state with the existing local error message after the same minimum duration.

For imports, the operation starts when the user activates the visible `Import JSON` button, before
the hidden file input is clicked. The click is deferred by one browser task so React can paint the
pending state before the native chooser opens. When the chooser is cancelled, the change handler
clears the pending state without showing an error. When a file is selected, the original operation
start time is retained so native file-scanning time contributes to the loading duration.

## Delete-all state flow

```text
Library idle
  -> delete all requested
  -> confirmation dialog
  -> cancel / Escape / backdrop: no mutation
  -> confirm: store.clearPresets(), close dialog
```

`clearPresets` should persist `[]`, set `presets: []`, and clear `activePresetId` and
`activePresetDirty` if necessary. It must not call `clearTargets`, clear pods, or alter query state.
The library can remain open after confirmation and render its existing empty state.

## Error and accessibility behavior

- File read, JSON parse, unsupported-format, and storage errors are rendered within the library or
  preview layer with a retry/cancel path; they do not throw through the application shell.
- The file input accepts `.json` and should also allow files whose OS MIME type is blank.
- The preview and confirmation use `role="dialog"`, `aria-modal="true"`, labelled headings, and
  Escape handling consistent with the existing editor/library modals.
- While a preview or confirmation is open, the underlying library remains visually present but
  must not receive the action intended for the top dialog.
- Import/export and delete controls remain disabled while a preset is being applied.
- Import/export actions show an accessible pending status and disable competing library actions
  until the operation settles, including file-read failures.

## Validation strategy

### Unit tests

- Portable serialization omits local metadata and creates the documented envelope.
- Valid documents parse into normalized presets; malformed, unsupported, and mixed entries produce
  useful results without throwing.
- Semantic duplicates are detected independent of id, name, target order, or whitespace.
- Store import appends and persists accepted presets; delete-all preserves current view state and
  clears the active preset reference.

### Frontend checks

- `npm test --workspace=frontend`
- `npm run typecheck --workspace=frontend`
- `npm run build --workspace=frontend`
- `git diff --check`

### Manual checks

1. Export a library with descriptions, multiple targets, and a recently used preset; inspect the
   downloaded JSON for the versioned envelope and absence of local metadata.
2. Import a valid file, a mixed valid/invalid file, a duplicate-only file, malformed JSON, and an
   unsupported version; confirm preview behavior and no premature mutation.
3. Confirm imported presets appear in the library but do not change the active targets or query.
4. Open delete-all, cancel it by button, Escape, and backdrop, then confirm it and verify the
   current table/view remains intact.
5. Exercise web and desktop persistence paths where available.
