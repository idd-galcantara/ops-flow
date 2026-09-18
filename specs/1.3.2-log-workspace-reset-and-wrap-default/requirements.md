# Requirements - ops-union v1.3.2 log workspace reset and wrap default

## Scope

Version 1.3.2 fixes two frontend behaviors in the logs workspace. First, applying a new preset or
starting another explicit pod query SHALL close the current logs workspace so output from the old
source selection cannot remain visible while the new targets are loading. Second, new logs
workspaces SHALL start with `Wrap lines` enabled by default.

This specification extends the intent of v0.6.3, which closes stale pod details on normal fetch,
by covering the separate logs-workspace state owned by `App`. It preserves silent auto-refresh,
read-only Kubernetes access, existing source selection, Search behavior, History behavior, and
log presentation controls after the workspace is reopened.

## User stories

- As a logs user, when I apply another preset, I return to the target/pod view instead of keeping
  the previous logs workspace mounted during the new query.
- As a logs user, when I explicitly fetch a new target set, I do not see stale logs from the prior
  target set while the request is loading, failing, or returning partial results.
- As a logs user, I want new log output to wrap long messages by default so the full message is
  readable without changing a control first.
- As a logs user, I can still turn `Wrap lines` off for the current workspace.
- As a platform operator, I can rely on the existing read-only query and log-session boundaries.

## Glossary

- **Logs workspace:** The main-panel `LogViewer` state opened for confirmed log sources.
- **Explicit pod query:** A normal `loadPods()` operation started by Fetch pods, manual refresh,
  retry, or preset application. It excludes silent auto-refresh.
- **Preset application:** The operation that applies a saved target combination and loads its pods.
- **Stale log state:** `logSources`, selected log pods, consulted log contexts, or a source modal
  associated with the target set before an explicit query.
- **Pod list filter:** The local text filter applied to the currently loaded pod table. It is
   transient result-view state and is not a backend query parameter.
- **Wrap lines:** The presentation control that allows log rows to use multiple visual lines.
- **New logs workspace:** A `LogViewer` instance mounted after a logs workspace has been closed or
  a new source selection has been confirmed.

## Requirements

### LW-1 - Close stale logs on explicit target changes

1. WHEN an explicit pod query starts THEN the application SHALL close any open logs workspace
   immediately, before the new pod result is presented.
2. The rule SHALL apply to Fetch pods, manual refresh, query retry, and preset application followed
   by a pod query.
3. Closing the logs workspace SHALL clear the confirmed log sources and selected log pods, clear
   consulted log contexts, and close any open application log-source modal associated with the old
   result.
4. Closing the logs workspace SHALL unmount the active `LogViewer` so its existing cleanup closes
   the aggregate log transport and prevents old events from remaining visible.
5. The application SHALL also clear stale selected pod details and pod-row selection when the
   explicit query replaces the target set.
6. The application SHALL clear the Pod list filter when an explicit query starts, so text entered
   for the previous result set is not carried into the replacement result set.
7. If no logs workspace or pod-details panel is open, starting an explicit query SHALL have no
   additional visible effect beyond the existing loading state.

### LW-2 - Preserve silent refresh and query outcomes

1. WHEN silent auto-refresh starts THEN the application SHALL keep the current logs workspace,
   selected sources, selected pod details, and presentation state visible.
2. Silent auto-refresh SHALL preserve the current Pod list filter and SHALL not clear it.
3. Silent auto-refresh SHALL continue using the existing `refreshing` path and SHALL not be treated
   as an explicit query solely to force workspace closure.
4. After an explicit query succeeds, returns partial target errors, or fails at the request level,
   the old logs workspace SHALL remain closed; the result view SHALL represent only the new query
   state.
5. Existing request identity, stale-response rejection, cancellation, loading, error, and partial
   result behavior SHALL remain authoritative.
6. Applying a preset SHALL continue to use the existing preset application and `loadPods()` flow;
   this requirement does not authorize a second fetch or a separate log reset transport.

### LW-3 - Default wrapped log output

1. Each newly mounted logs workspace SHALL initialize `Wrap lines` as enabled.
2. The checked state SHALL be visible and accessible through the existing `Wrap lines` control.
3. The user SHALL be able to disable and re-enable wrapping immediately for the current workspace.
4. Changing the default SHALL not alter grouping, Search draft/applied values, filters, Follow,
   Pause, retained events, source scope, transport behavior, or History query semantics.
5. A log workspace reopened for a new source selection SHALL receive the default wrapped state;
   the prior workspace's manual toggle SHALL not leak into the new instance unless persistence is
   explicitly added by a future specification.
6. Wrapped rows SHALL remain compatible with existing virtualization, row measurement, scrolling,
   placeholders, and narrow/high-zoom layout behavior.

### LW-4 - Accessibility and visual integrity

1. Closing a logs workspace during an explicit query SHALL not leave focus on a detached control or
   expose stale log status to assistive technology.
2. The next rendered target/pod view SHALL retain a logical focus order and existing loading/error
   announcements.
3. The `Wrap lines` checkbox SHALL retain its accessible name, keyboard operation, visible focus,
   and correct checked state.
4. Wrapped and unwrapped output SHALL avoid overlap, clipped text, unstable control geometry, and
   page-level horizontal overflow at supported desktop, tablet, mobile, and high-zoom widths.
5. No raw Kubernetes response body, headers, credentials, kubeconfig value, or filesystem path
   SHALL be introduced into reset, loading, or presentation feedback.

### LW-5 - Compatibility and read-only boundaries

1. Existing v0.6.3 stale-details behavior SHALL remain intact for normal pod queries, while this
   specification adds coverage for the separate logs-workspace state.
2. Existing v1.2.3 Search confirmation and v1.3.0 Live/History behavior SHALL remain unchanged
   after a logs workspace is opened again.
3. Existing source tuples, aggregate log transport, bounded retention, limits, cancellation,
   partial failures, stale-generation rejection, and legacy per-pod compatibility SHALL remain
   intact.
4. The change SHALL not add a backend route, Kubernetes permission, mutation path, arbitrary
   command execution, authentication behavior, or filesystem access from the renderer.

### RA-1 - Regression and safety boundaries

1. Tests SHALL prove that explicit Fetch pods, refresh, retry, and preset application close stale
   logs before the new result is shown.
2. Tests SHALL prove that silent auto-refresh leaves logs mounted and visible.
3. Tests SHALL prove that the active log transport is cleaned up when the workspace closes and that
   stale output cannot reappear after a replacement query.
4. Tests SHALL prove that `Wrap lines` defaults to checked, can be toggled both ways, and does not
   change grouping or search/session state.
5. This specification SHALL not authorize source-code implementation, commit, packaging, release,
   or completion of implementation without recorded evidence.

### IQ-1 - Integration acceptance gate

1. Read-only validation SHALL open logs, apply another preset, and confirm that the old workspace
   closes before the new pod query completes.
2. Validation SHALL exercise Fetch pods, manual refresh, retry, partial/error results, and silent
   auto-refresh, confirming the different close/preserve behavior.
3. Validation SHALL open a new logs workspace and confirm `Wrap lines` is checked, long messages
   wrap without overlap, and the control can be toggled with keyboard and pointer input.
4. Validation SHALL cover desktop, narrow, and high-zoom layouts where browser or Electron tooling
   is available.
5. Kubernetes validation SHALL remain read-only; no mutation, packaging, publishing, or release
   action is part of this acceptance gate.

## Definition of done

- Explicit target queries and preset application close stale logs and related selection state before
  the replacement result is shown.
- Silent auto-refresh preserves the active logs workspace and details.
- New logs workspaces start with `Wrap lines` enabled and users can still toggle it.
- Log transport cleanup, stale-response protection, Search/History behavior, accessibility, and
  read-only boundaries remain intact.
- Focused frontend tests, typecheck/build checks, and documented read-only validation evidence are
  recorded by the named owners.
- This specification changes no product source code, does not alter earlier specification history,
  and does not authorize commit, packaging, or release publication.
