# Requirements - ops-union v1.1.0 preset library portability

## Scope

This specification defines JSON export/import for the saved preset library and a confirmed
"delete all" action in the existing preset modal. It preserves the local, read-only Kubernetes
boundary and does not change pod querying, backend APIs, or desktop IPC contracts.

## Glossary

- **Preset library:** The saved collection of named `(cluster, namespace)` target combinations.
- **Import preview:** The review state shown after parsing a JSON file and before changing the
  current preset collection.
- **Valid imported preset:** An entry with a non-empty name and at least one valid target whose
  cluster and namespace are non-empty strings.
- **Semantic duplicate:** An imported preset whose normalized target set matches a preset already
  in the current library or another imported preset, regardless of its id or usage metadata.

## Requirements

### Requirement 1 - Export the preset library as versioned JSON

1. WHEN the user chooses `Export JSON` from the preset library THEN the application SHALL create a
   downloadable JSON file representing all saved presets.
2. The exported document SHALL use an envelope containing `format: "ops-union.presets"`,
   `version: 1`, an ISO `exportedAt` timestamp, and a `presets` array.
3. Each exported preset SHALL include its name, optional description, and normalized targets.
4. The export SHALL omit `id` and `lastUsedAt`, because those values are local implementation and
   ordering metadata rather than portable preset content.
5. Export SHALL not include pods, kubeconfig content, credentials, current filters, or other
   operational data.
6. Export SHALL work in web mode and desktop mode without adding renderer filesystem access or a
   backend route.

### Requirement 2 - Import presets by additive merge

1. WHEN the user selects a JSON file through `Import JSON` THEN the application SHALL parse it
   without changing the current library until the user confirms the preview.
2. The importer SHALL accept only the documented format and supported version; malformed JSON,
   unknown format, unsupported version, or a missing preset array SHALL produce an import error.
3. The preview SHALL report valid entries, invalid entries with human-readable reasons, and
   semantic duplicates that will be skipped.
4. WHEN the user confirms a preview with valid entries THEN the application SHALL append valid,
   non-duplicate presets to the existing library and persist the resulting collection through the
   existing web or desktop storage path.
5. The import SHALL generate fresh local ids for accepted presets and SHALL not import
   `lastUsedAt` values.
6. Invalid entries and duplicates SHALL never partially mutate the store before confirmation.
7. If a file contains no importable entries, the application SHALL leave the library unchanged
   and keep the preview available so the user can understand why.
8. Importing SHALL preserve the current targets, pod results, active preset selection, and view
   controls. An imported preset SHALL not be applied automatically.

### Requirement 3 - Delete the complete library with confirmation

1. WHEN at least one preset exists THEN the preset library SHALL expose an `Delete all` action.
2. Activating the action SHALL open a custom confirmation dialog that states the number of presets
   that will be removed and that the current view will remain unchanged.
3. The dialog SHALL provide explicit `Cancel` and `Delete all` actions and SHALL be dismissible
   with Escape and the backdrop without deleting anything.
4. WHEN the user confirms THEN the application SHALL persist an empty preset collection and remove
   all preset rows from the library.
5. Deleting all presets SHALL preserve current targets, pods, filters, grouping, theme, refresh
   interval, and query state.
6. If the deleted collection contains the active preset, the application SHALL clear the active
   preset reference and dirty state while leaving the current target selection intact.

### Requirement 4 - Preserve modal usability and product boundaries

1. Export, import, preview, and delete-all controls SHALL be reachable by keyboard and SHALL have
   accessible names and visible focus states.
2. The import preview and delete confirmation SHALL use the existing modal visual language and
   dialog semantics without nesting incompatible modal layers.
3. The preset library SHALL remain searchable and usable while the new controls are present at
   desktop and narrow responsive widths.
4. Import and delete failures SHALL be shown as local user-facing feedback and SHALL not break the
   rest of the application.
5. The feature SHALL remain frontend-only, use the existing Zustand store and preset persistence,
   and SHALL not add Kubernetes mutations, backend endpoints, or kubeconfig exposure.
6. WHILE a preset file is being read or an export file is being prepared THEN the library SHALL
   show a loading state, disable competing preset actions, and announce that the operation is in
   progress until it settles. Even when the browser completes the operation immediately, the
   loading state SHALL remain visible for a short minimum duration so the user can perceive it.
   The import loading state SHALL begin before opening the native file chooser so system file
   scanning time is covered as part of the operation.

## Definition of done

- The preset modal exports a versioned, portable JSON document.
- A selected JSON file produces a reviewable preview before any state changes.
- Valid, non-duplicate presets can be appended and persisted after confirmation.
- Invalid entries and unsupported documents are explained without mutating the library.
- The modal offers a confirmed delete-all action that leaves the current view intact.
- Import and export operations visibly block competing actions until they finish.
- Focused frontend tests, frontend typecheck, production build, and `git diff --check` pass.
- The `1.1.0` spec is complete; package versioning, commit, tag, and publication remain separate
  release actions unless explicitly approved.
