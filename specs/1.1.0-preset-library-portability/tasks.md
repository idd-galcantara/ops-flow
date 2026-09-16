# Implementation Tasks - ops-union v1.1.0 preset library portability

## Phase 1 - Portable preset domain

- [x] 1.1 Define the versioned export document and serializer in `frontend/src/presets.ts`.
  - Export the full collection without ids or usage timestamps.
  - Normalize descriptions and targets without changing the stored `Preset` contract.
  - _Copilot agent: @ops-union-frontend_
  - _Requirements: 1.1-1.6_
  - _Validation: focused serializer unit tests.
  - _Evidence: `serializePresets` tests pass; exported JSON contains the v1 envelope and omits local metadata.

- [x] 1.2 Add a non-mutating importer and structured preview result.
  - Validate the envelope and version, parse mixed valid/invalid entries, normalize targets, and
    report reasons and semantic duplicates.
  - Generate fresh ids only when accepted entries are committed.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.1_
  - _Requirements: 2.1-2.8_
  - _Validation: focused parser and duplicate-detection tests.
  - _Evidence: parser tests pass for normalization, mixed invalid entries, malformed documents, and semantic duplicates.

## Phase 2 - Store and modal actions

- [x] 2.1 Add store actions to append accepted imported presets and clear the full library.
  - Persist through the existing `savePresets` adapter.
  - Keep targets, pods, query state, and view preferences intact.
  - Clear active preset metadata when its saved record is removed.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.2_
  - _Requirements: 2.4-2.8, 3.4-3.6_
  - _Validation: focused store tests.
  - _Evidence: store tests pass for persistence, fresh ids, additive append, active-state cleanup, and preserved query/view state.

- [x] 2.2 Add export and import controls to the existing preset library modal.
  - Use browser file APIs, show a preview before confirmation, and keep import additive.
  - Surface parse, validation, duplicate, and storage feedback locally.
  - Disable competing actions while a preset application is pending.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.1, 1.2, 2.1_
  - _Requirements: 1.1-1.6, 2.1-2.8, 4.1-4.5_
  - _Validation: frontend tests, typecheck, and manual import/export scenarios.
  - _Evidence: browser file controls and preview are wired; 68 frontend tests, typecheck, and production build pass.

- [x] 2.3 Add the confirmed delete-all interaction.
  - Add a custom confirmation dialog with count, cancel, Escape/backdrop dismissal, and explicit
    destructive confirmation.
  - Preserve the current view and close active preset state only as specified.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 2.1_
  - _Requirements: 3.1-3.6, 4.1-4.3_
  - _Validation: focused store/UI checks and manual keyboard/pointer scenarios.
  - _Evidence: custom count-bearing dialog, Escape/backdrop cancellation, and explicit destructive action are implemented; store preservation tests pass.

- [x] 2.4 Style the new controls and dialogs for responsive light/dark layouts.
  - Reuse existing buttons, icons, modal layering, focus states, and error tokens.
  - Avoid overlapping controls on narrow widths.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 2.2, 2.3_
  - _Requirements: 4.1-4.5_
  - _Validation: responsive browser smoke check.
  - _Evidence: headless Chrome rendered 1440x1000 and 390x844 screenshots; production CSS build and diff check pass.

- [x] 2.5 Add a blocking loading state for import and export operations.
  - Show an accessible operation-specific pending message while file reading or download
    preparation is active.
  - Keep the pending state visible for a short minimum duration when the browser operation is
    otherwise too fast to perceive.
  - Start import loading before opening the native file chooser and clear it when the chooser is
    cancelled.
  - Disable competing library actions until the operation settles, including read failures.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 2.2, 2.4_
  - _Requirements: 4.6, Definition of done_
  - _Validation: focused frontend typecheck/test plus manual double-click and read-failure checks.
  - _Evidence: `fileOperation` now exposes operation-specific live status, blocks library actions
    during import/export, preserves the parsed import preview, and clears in `finally` on success
    or failure. Import loading begins before the native chooser, covers system file scanning, leaves
    the hidden input enabled for that already-requested chooser, and clears on cancellation. A
    400 ms minimum keeps fast browser operations perceptible; 68 frontend tests, typecheck,
    production build, editor diagnostics, and diff check pass.

## Phase 3 - Regression gate

- [x] 3.1 Run the frontend regression checks and inspect the diff.
  - Run frontend tests, frontend typecheck, frontend production build, and `git diff --check`.
  - Confirm no backend route, Kubernetes mutation, or renderer filesystem access was added.
  - _Copilot agents: @ops-union-frontend, @ops-union-integration-qa_
  - _Dependencies: 2.2, 2.3, 2.4, 2.5_
  - _Requirements: 4.5, Definition of done_
  - _Validation: commands and read-only audit above.
  - _Evidence: 68 frontend tests passed; frontend typecheck, production build, editor diagnostics,
    and `git diff --check` passed. The diff contains only frontend/spec workflow changes; no backend,
    Electron IPC, package metadata, Kubernetes mutation, or renderer filesystem access was added.

## Definition of done

- Versioned JSON export and additive import with preview are available from the preset modal.
- Invalid and duplicate entries are explained before confirmation and never mutate early.
- Delete-all requires explicit confirmation and leaves the current view intact.
- Import and export show blocking progress feedback until their file operation settles.
- Web and desktop persistence continue using the existing storage boundary.
- Focused tests, frontend typecheck, frontend build, and diff check pass.
- Package versioning, commit, tag, and publication remain separate release actions.
