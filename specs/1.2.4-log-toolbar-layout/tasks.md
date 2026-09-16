# Implementation Tasks - ops-union v1.2.4 log toolbar layout

These tasks refine the v1.2.3 `LogViewer` presentation. They do not authorize backend work,
Kubernetes mutations, commits, packaging, or release publication. Earlier specification history
remains unchanged; no task is implementation evidence until its named owner records focused
validation results.

## Phase 1 - Filter field geometry and clearing

- [ ] 1.2.4-LT-1 Stabilize the five filter field shells and clear affordances.
  - Update the LogViewer filter structure/styles so Pod, Container, Cluster, Namespace, and Message
    text each keep their clear button inside the owning visual field, aligned on the trailing edge,
    and on the same line as the select/input.
  - Reserve a stable trailing slot and preserve field dimensions when a value appears, disappears,
    or contains long text; allow only complete fields to reflow responsively.
  - Preserve the existing draft update path and do not change local filter matching or Search
    confirmation semantics.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LT-1.1-LT-1.6, LT-4.1-LT-4.3, LT-5.1-LT-5.2
  - _Dependencies: 1.2.3-LS-4, 1.2.3-LS-6
  - _Validation: focused component or browser checks with each filter empty, populated, long-valued,
    and cleared; verify in-field placement, no internal line break, stable dimensions, and no page
    overflow at 320, 768, and 1280 CSS pixel widths.
  - _Evidence (2026-09-16): The current diff contains the LogViewer filter/toolbar implementation
    in `frontend/src/index.css`; frontend automated tests passed 88/88, and typecheck, build, and
    `git diff --check` passed. No browser harness is available, so visual/browser, responsive, and
    keyboard validation for the required field states did not occur. Keep this task unchecked.
  - _Definition of done: every affected field remains a stable no-wrap unit with its clear action
    contained and aligned.

- [ ] 1.2.4-LT-2 Preserve field-specific and global clear semantics with accessible controls.
  - Keep specific clear buttons keyboard-focusable and named for their owning field, with visible
    focus and a usable compact target.
  - Preserve global `Clear filters`, its count, its all-five-fields behavior, and the distinction
    between draft filter clearing and immediate retained-event Clear.
  - Ensure clear-button activation cannot submit Search or alter applied filters before Search.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LT-2.1-LT-2.5, LT-1.6, LT-5.1-LT-5.3
  - _Dependencies: 1.2.4-LT-1, 1.2.3-LS-4, 1.2.3-LS-6
  - _Validation: keyboard/component checks for tab order, visible focus, Enter/Space activation,
    accessible names for all five clear buttons, global Clear filters count, pending/applied state,
    and no socket/session change from clearing.
  - _Evidence (2026-09-16): The current diff contains the LogViewer filter/toolbar implementation
    in `frontend/src/index.css`; frontend automated tests passed 88/88, and typecheck, build, and
    `git diff --check` passed. No browser harness is available, so keyboard, focus, accessible-name,
    and browser interaction validation did not occur. Keep this task unchecked.
  - _Definition of done: users can clear one field or all draft filters accessibly without bypassing
    Search confirmation.

## Phase 2 - Toolbar action hierarchy

- [ ] 1.2.4-LT-3 Move Search into the lower action row beside Group.
  - Give the toolbar explicit filter and action regions so Search is below the filter row and no
    longer competes with the five filters.
  - Place Group immediately before Search in visual and keyboard order, keep the pair together at
    responsive widths, and retain Search's primary, pending, disabled, and busy states.
  - Keep Wrap lines, Pause, retained-event Clear, and status messaging distinct from Search and
    preserve their existing behavior.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LT-3.1-LT-3.5, LT-4.1-LT-4.4, LT-5.2-LT-5.3
  - _Dependencies: 1.2.4-LT-1, 1.2.4-LT-2, 1.2.3-LS-5, 1.2.3-LS-6
  - _Validation: rendered DOM/layout assertions and keyboard traversal proving the lower-row
    placement, Group-then-Search order, visual hierarchy, no filter-row competition, and no accidental
    Search activation from neighboring controls.
  - _Evidence (2026-09-16): The current diff contains the LogViewer action-row implementation in
    `frontend/src/index.css`; frontend automated tests passed 88/88, and typecheck, build, and
    `git diff --check` passed. No browser harness is available, so rendered browser layout and
    keyboard traversal validation did not occur. Keep this task unchecked.
  - _Definition of done: Search has a deterministic lower-row location immediately to the right of
    Group without changing its confirmation behavior.

- [ ] 1.2.4-LT-4 Verify responsive and high-zoom toolbar behavior.
  - Validate complete filter-field reflow, the stable internal clear-button alignment, the intact
    Group/Search pair, readable labels, visible focus, and no page-level horizontal overflow.
  - Exercise narrow/mobile, tablet, desktop, high-zoom, and reduced-motion conditions supported by
    the available browser tooling.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LT-4.1-LT-4.5, LT-2.2-LT-2.3, IQ-1.1-IQ-1.3
  - _Dependencies: 1.2.4-LT-1, 1.2.4-LT-2, 1.2.4-LT-3
  - _Validation: visual responsive matrix at 320, 768, and 1280 CSS pixel widths plus keyboard and
    high-zoom smoke; record any unavailable assistive-technology/browser checks as limitations.
  - _Evidence (2026-09-16): The current diff contains the LogViewer responsive toolbar
    implementation in `frontend/src/index.css`; frontend automated tests passed 88/88, and
    typecheck, build, and `git diff --check` passed. No browser harness is available, so the 320,
    768, and 1280 CSS pixel visual matrix, responsive behavior, high-zoom, and keyboard validation
    did not occur. Keep this task unchecked.
  - _Definition of done: the toolbar remains legible, reachable, and geometrically stable across
    supported responsive states.

## Phase 3 - Regression and integration QA

- [x] 1.2.4-RA-1 Run focused frontend regression and release-scope checks.
  - Cover existing search draft/applied behavior, local AND filtering, range handling, one aggregate
    session behavior, presentation controls, source scope, safe errors, virtualization, and legacy
    compatibility after the layout change.
  - Confirm that no backend source, API contract, permission, Kubernetes operation, or packaging
    output changed as part of this work.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: RA-1.1-RA-1.3, LT-5.1-LT-5.4
  - _Dependencies: 1.2.4-LT-1, 1.2.4-LT-2, 1.2.4-LT-3
  - _Validation: `npm test --workspace=frontend`, `npm run typecheck --workspace=frontend`,
    `npm run build --workspace=frontend`, `git diff --check`, and a source-scope/backend-diff audit.
  - _Evidence (2026-09-16): `npm test --workspace=frontend` passed 88/88; `npm run typecheck --workspace=frontend`, `npm run build --workspace=frontend`, and `git diff --check` passed. Static audit confirms each FilterSelect and Message text clear button stays inside its field shell with the required accessible name and `aria-hidden` icon; the toolbar has separate range, filter, and action regions; Group precedes Search and Search is outside the filter row; and draft/applied Search semantics remain unchanged. Since `31278fe`, tracked changes are limited to `frontend/src/components/LogViewer.tsx` and `frontend/src/index.css`, with only `specs/1.2.4-log-toolbar-layout/` untracked; no backend, API, Kubernetes, or package files changed, and no Kubernetes command or mutation was run.
  - _Definition of done: automated regression and scope evidence confirms that only the intended
    frontend toolbar behavior changed.

- [ ] 1.2.4-IQ-1 Perform read-only visual, responsive, and keyboard acceptance.
  - Exercise each filter's selected/clear state, global Clear filters, pending Search, Group/Search
    placement, narrow layout, high zoom, visible focus, keyboard activation, and accessible names.
  - Prove no field clear button wraps or shifts neighboring controls, no page overflow is introduced,
    and Search remains lower and immediately right of Group.
  - Do not run Kubernetes mutations or expose kubeconfig, credentials, raw response bodies, or
    response headers.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: IQ-1.1-IQ-1.4, LT-2.1-LT-2.5, LT-3.1-LT-3.5, LT-4.1-LT-4.5
  - _Dependencies: 1.2.4-RA-1, 1.2.4-LT-4
  - _Validation: documented browser/component evidence at 320, 768, and 1280 CSS pixel widths,
    keyboard/high-zoom smoke, and explicit limitations where tooling is unavailable.
  - _Evidence (2026-09-16): IQ-1 remains open. No browser/component harness or Playwright, Cypress, or Puppeteer tooling is available in the workspace, so 320/768/1280 visual geometry, page-overflow, responsive reflow, high-zoom, keyboard focus/order/activation, and accessible-name interaction checks were not executable. The static markup/CSS audit is favorable but does not replace those runtime checks. No Kubernetes validation or mutation was run, and no kubeconfig, credentials, raw response body, or response headers were exposed.
  - _Definition of done: the approved visual and interaction contract is evidenced independently
    from implementation claims.

- [x] 1.2.4-IQ-2 Complete specification handoff and residual-risk audit.
  - Review the requirements, design, task evidence, v1.2.3 boundaries, ownership assignments,
    responsive/accessibility results, and absence of backend scope.
  - Keep implementation tasks unchecked unless their owners provide evidence; identify the next
    executable task IDs or any unresolved limitations.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: RA-1.1-RA-1.3, IQ-1.1-IQ-1.4, Definition of done
  - _Dependencies: 1.2.4-RA-1, 1.2.4-IQ-1
  - _Validation: final read-only review and `git diff --check`; no commit, package, tag, or release
    publication is part of this task.
  - _Evidence (2026-09-16): QA handoff completed after reviewing requirements, design, tasks, the v1.2.3 draft/applied boundary, and the frontend diff. RA-1 is complete; IQ-1 remains the next executable gate, with LT-1 through LT-4 still requiring owner evidence where applicable. Residual risk is limited to unverified browser visual, responsive, keyboard, focus, and high-zoom behavior because no browser harness is available. No commit, package, tag, release publication, backend/API/Kubernetes change, or Kubernetes mutation was performed.
  - _Definition of done: implementation handoff names the tasks ready for execution and preserves
    any unverified residual risk.

## Definition of done

- [ ] Every task above is implemented by its named owner and has focused validation evidence.
- [ ] Requirements, design, and tasks agree on stable in-field clear affordances and the lower
  Group/Search action row.
- [ ] Filter clearing, Search confirmation, presentation controls, transport behavior, source
  scope, accessibility, and responsive layout are covered by appropriate evidence.
- [ ] No backend, Kubernetes mutation, commit, packaging, or release publication is implied.
- [ ] Versioning and release approval remain separate actions.
