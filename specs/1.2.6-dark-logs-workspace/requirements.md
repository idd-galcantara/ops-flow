# Requirements - ops-union v1.2.6 dark logs workspace

## Scope

Version 1.2.6 corrects the dark-theme presentation of the dedicated logs workspace. The current
theme tokens darken the surrounding shell, but several `LogViewer` surfaces retain light-theme
backgrounds, borders, labels, controls, and feedback colors. This makes the workspace look split
between light and dark panels and reduces readability.

This is a frontend-only presentation release. It covers the dedicated logs workspace, its
LogViewer feedback and status surfaces, and the application log-source inspection modal when it
is opened as part of the logs flow. It does not redesign the global dark theme, change light-theme
appearance, change component behavior, or alter backend/API/Kubernetes/desktop contracts.

The v1.2.5 select-affordance and dense-row contracts remain authoritative. Search confirmation,
row density, local filters, Wrap lines, virtualization, source scope, and aggregate transport
behavior SHALL remain unchanged.

## User stories

- As a logs user, I can read the workspace header, toolbar, range summary, source inspection,
  statuses, feedback, output, and footer as one coherent dark surface.
- As a logs user, I can distinguish primary text, metadata, fields, dividers, hover/focus states,
  disabled controls, live states, validation errors, and partial failures without guessing from
  color or encountering light panels.
- As a keyboard or assistive-technology user, I can operate the existing controls with visible
  focus and understand their current state in dark mode.
- As a responsive logs user, I can use the workspace at narrow, tablet, desktop, and high-zoom
  widths without overlap, clipped labels, or page-level horizontal overflow.

## Glossary

- **Workspace surface:** A visible region owned by `LogViewer`, including the workspace header,
  toolbar, range summary, source inspection, feedback, output, and footer.
- **Related source surface:** The application log-source modal and its summary, toolbar, tree,
  warning/partial feedback, and footer when reached from the logs workflow.
- **Primary text:** Workspace identity, log message text, control values, and other content that
  carries the main meaning of a surface.
- **Supporting text:** Labels, metadata, counts, range details, source identities, and live status
  text that remains necessary to interpret the workspace.
- **State indicator:** A status, border, icon, label, or live region representing loading,
  validating, connecting, streaming/live, paused, ended, partial, error, disabled, pending, or
  applied state.

## Requirements

### DL-1 - Coherent dark workspace surfaces

1. WHEN the application shell has `data-theme="dark"` THEN every in-scope workspace surface SHALL
   use dark-theme surface, field, border, and text tokens or an explicitly documented dark
   semantic equivalent; no light `#fff`, `#fafbfc`, `#f1f3f6`, or equivalent light fallback SHALL
   remain visible in the covered logs flow.
2. The workspace header SHALL present the identity, contexts, counts, range, status, and actions
   with a consistent dark background and divider hierarchy. Identity text SHALL remain stronger
   than context/count metadata without reducing metadata to unreadable gray.
3. The toolbar SHALL present the period/range controls, Follow, structured filters, Message input,
   Clear filters, Group, Search, status, Wrap lines, Pause, and retained-event Clear as one dark
   control system. The range summary SHALL remain visually related to the toolbar while retaining
   its existing separate region.
4. The source inspection disclosure and expanded source list SHALL use dark surfaces, readable
   source identities, visible dividers, and dark hover/focus treatment. Long source identities
   SHALL remain bounded and inspectable without creating page-level horizontal overflow.
5. The output SHALL remain a dark log surface with readable message text and search highlights.
   The v1.2.5 compact pod/container identity plus remaining-width message layout SHALL remain
   intact; this requirement does not restore timestamp or cluster/namespace columns.
6. The footer SHALL use a dark surface and readable retained/emitted/dropped/paused/terminal
   summaries. `Jump to latest`, when present, SHALL remain distinguishable as an action.
7. The `.log-viewer` feedback error, validation error, partial-source summary, empty state, and
   all related loading/terminal surfaces SHALL be dark-compatible and shall not expose raw
   Kubernetes response bodies, headers, credentials, or kubeconfig data.
8. When the related source surface is opened from the logs flow, its modal header, scope summary,
   source details, search toolbar, tree, warning/partial feedback, empty/loading/error states,
   and footer SHALL follow the same dark surface hierarchy and SHALL not revert to light panels.

### DL-2 - Contrast and legibility

1. In dark mode, normal-size primary and supporting text in the covered logs surfaces SHALL meet
   at least WCAG 2.2 AA contrast of 4.5:1 against its immediate background. Large text MAY use the
   3:1 threshold only when it meets the applicable large-text size/weight definition.
2. Log message text, pod/container identity, control values, input text, select text, Search
   confirmation text, validation text, partial-failure text, and live status text SHALL use the
   4.5:1 normal-text threshold even when rendered in the compact mono typography.
3. Borders, dividers, field boundaries, selected/active indicators, status dots when they convey
   state, and visible focus indicators SHALL meet at least 3:1 against adjacent colors where they
   are necessary to identify a control, boundary, or state. Focus SHALL remain identifiable in
   both dark surfaces and dark fields.
4. Primary/supporting hierarchy SHALL remain perceptible through brightness, weight, placement,
   or size in addition to hue. No required state, error, partial result, or action SHALL be
   conveyed by color alone.
5. Search highlights SHALL preserve readable message and highlight text contrast in both ordinary
   and focused/selected output. Highlighting SHALL not make matched text disappear into the dark
   output background.
6. Disabled controls SHALL remain visibly disabled without becoming indistinguishable from their
   dark background; their disabled state SHALL be available through native semantics and SHALL not
   be the only way to understand whether Search can be activated.
7. The implementation SHALL preserve the existing light-theme tokens and appearance. Dark-theme
   corrections SHALL be scoped to dark selectors/tokens and SHALL not require changing the
   Search, filter, row, or transport semantics.

### DL-3 - Interaction states and live feedback

1. WHEN a covered button, select, input, disclosure, or source-tree control is hovered THEN its
   dark hover surface and text SHALL remain distinguishable and SHALL not reduce the required
   contrast of its label or icon.
2. WHEN a covered control is focused by keyboard THEN its focus ring SHALL be visible against
   both its control surface and its surrounding dark surface, SHALL not be clipped, and SHALL
   meet the DL-2 non-text contrast requirement.
3. The empty/All versus selected structured-select treatment from v1.2.5 SHALL remain intact:
   native arrow visibility, selected-state X visibility, stable geometry, field-local clearing,
   accessible names, and focus behavior SHALL not change as a result of dark styling.
4. The Message filter, range inputs, Group select, Follow, Wrap lines, Pause, retained-event
   Clear, source inspection disclosure, source-modal controls, and `Jump to latest` SHALL retain
   their existing keyboard order, native semantics, accessible names, and dark visible states.
5. Pending Search, applied Search, Search busy/disabled, validating, connecting, streaming/live,
   paused, ended, partial, error, loading, stale, empty, and validation-rejected states SHALL each
   retain a readable text label or accessible status. Their dark visual treatment SHALL not alter
   state transitions, live-region behavior, or the Search confirmation boundary.
6. Live and partial feedback SHALL remain distinguishable from ordinary metadata and from one
   another through text/icon/status treatment as well as color. Partial failure SHALL not make
   successful sources or retained output unreadable.
7. Reduced-motion users SHALL receive the same state information without depending on animation;
   any existing live pulse SHALL be optional decoration and SHALL not be required to identify a
   streaming state.

### DL-4 - Responsive and zoom-safe layout

1. At 320 CSS px, 768 CSS px, and 1280 CSS px viewport widths, the covered logs workspace and
   related source surface SHALL remain readable, non-overlapping, and free of page-level
   horizontal overflow.
2. Responsive reflow SHALL happen at existing complete fields, toolbar groups, source-summary
   regions, tree rows, and footer/action groups. A field's label/control/X unit, the Group/Search
   cluster, and icon-button targets SHALL not split internally.
3. Long workspace identity, contexts, range summaries, source identities, validation text,
   partial-failure text, retained-event summaries, and log messages SHALL wrap, truncate, or
   scroll within their owning surface without hiding required meaning or causing adjacent text to
   overlap.
4. Intentional no-wrap log-message movement SHALL remain scoped to `.log-output`; dark-theme
   styling SHALL not move horizontal scrolling to the page or toolbar. Wrapped rows SHALL retain
   the v1.2.5 measurable-height behavior.
5. At browser zoom of 200% where supported, all required controls, labels, focus indicators,
   status announcements, and footer actions SHALL remain reachable and legible. No required
   interaction SHALL depend on hover.
6. Dark styling SHALL not change the established row density, virtualized output height/scroll
   ownership, source inspection expansion behavior, toolbar order, or modal responsive behavior.

### DL-5 - Behavioral, transport, and scope preservation

1. Search SHALL remain the only action that applies draft period, range, Follow, or local filter
   changes. Dark styling SHALL not submit Search, reconnect the aggregate log session, clear
   retained events, or change applied filters.
2. Pod, Container, Cluster, Namespace, and Message filters SHALL preserve their existing AND
   semantics over retained events, option values, pending/applied distinction, and field-local or
   global clearing behavior.
3. The v1.2.5 dense row SHALL retain selectable messages, search highlighting, no-wrap/wrap,
   grouping, stable virtualization keys/measurement, bounded retention, scroll, auto-scroll,
   jump-to-latest, and timestamp data in the existing record/payload contract.
4. The aggregate logs flow SHALL continue to use one WebSocket for the applied subscription;
   presentation-only dark changes SHALL not add sockets or alter subscription payloads, limits,
   cancellation, source lifecycle, partial failures, safe errors, or legacy per-pod compatibility.
5. The source inspection and related modal SHALL remain read-only. No new backend endpoint,
   Kubernetes permission, mutation path, authentication behavior, renderer filesystem access, or
   kubeconfig persistence SHALL be introduced.

### RA-1 - Regression and safety boundaries

1. Focused frontend checks SHALL cover dark selectors/tokens and all in-scope LogViewer states,
   including the light-theme preservation boundary where the existing test architecture supports
   it.
2. Existing logs search, session, presentation, range, source-scope, modal, virtualization, and
   compatibility coverage SHALL continue to pass after implementation.
3. Read-only validation SHALL inspect contrast, focus, hover/disabled/live states, responsive
   overflow, high zoom, reduced motion, search confirmation, select/X behavior, row density,
   filters, wrapping, virtualization, and one-socket preservation without Kubernetes mutation.
4. No raw Kubernetes response body, response headers, credentials, or kubeconfig data SHALL be
   introduced into visible output, accessibility text, screenshots, logs, or validation evidence.
5. This specification SHALL not mark implementation complete based only on a static plan; each
   task owner SHALL record executable or explicitly documented visual evidence.

### IQ-1 - Read-only acceptance gate

1. Validation SHALL prove that every listed workspace region is dark in dark mode: header, toolbar,
   range summary, filters/selects/inputs, action row, source inspection, validation/partial
   feedback, output, footer, and any related clear LogViewer surface.
2. Validation SHALL measure or otherwise document WCAG AA contrast for representative primary,
   supporting, input, status, error/partial, highlight, border, and focus combinations, including
   the smallest compact log text and selected/disabled states.
3. Validation SHALL prove readable hover/focus/disabled/live/partial/error states, visible focus,
   keyboard order, accessible names, and no dependence on color or animation alone.
4. Validation SHALL prove that Search confirmation, select/X behavior, row density, local filters,
   Wrap lines, virtualization, text selection, source inspection, and one-socket transport remain
   unchanged after dark styling.
5. Responsive validation SHALL cover 320, 768, and 1280 CSS px widths, 200% zoom where supported,
   reduced motion, narrow source/modal states, long text, pending Search, and page-overflow
   isolation. Unsupported browser or assistive-technology checks SHALL be recorded as limitations.

## Definition of done

- The complete covered logs flow uses coherent dark surfaces with no visible light fallback panels
  or controls in dark mode.
- Primary/supporting text, controls, states, highlights, boundaries, and focus indicators meet the
  specified contrast and legibility criteria, with state information not dependent on color alone.
- Hover, focus, disabled, live, partial, validation, loading, empty, and terminal states remain
  understandable and accessible.
- 320/768/1280 widths, high zoom, reduced motion, long text, and output-scoped no-wrap scrolling
  are validated or documented as unavailable limitations.
- Search confirmation, select/X affordances, dense rows, filters, wrap, virtualization, source
  inspection, and aggregate transport remain behaviorally unchanged.
- Only frontend presentation work is authorized; no backend, API, Kubernetes, desktop, packaging,
  or release artifact work is implied.
- Named owners record focused automated and read-only visual/accessibility evidence in the tasks.