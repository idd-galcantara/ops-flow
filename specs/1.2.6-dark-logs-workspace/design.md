# Design - ops-union v1.2.6 dark logs workspace

## Overview

The existing dark-theme token block in `frontend/src/index.css` correctly changes the global
canvas, field, surface, and semantic colors, but the dedicated logs rules still contain light
fixed colors. The logs workspace therefore mixes dark output with light header/toolbar/summary/
footer regions, white filter shells, low-separation borders, and light validation/partial
surfaces. The source-selection modal used by the logs flow has the same risk in its fixed-color
rules.

This design is a presentation correction. It routes covered logs surfaces through the established
dark semantic tokens, adds narrowly scoped overrides for log-specific fixed colors, and verifies
contrast/state behavior without changing JSX state ownership, markup contracts, or transport.

## Ownership boundaries

- `frontend/src/index.css` owns dark tokens or dark selectors for workspace surfaces, controls,
  field borders, hover/focus/disabled states, status variants, feedback, output highlights, modal
  surfaces, responsive overflow, and reduced-motion-safe presentation.
- `frontend/src/components/LogViewer.tsx` remains the authority for draft/applied Search state,
  filter/X behavior, Group and Wrap lines, Pause, retained-event Clear, source inspection markup,
  live status, validation/partial feedback, virtualization, and the aggregate WebSocket effect.
  No state or event-flow change is planned.
- `frontend/src/components/ApplicationLogSourceModal.tsx` remains the authority for source
  selection, stale/partial/loading/empty states, confirmation, and read-only modal behavior. Its
  dark styling is owned by the stylesheet, not by a second theme state.
- Existing `frontend/src/logsSearch.ts`, `logsSession.ts`, `logsPresentation.ts`, `logsRange.ts`,
  `types.ts`, and backend contracts remain authoritative for search classification, retained
  records, row density, wrap/virtualization, range semantics, timestamps, limits, safe errors,
  and transport.
- `@ops-union-frontend` owns stylesheet implementation and focused frontend evidence.
- `@ops-union-integration-qa` owns contrast inspection, responsive/keyboard/accessibility smoke,
  regression, security, and scope evidence.
- `@ops-union-backend` has no implementation work in this release. It is not a dependency unless
  an unexpected contract regression is discovered; this specification authorizes no backend fix.

## In-scope surface inventory

The dark styling audit SHALL cover these existing surfaces and their state variants:

```text
Dedicated workspace:
  .log-workspace-header
  .log-toolbar, .log-toolbar-range, .log-structured-filters
  .log-control, .log-filter-select, .log-filter, .log-toolbar-actions
  .log-range-summary
  .log-source-inspection and .log-source-inspection-list
  .log-viewer .feedback-error
  .log-validation-error and .log-partial-summary
  .log-output, .log-output-inner, .structured-log-line, .log-source-cell,
  .log-message, .log-mark, .log-empty
  .log-footer and .log-state-* variants

Related source surface:
  .source-modal, .source-modal-header, .source-scope-summary,
  .source-details, .source-modal-toolbar, .source-modal-search,
  .source-tree, .source-tree-root, .source-tree-row, .source-tree-container,
  .source-modal-warning, .source-modal-partial, modal feedback/empty/loading states,
  .source-modal-footer and modal action states
```

The audit may use shared dark selectors where they are already established, but it SHALL not
expand into an unrelated global component redesign.

## Token and contrast strategy

1. Keep the existing dark semantic vocabulary (`--ink`, `--muted`, `--line`, `--surface`,
   `--surface-subtle`, `--surface-muted`, `--field`, `--hover`, `--text-soft`, `--accent`,
   `--ok-*`, `--warn-*`, `--error-*`, and `--line-strong`) as the first choice. Add a token only
   when a log-specific role cannot be represented without coupling unrelated components.
2. Replace log-local light literals with semantic dark tokens or dark-scoped equivalents. The
   output may retain its intentionally deep background, but message, source identity, empty text,
   and marks must be checked as a set against that actual background.
3. Preserve hierarchy: `--ink` for primary meaning, `--text-soft`/`--muted` for supporting
   metadata, `--field` for controls, `--surface-subtle` for secondary regions, and `--hover` for
   interaction feedback. Borders use `--line` or `--line-strong` according to adjacency.
4. Use the numeric acceptance thresholds from DL-2: 4.5:1 for normal text, 3:1 for qualifying
   large text and required non-text boundaries/focus indicators. Contrast checks must use computed
   colors after `[data-theme='dark']` selectors are applied, not token names alone.
5. Error, warning, partial, live, paused, ended, and loading treatments retain their text labels
   and status semantics. Color and animation are secondary cues, not the state contract.

## Surface/state contract

### Workspace header, toolbar, summary, and footer

- `.log-workspace-header`, `.log-toolbar`, `.log-range-summary`, `.log-source-inspection`, and
  `.log-footer` use deliberate dark surface tiers with a visible divider between adjacent regions.
- Labels, contexts, range values, counts, and source identities use readable supporting text; the
  workspace identity, Search action, and current status retain stronger hierarchy.
- Selects and inputs use the dark field token, dark border, readable value/placeholder, and a
  focus ring that remains visible against both field and toolbar.
- Existing selected structured selects keep `appearance: none` only in their selected state and
  keep the field-local X. Empty selects keep the native arrow. Dark styling may recolor the shell
  and focus treatment only.
- Hover and disabled styles must preserve text/icon contrast. Search busy/disabled remains a
  native disabled control and does not become visually or semantically enabled through styling.

### Status, validation, partial, and live feedback

- Map state surfaces to dark semantic pairs: readable foreground, sufficiently distinct surface,
  and a visible border where the surface meets the workspace. Keep the existing status labels,
  `role="status"`, `aria-live`, and `role="alert"` behavior.
- The streaming/live pulse may remain, but `live`, `paused`, `partial`, `error`, `ended`, and
  `connecting` must be identifiable from their text/structure when motion is disabled.
- Validation errors and partial summaries must preserve readable strong lead text and wrapped
  detail text. Their content remains safe user-facing text only.

### Output and dense rows

- Keep `.log-output` as the owned scroll container and retain the v1.2.5 two-area row:

  ```text
  [ bounded pod/container identity ] [ shrinkable selectable message ]
  ```

- Do not reintroduce timestamp or cluster/namespace cells. Dark colors apply to the existing
  compact source identity and selectable message, including long/empty/wrapped/no-wrap content.
- Search marks use a dark-output-compatible foreground/background pair with readable text. No
  color change may affect `white-space`, `overflow-wrap`, row measurement, stable keys, or
  virtualization.

### Related source inspection modal

- Keep the modal's existing hierarchy: header and scope summary, details disclosure, search/tree,
  warning/partial feedback, and footer actions. Each region receives an intentional dark tier and
  remains readable when expanded or narrowed.
- Tree rows and disclosure/checkbox controls use dark hover/focus states. Selection, indeterminate
  state, stale blocking, refresh, cancel, and confirm behavior remain unchanged.
- Modal shadow/backdrop may remain distinct from the global shell, but the modal itself SHALL not
  use a light panel that creates a theme discontinuity.

## Responsive, focus, and motion contract

- Preserve existing responsive breakpoints and reflow boundaries from v1.2.2-v1.2.5. Dark rules
  must not introduce fixed widths, page-level overflow, or an internal split of filter/X fields or
  the Group/Search cluster.
- Check 320, 768, and 1280 CSS px widths, long source/context/status strings, selected filters,
  validation/partial feedback, expanded inspection, and long no-wrap messages.
- Use the existing visible focus pattern, ensuring focus rings are not lost against dark fields or
  clipped by `overflow: hidden`. Check keyboard order and native focus without changing markup.
- Validate at 200% zoom where available. Respect `prefers-reduced-motion`; no new animation is
  required and the existing pulse cannot be the sole live-state cue.

## Tradeoffs

Centralizing the fix in dark tokens and LogViewer-scoped selectors minimizes behavioral risk and
keeps light mode stable. A few log-specific colors may remain distinct from the broader token set
because the output background and search highlight need specialized readability, but each such
pair must be justified by its actual contrast check. The modal is included because it is the source
inspection path for logs; unrelated application surfaces remain outside this release.

## Validation strategy

### Focused frontend checks

- Audit the CSS for covered fixed light literals and confirm every listed surface has a dark rule.
- Run `npm test --workspace=frontend`, `npm run typecheck --workspace=frontend`,
  `npm run build --workspace=frontend`, and `git diff --check`.
- Confirm no LogViewer JSX/state, Search boundary, select/X markup, row structure, virtualization,
  or transport code changed unless a test demonstrates a presentation-only necessity.

### Read-only visual/accessibility checks

- At 320, 768, and 1280 CSS px, inspect header, toolbar, range summary, all filters/selects/
  inputs, action row, source inspection, validation/partial states, output, and footer in dark mode.
- Exercise empty/selected select states, pending/applied/busy Search, hover/focus/disabled/live/
  partial/error states, source-modal loading/stale/empty/partial/ready states, long text, expanded
  inspection, no-wrap/wrap output, and text selection.
- Measure representative computed foreground/background pairs with a contrast tool or documented
  equivalent. Include compact mono text, input/placeholder text, status/feedback, highlights,
  borders, and focus indicators.
- Check keyboard order, accessible names, high zoom, reduced motion, no page overflow, and output-
  scoped no-wrap scrolling. Record unavailable browser/AT tooling as limitations.

### Scope and safety checks

- Confirm only the intended frontend stylesheet/presentation files and this spec are changed.
- Do not run Kubernetes mutations, expose kubeconfig/credentials/raw response data, commit,
  package, or publish a release as part of this specification.