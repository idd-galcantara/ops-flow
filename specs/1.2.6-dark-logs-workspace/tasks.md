# Implementation Tasks - ops-union v1.2.6 dark logs workspace

These tasks define a frontend-only dark readability correction for the logs workspace. They do not
authorize backend work, Kubernetes mutations, commits, packaging, release publication, or marking
earlier v1.2.5 tasks complete. Existing v1.2.5 open validation remains open unless its named owner
provides separate evidence.

## Phase 1 - Dark surface and token audit

- [ ] 1.2.6-DL-1 Audit and map all covered LogViewer surfaces to dark semantics.
  - Inventory fixed light colors and missing dark selectors for the workspace header, toolbar,
    range summary, filters/selects/inputs, action row, source inspection, output, feedback, and
    footer; include the related application source modal surfaces.
  - Define the smallest token/selector changes needed to keep light mode unchanged and avoid
    unrelated global restyling.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: DL-1.1-DL-1.8, DL-2.7
  - _Dependencies: none
  - _Validation: stylesheet audit against the in-scope surface inventory; identify each remaining
    fixed light literal or document why it is not visible in the covered dark flow.
  - _Evidence (2026-09-16): The current diff limits the dark LogViewer overrides to
    `frontend/src/index.css` and covers the workspace header, toolbar and range summary,
    filters/selects/inputs, action row, source inspection, validation/partial feedback, output,
    footer, and related source-modal surfaces. The light theme remains preserved, and no JSX or
    transport changes are present. Frontend automated coverage passed 88/88; typecheck, build,
    and `git diff --check` passed. No browser harness was available, so visible dark rendering and
    runtime surface coverage remain unverified; keep this task unchecked.
  - _Definition of done: every covered surface and state has an identified dark semantic owner,
    with light-theme and unrelated component boundaries explicit.

- [ ] 1.2.6-DL-2 Implement dark surface, border, text, control, and feedback corrections.
  - Apply the existing dark tokens or narrowly scoped dark equivalents to the workspace header,
    toolbar/range summary, filters/selects/inputs, action row, source inspection, validation and
    partial feedback, output, footer, statuses, and related source modal.
  - Preserve layout, row density, state transitions, accessible names, Search confirmation,
    select/X treatment, local filters, Wrap lines, virtualization, and transport behavior.
  - Keep output and search-highlight colors readable against their actual dark backgrounds.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: DL-1.1-DL-1.8, DL-2.1-DL-2.7, DL-3.1-DL-3.7
  - _Dependencies: 1.2.6-DL-1
  - _Validation: focused frontend/CSS checks plus `npm run typecheck --workspace=frontend` and
    `npm test --workspace=frontend`; verify no source/API/backend file is changed.
  - _Evidence (2026-09-16): The current diff contains only dark presentation overrides in
    `frontend/src/index.css`; the covered workspace and related source-modal surfaces are listed
    in the DL-1 evidence above. Light-theme rules, JSX/state ownership, Search confirmation, and
    aggregate transport remain preserved. Frontend automated coverage passed 88/88; typecheck,
    build, and `git diff --check` passed. Computed contrast, focus/hover/disabled/live states,
    responsive behavior, zoom, reduced motion, and other visual/runtime checks were not executed;
    keep this task and those acceptance requirements unchecked.
  - _Definition of done: the covered logs flow is consistently dark and readable without a
    behavior or light-theme regression.

## Phase 2 - Contrast and interaction evidence

- [ ] 1.2.6-DL-3 Verify contrast and all interactive/live states.
  - Check representative primary/supporting/compact mono text, field values/placeholders,
    highlights, borders, focus rings, status dots/labels, disabled Search, hover, validation,
    partial, live, paused, ended, loading, and error states against computed dark surfaces.
  - Record contrast results using WCAG AA thresholds: 4.5:1 normal text and 3:1 for required
    non-text boundaries/focus indicators or qualifying large text.
  - Confirm state meaning remains available through text/structure and does not depend on color or
    animation alone, including `prefers-reduced-motion`.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: DL-2.1-DL-2.6, DL-3.1-DL-3.7, IQ-1.2-IQ-1.3
  - _Dependencies: 1.2.6-DL-2
  - _Validation: read-only browser/visual or computed-style evidence, documented per representative
    state; no Kubernetes mutation or sensitive data capture.
  - _Definition of done: contrast and interaction-state evidence is recorded, with unsupported
    tooling called out as a limitation rather than inferred as pass.

- [ ] 1.2.6-DL-4 Verify responsive, zoom, keyboard, and overflow behavior.
  - Exercise 320, 768, and 1280 CSS px widths plus 200% zoom where available, selected and empty
    filters, pending Search, expanded source inspection/modal, long identities/status text, long
    no-wrap messages, and wrapped rows.
  - Confirm no page-level horizontal overflow, output-scoped no-wrap scrolling, intact field/X and
    Group/Search units, readable footer/feedback, visible focus, keyboard order, accessible names,
    and reduced-motion behavior.
  - Reconfirm v1.2.5 row density, text selection, filters, wrapping, virtualization, and source
    inspection behavior while the theme is dark.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: DL-3.2-DL-3.7, DL-4.1-DL-4.6, DL-5.1-DL-5.5, IQ-1.3-IQ-1.5
  - _Dependencies: 1.2.6-DL-2
  - _Validation: documented read-only responsive/keyboard/accessibility smoke; record unavailable
    browser or assistive-technology checks explicitly.
  - _Definition of done: required viewport, zoom, focus, motion, overflow, and interaction
    evidence is independently recorded.

## Phase 3 - Regression and scope handoff

- [x] 1.2.6-RA-1 Run frontend regression and release-scope checks.
  - Run `npm test --workspace=frontend`, `npm run typecheck --workspace=frontend`,
    `npm run build --workspace=frontend`, and `git diff --check`.
  - Confirm Search remains the apply boundary, select/X and row-density contracts remain intact,
    local filters/wrap/virtualization remain covered, one aggregate WebSocket and payloads remain
    unchanged, and no light-theme or backend/API/Kubernetes/packaging changes slipped in.
  - Audit output/evidence for raw Kubernetes bodies, headers, credentials, or kubeconfig data.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: DL-5.1-DL-5.5, RA-1.1-RA-1.5, IQ-1.4
  - _Dependencies: 1.2.6-DL-2, 1.2.6-DL-3, 1.2.6-DL-4
  - _Validation: commands above plus read-only diff/scope audit; no Kubernetes mutation.
  - _Definition of done: automated regression and scope evidence is recorded without claiming
    unexecuted visual or assistive-technology validation.
  - _Evidence (2026-09-16): `npm test --workspace=frontend` passed (88/88),
    `npm run typecheck --workspace=frontend` passed, `npm run build --workspace=frontend`
    passed, and `git diff --check` passed. Static CSS review found dark-scoped overrides for
    the workspace header, toolbar/range/filter/action/source inspection, feedback/output/footer/
    status surfaces, and the related source modal; the existing light selectors were left
    unchanged. The `LogViewer` diff preserves Search confirmation, select/X behavior, local
    filter projection, wrap/virtualization measurement and stable keys, and the single aggregate
    WebSocket path. `git diff 1a84c96` contains only `frontend/src/components/LogViewer.tsx` and
    `frontend/src/index.css`; no backend, API, Kubernetes, or package files changed. No raw
    Kubernetes response, header, credential, or kubeconfig data was found in the diff or test
    evidence. Browser/computed-contrast, keyboard, high-zoom, responsive, and reduced-motion
    evidence remains intentionally outside this automated gate and is not claimed here.

- [x] 1.2.6-IQ-1 Complete specification handoff and residual-risk audit.
  - Review requirements, design, tasks, owner assignments, implementation evidence, contrast
    results, responsive/accessibility limitations, and compatibility with v1.2.5.
  - Keep implementation tasks unchecked when their owners lack the required evidence. Name the
    next executable task IDs and preserve any residual risk. This task does not authorize commit,
    packaging, tagging, or release approval.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: RA-1.1-RA-1.5, IQ-1.1-IQ-1.5, Definition of done
  - _Dependencies: 1.2.6-RA-1, 1.2.6-DL-3, 1.2.6-DL-4
  - _Validation: final read-only specification and evidence audit plus `git diff --check`.
  - _Definition of done: the handoff names ready implementation/validation tasks and clearly
    separates proven behavior from residual risk.
  - _Evidence (2026-09-16): Handoff audit completed against requirements, design, tasks, the
    CSS diff, the `LogViewer` diff, automated checks, and scope boundaries. This is a handoff
    audit only, not release approval: 1.2.6-DL-3 and 1.2.6-DL-4 remain open because no browser
    session or computed-contrast, keyboard, responsive, reduced-motion, or 200% zoom evidence is
    available. Next gate: run the read-only browser/accessibility audit and record representative
    contrast results and viewport/zoom/focus findings before closing those tasks.

## Definition of done

- [ ] All covered LogViewer and related source surfaces are dark and free of visible light-theme
  fallback panels in dark mode.
- [ ] Contrast, hierarchy, hover/focus/disabled/live/partial/error states, search highlights,
  reduced motion, and safe feedback meet the requirements with recorded evidence.
- [ ] 320/768/1280 widths, 200% zoom where available, keyboard/accessibility behavior, and
  page-overflow isolation are validated or documented as unavailable.
- [ ] Search confirmation, select/X affordances, dense rows, filters, Wrap lines, virtualization,
  source inspection, and one-socket transport remain unchanged.
- [ ] Frontend regression and scope checks pass, with no backend, API, Kubernetes, desktop,
  packaging, or release artifact change.
- [ ] Every task is evidenced by its named owner; open evidence gaps remain explicitly open.