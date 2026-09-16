# Implementation Tasks - ops-union v0.7.0 contextual launchpad

## Phase 1 - Main-panel launchpad

- [x] 1.1 Define the contextual state matrix in `App.tsx`.
  - Distinguish initial, ready-to-query, querying, no-results, filtered-empty, and request-error
    states using existing store fields.
  - Preserve the current state priority so loading and errors are not hidden by the launchpad.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: none_
  - _Requirements: 1.1, 2.1, 3.1-3.4_
  - _Validation: focused frontend typecheck and state review._

- [x] 1.2 Allow the main panel to request the existing preset library.
  - Add a narrow request signal from `App` through `TargetSelector` to `PresetSection`.
  - Keep modal ownership, search state, edit flow, apply flow, and persistence in the existing
    preset components.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.1_
  - _Requirements: 1.2, 4.1, 4.2_
  - _Validation: open the library from the central launchpad and from the sidebar._

- [x] 1.3 Add saved preset shortcuts to the initial launchpad.
  - Show a compact bounded list only when saved presets exist.
  - Reuse `applyPresetAndLoad` and the existing store state; do not add a second fetch path.
  - Preserve query loading, partial errors, request errors, and active-preset behavior.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.1_
  - _Requirements: 1.3, 1.4, 1.5, 4.4_
  - _Validation: focused apply-flow test plus manual success and error scenarios._

- [x] 1.4 Add the ready-to-query action.
  - Show the selected target count and invoke the existing `loadPods` operation.
  - Disable the action while the existing query loading state is active.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.1_
  - _Requirements: 2.1-2.4_
  - _Validation: click the central action and confirm the normal query lifecycle._

- [x] 1.5 Style the launchpad actions for desktop and narrow layouts.
  - Use existing button and icon conventions, visible focus states, bounded dimensions, and no
    overlapping labels.
  - Keep the empty state visually lightweight rather than introducing dashboard cards.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.3, 1.4_
  - _Requirements: 4.3, 4.5_
  - _Validation: responsive browser smoke check._
  - _Evidence: desktop local browser smoke check passed; narrow viewport remains pending manual review._

## Phase 1.5 - Recent preset usage

- [x] 1.6 Extend the preset model with optional usage metadata.
  - Add `lastUsedAt?: number` with tolerant validation so legacy web and desktop records remain
    readable.
  - Keep the existing preset storage keys, Electron IPC, and user-data file.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.3_
  - _Requirements: 5.1, 5.7_
  - _Validation: legacy-shape and malformed-metadata unit tests._
  - _Evidence: legacy and malformed metadata coverage passed; desktop schema accepts valid usage timestamps._

- [x] 1.7 Persist usage from the shared preset-apply path.
  - Update `lastUsedAt` in the existing store `applyPreset` operation.
  - Ensure library and launchpad application both update the same preset record before loading pods.
  - Do not update usage for library open, edit, save, or delete actions.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.6_
  - _Requirements: 5.2, 5.6, 5.7_
  - _Validation: focused store/apply-flow tests and persisted round-trip test._
  - _Evidence: shared `applyPreset` path updates usage; preset persistence round-trip coverage passed._

- [x] 1.8 Order the library and launchpad by recent use.
  - Add a stable ordering helper: recent timestamps first, then never-used presets, preserving
    relative order for equal or missing timestamps.
  - Apply it before filtering/rendering the library and before selecting the four shortcuts.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.6, 1.7_
  - _Requirements: 5.3-5.5_
  - _Validation: ordering unit tests and manual reload scenario._
  - _Evidence: stable ordering and four-item launchpad selection tests passed; user confirmed the
    recent-use behavior works after manual validation._

- [x] 1.9 Make the header brand lockup reset the current view.
  - Render the logo and app name as one accessible button.
  - Reuse `clearTargets`, close local pod details, and signal the target selector to close preset
    library/editor layers.
  - Preserve presets, usage metadata, theme, grouping, filter, and refresh preferences.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.1, 1.2, 1.4_
  - _Requirements: 6.1-6.5_
  - _Validation: keyboard and pointer smoke test from populated, detail-panel, and modal states._
  - _Evidence: frontend typecheck, 62 frontend tests, production build, and diagnostics passed._

## Phase 2 - Version and regression gate

- [x] 2.1 Prepare version `0.7.0` in the root package metadata.
  - Update `package.json` and the matching root entries in `package-lock.json`.
  - Do not create a commit, tag, or push.
  - _Dependencies: Phase 1_
  - _Requirements: Definition of done_
  - _Validation: assert root package and lockfile versions match `0.7.0`._

- [x] 2.2 Add focused frontend coverage for launchpad state and shortcut behavior.
  - Cover preset list bounding/empty behavior and reuse of the existing apply-and-load contract where
    practical without introducing brittle DOM-only tests.
  - _Dependencies: 1.1, 1.3, 1.4_
  - _Requirements: 1.1-1.5, 2.1-2.4, 3.1-3.4_
  - _Validation: `npm test --workspace=frontend`._
  - _Evidence: launchpad shortcut bounding coverage added; 57 frontend tests passed._

- [x] 2.3 Run the regression gate and read-only audit.
  - Run frontend tests, frontend typecheck, backend tests, full typecheck, production build, and
    `git diff --check`.
  - Confirm no backend route, Kubernetes mutation, or renderer filesystem access was added.
  - _Dependencies: 2.1, 2.2_
  - _Requirements: 4.1, 4.2, 4.4_
  - _Validation: commands above plus manual scenario checklist._
  - _Evidence: 48 backend tests, 62 frontend tests, full typecheck, production build, version
    assertion, diagnostics, and `git diff --check` passed. User validation confirmed the launchpad,
    preset ordering, query states, responsive behavior, and header reset.

- [x] 2.4 Validate recent-use behavior before release approval.
  - Apply at least three presets in a non-creation order from both the library and launchpad.
  - Confirm the order survives reload in web mode and desktop mode, and that legacy presets remain
    available.
  - _Dependencies: 1.6-1.8, 2.3_
  - _Requirements: 5.1-5.7_
  - _Validation: manual browser and desktop smoke test._
  - _Evidence: user confirmed the recent-use ordering behavior works._

- [x] 2.5 Validate the header reset before release approval.
  - Confirm the brand button returns to the initial launchpad from populated results, open pod
    details, and preset modal states.
  - Confirm saved presets and view preferences remain unchanged.
  - _Dependencies: 1.9, 2.3_
  - _Requirements: 6.1-6.5_
  - _Validation: desktop/web keyboard and pointer smoke test._
  - _Evidence: user confirmed the brand reset returns to the initial state correctly._

## Definition of done

- The main empty area provides useful, state-appropriate actions.
- Saved presets can be opened or applied from the center without changing the existing flow.
- Selected targets can be queried from the center.
- Existing loading, no-results, filtered-empty, and error states remain correct.
- Automated validation passes and version `0.7.0` is prepared locally.
- User validation is complete; release `v0.7.0` may be committed, tagged, and published.
