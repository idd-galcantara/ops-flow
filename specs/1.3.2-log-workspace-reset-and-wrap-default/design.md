# Design - ops-union v1.3.2 log workspace reset and wrap default

## Overview

The application has two related but separate UI lifecycles. `App` owns selected pods, confirmed log
sources, source-selection modal state, and the main-panel choice between the pod view and the logs
workspace. The Zustand store owns pod-query lifecycle state. The existing v0.6.3 behavior observes
normal `podsLoading` and clears selected pod details, but clearing only `selected` does not remove
`logSources`. As a result, the main panel can continue rendering `LogViewer` after a new preset has
replaced the targets.

Version 1.3.2 closes the complete stale-log state at the explicit-query boundary and changes the
initial presentation default for each new `LogViewer` from unwrapped to wrapped rows.

## Ownership boundaries

- `frontend/src/App.tsx` owns the selected pod, selected pod rows, confirmed log sources, consulted
  contexts, source modal, and the main-panel logs/pod-view boundary.
- `frontend/src/store.ts` remains the authority for target application, normal `podsLoading`, silent
  `refreshing`, request identity, query results, errors, and partial target failures.
- `frontend/src/components/LogViewer.tsx` owns the active aggregate log session and cleans it up
  when unmounted. It remains the authority for Search, Live/History state, filters, and display
  controls inside an open workspace.
- `frontend/src/logsPresentation.ts` owns the display default and wrap toggle transformation. It
  does not persist the setting or couple it to Search/session state.
- `frontend/src/components/PodDetailsPanel.tsx` retains its existing request cleanup and tab state;
  it does not become the owner of target-query reset behavior.
- `@ops-union-frontend` owns implementation and focused frontend evidence.
- `@ops-union-integration-qa` owns read-only lifecycle, responsive, accessibility, transport-cleanup,
  security, and release-scope evidence.
- No backend owner is expected because the aggregate log protocol and Kubernetes read paths remain
  unchanged.

## Query and workspace lifecycle

The reset boundary is the start of a normal explicit query, not the end of the request:

```text
logs workspace open
  -- explicit Fetch / refresh / retry / preset query starts -->
close LogViewer + clear log sources/modal/selection
  -> normal podsLoading
       -> new pod results / partial errors / request error

logs workspace open
  -- silent auto-refresh starts -->
keep LogViewer + details + display state
  -> existing refreshing behavior
```

The reset action must be centralized enough that every explicit query entry point has the same
behavior. The existing store still owns whether a query is silent or normal; `App` may observe that
normal lifecycle or receive a narrow reset signal, but the implementation must not create a second
fetch mechanism or duplicate request ownership.

When the logs workspace is closed, clearing `logSources` is the decisive render boundary because
`App` uses it to choose `LogViewer` versus the pod view. Clearing `selectedLogPods`, consulted
contexts, and any source modal prevents stale source scope from being reused by a later action.
Clearing selected pod details and row selection keeps the replacement target view coherent with the
new query. The local pod-list `filter` is also transient state for the old result set and must be
cleared at the same boundary. Existing `LogViewer` effect cleanup then closes its WebSocket and
retires old event handlers.

The reset applies to explicit preset application as part of the same normal query boundary. It must
happen before the new query result is displayed and should not wait for a successful response, since
an error or partial result cannot make the old logs valid again.

## Silent-refresh distinction

The store already separates normal loading (`podsLoading`) from silent refresh (`refreshing`). The
implementation must preserve that distinction. Silent refresh keeps the current pods and selected
view visible, so it must not clear log sources, unmount `LogViewer`, or clear the local pod-list
filter. Normal query failure and partial failure do not reopen or restore the old workspace.

The reset must also respect request identity. If an old request settles after a newer query begins,
its result remains rejected by the existing store guards and cannot repopulate the closed log state.

## Wrap-lines presentation model

`DEFAULT_LOG_DISPLAY_STATE` remains the single initialization point:

```ts
const DEFAULT_LOG_DISPLAY_STATE = {
  grouping: 'application',
  wrapLines: true,
};
```

`LogViewer` continues to own a per-instance display state initialized from that constant. The
checkbox remains an immediate presentation control. Toggling it changes row classes and triggers the
existing virtualizer measurement effect; it does not apply Search, restart a socket, clear events,
or persist user preference.

A fresh `LogViewer` receives `wrapLines: true`, including after a preset or source change. The
setting is intentionally not persisted in this release, so a newly opened workspace has a
predictable default rather than inheriting a previous workspace's manual choice.

## Compatibility matrix

| User action | Logs workspace | Pod details | Query behavior | Wrap default |
| --- | --- | --- | --- | --- |
| Fetch pods | Closed immediately | Closed | Existing normal query | Filter cleared; next workspace starts wrapped |
| Manual refresh | Closed immediately | Closed | Existing normal query | Filter cleared; next workspace starts wrapped |
| Query retry | Closed immediately | Closed | Existing normal query | Filter cleared; next workspace starts wrapped |
| Apply preset and load | Closed immediately | Closed | Existing preset/query flow | Filter cleared; next workspace starts wrapped |
| Partial or failed explicit query | Remains closed | Remains closed | Existing errors/results | Filter remains cleared; no stale workspace restored |
| Silent auto-refresh | Preserved | Preserved | Existing silent refresh | Filter and current setting preserved |
| Open a new logs workspace | New instance | Existing selection flow | Existing log flow | Checked by default |
| Toggle Wrap lines | Preserved | Preserved | No transport change | Immediate per-instance toggle |

## Validation strategy

### Focused frontend checks

- Exercise each normal explicit query entry point with logs open and assert that `logSources`, log
  selections, source modal state, selected pod state, row selection, and the pod-list filter are
  cleared before results.
- Assert that `LogViewer` cleanup runs at the reset boundary and stale log events cannot repopulate
  the replacement view.
- Exercise silent refresh with logs open and a non-empty pod-list filter and assert that the
  workspace, filter, and details remain mounted and visible.
- Assert default display state has `wrapLines: true`, the checkbox is checked on a fresh workspace,
  both toggle directions work, and grouping/search/session state is unchanged.
- Exercise long rows, placeholders, virtualization measurement, narrow width, and high zoom.

### Regression and integration checks

- Reuse existing store, preset flow, logs session, Search, History, and presentation tests.
- Run frontend tests, typecheck, build, and `git diff --check` after implementation.
- Perform read-only manual/browser or Electron validation for preset application, normal refresh,
  retry, partial/error query outcomes, silent refresh, focus, and responsive behavior.
- Record unavailable browser, Electron, screen-reader, or cluster checks as limitations rather than
  implementation evidence.
