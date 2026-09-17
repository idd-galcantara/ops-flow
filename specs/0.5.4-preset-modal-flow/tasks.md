# Implementation Tasks - ops-union v0.5.4 preset modal flow

The tasks below are incremental and preserve the completed history in the earlier MVP, desktop,
and security specifications. No task authorizes changes outside the frontend product code and
focused validation artifacts required for this behavior.

## Phase 1 - Layered preset editing

- [x] 1.1 Keep the preset library mounted when opening an editor.
  - Update `PresetSection` so `onEdit` sets the editor id without closing the library.
  - Render the editor above the library with an explicit stacking and interaction contract.
  - Preserve library search text, active status, and visible rows while the editor is open.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: none_
  - _Requirements: 1.1, 1.2, 3.3_
  - _Validation: frontend typecheck; open the library and click edit while a search filter is active._

- [x] 1.2 Make editor dismissal close only the editor.
  - Verify cancel, close button, Escape, and editor-backdrop dismissal clear only
    `editingPresetId`.
  - Ensure the library remains available for another action without reopening or losing context.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.1_
  - _Requirements: 1.3, 3.3_
  - _Validation: focused UI scenarios for all four dismissal paths._

- [x] 1.3 Wire save to the existing store update and immediate library re-render.
  - Keep the editor validation rules for non-empty name and valid non-empty targets.
  - Call `updatePreset` with the edited id and draft fields, then close only the editor.
  - Read the resulting row from Zustand state; do not add a parallel preset collection.
  - Cover inactive and active preset saves according to the existing store contract, including
    stale-query clearing for an active preset and no implicit pod query.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.1, 1.2_
  - _Requirements: 1.4-1.8, 3.1, 3.4_
  - _Validation: focused frontend test or documented component scenario; `npm test --workspace=frontend`._

- [x] 1.4 Preserve modal accessibility while layers coexist.
  - Ensure the editor backdrop/panel is topmost and receives interaction priority.
  - Preserve dialog semantics, close controls, Escape handling, and an accessible pending/status
    contract for later apply work.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.1, 1.2_
  - _Requirements: 3.3_
  - _Validation: keyboard and pointer smoke test at desktop and narrow viewport sizes._

## Phase 2 - Apply, query, then close

- [x] 2.1 Add an explicit preset-apply pending state in the library flow.
  - Track the id of the preset currently being applied.
  - Keep the library open during the apply attempt, show a clear pending state, and disable
    competing apply actions.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 1.1_
  - _Requirements: 2.3, 3.3_
  - _Validation: typecheck and a UI scenario with a delayed pod request._

- [x] 2.2 Sequence preset application and pod loading through the existing store.
  - Apply the selected preset first, then obtain and await the current store `loadPods` operation.
  - Close the library only after the load promise settles, including normal success, partial target
    errors, and request-level errors.
  - Preserve the store's request-id, revision, target-signature, `pods`, `targetErrors`, and
    `podsError` behavior; do not fetch through a second API path.
  - Leave the selected preset active and targets applied after the attempt.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 2.1_
  - _Requirements: 2.1, 2.2, 2.4-2.8, 3.1, 3.2_
  - _Validation: focused sequencing test with a deferred `loadPods`; success, partial-error, and request-error scenarios._

- [x] 2.3 Handle missing preset ids without side effects.
  - Keep the library open when an apply callback cannot resolve a preset.
  - Do not mutate targets, active state, pod results, or loading state for this case.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 2.2_
  - _Requirements: 2.7_
  - _Validation: focused store/component test for an unknown id._

- [x] 2.4 Verify table freshness after selection.
  - Confirm the table is populated from the selected preset's query result after the library closes.
  - Confirm partial target failures remain visible and request-level errors remain retryable.
  - _Copilot agent: @ops-union-frontend_
  - _Dependencies: 2.2, 2.3_
  - _Requirements: 2.4-2.6, 2.8_
  - _Validation: frontend tests plus a connected-backend smoke scenario._

## Phase 3 - Integration validation and regression gate

- [x] 3.1 Validate edit modal layering end to end.
  - Verify edit opens above the still-visible library; cancel and save close only the editor.
  - Verify the updated name, description, target summary, and search result are reflected without
    reload.
  - _Copilot agent: @ops-union-integration-qa_
  - _Dependencies: 1.3, 1.4_
  - _Requirements: 1.1-1.8, 3.3, 3.4_
  - _Validation: desktop/web UI smoke test using the existing preset persistence path._

- [x] 3.2 Validate selection ordering and result states.
  - Verify targets and active preset change before the pod request starts.
  - Verify the library remains open during loading and closes only after the request settles.
  - Verify successful results, partial target errors, and request-level errors are visible in the
    expected table/error states.
  - _Copilot agent: @ops-union-integration-qa_
  - _Dependencies: 2.4_
  - _Requirements: 2.1-2.8_
  - _Validation: delayed-response scenario and one real or controlled partial-failure scenario._

- [x] 3.3 Run the frontend regression gate and read-only audit.
  - Run `npm run typecheck --workspace=frontend`.
  - Run `npm test --workspace=frontend`.
  - Confirm the change adds no backend route, Kubernetes mutation, or renderer filesystem access.
  - _Copilot agent: @ops-union-integration-qa_
  - _Dependencies: 3.1, 3.2_
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Validation: commands above and a diff review limited to the intended frontend/test files._
  - _Evidence: frontend typecheck passed; 54 frontend tests passed; focused diff and read-only audit passed._

_Follow-up: Tasks 3.1 and 3.2 remain open for the desktop/web UI smoke test and connected-backend
selection/error-state scenarios, which were not available in this validation run._

## Definition of done

- All Phase 1 and Phase 2 implementation tasks are complete and their focused validations pass.
- Integration QA confirms both modal flows and all required query result/error states.
- Frontend typecheck and tests pass.
- The existing preset persistence and read-only boundaries remain intact.
- No completed task in earlier specifications is changed or unchecked.
