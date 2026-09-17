# Implementation Tasks - ops-union v0.6.1 dark-mode readability

## Phase 1 - Contrast correction

- [x] 1.1 Audit the dark-theme token block and identify low-contrast fixed text colors.
  - Compare dark surfaces with primary, secondary, label, and metadata text.
  - _Copilot agent: @ops-union-frontend_
  - _Requirements: 1.1-1.3, 2.2_

- [x] 1.2 Raise dark-theme surface and semantic text tokens.
  - Increase separation between canvas, panels, fields, hover states, and borders.
  - Strengthen `--ink`, `--muted`, and `--text-soft` without changing the light theme.
  - _Copilot agent: @ops-union-frontend_
  - _Requirements: 1.1-1.3, 2.1, 2.3_

- [x] 1.3 Apply the stronger dark tokens to labels and supporting content.
  - Cover eyebrows, table headings, detail and metric labels, technical values, messages, and
    preset metadata.
  - Preserve the existing hierarchy instead of making every text element bold.
  - _Copilot agent: @ops-union-frontend_
  - _Requirements: 1.2, 2.1, 2.2_

## Phase 2 - Regression gate

- [x] 2.1 Run frontend typecheck and tests.
  - `npm run typecheck --workspace=frontend`
  - `npm test --workspace=frontend`
  - Evidence: typecheck passed; 54 frontend tests passed.
  - _Copilot agent: @ops-union-integration-qa_
  - _Requirements: 3.1-3.3_

- [x] 2.2 Review the focused diff and CSS diagnostics.
  - Confirm the change remains in the frontend stylesheet and adds no product-boundary changes.
  - Evidence: `git diff --check` passed; CSS diagnostics reported no errors.
  - _Copilot agent: @ops-union-integration-qa_
  - _Requirements: 3.1-3.3_

- [x] 2.3 Run the visual smoke test at desktop and narrow viewport sizes.
  - Inspect the pod table, details panel, forms, preset library, and responsive layout in dark
    mode, then confirm the light mode remains unchanged.
  - _Copilot agent: @ops-union-integration-qa_
  - _Requirements: 1.1-1.3, 2.1-2.3_

## Definition of done

- Dark-mode text and surfaces meet the readability requirements.
- Automated frontend validation passes.
- The manual visual smoke test is completed before closing this specification.