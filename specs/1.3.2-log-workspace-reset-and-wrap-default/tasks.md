# Implementation Tasks - ops-union v1.3.2 log workspace reset and wrap default

These tasks define the stale-log reset and default wrapping handoff. They are initially unchecked:
the specification does not claim implementation, validation, release approval, or completion. No task
authorizes Kubernetes mutation, packaging, publishing, commit, or release activity.

## Ownership and sequencing

- `@ops-union-frontend` owns the App lifecycle reset, display default, and focused frontend tests.
- `@ops-union-integration-qa` owns read-only lifecycle, transport cleanup, responsive, keyboard,
  accessibility, security, and release-scope evidence.
- No backend implementation is expected; backend review is limited to confirming unchanged protocol
  and read-only boundaries.
- The repository maintainer owns final convergence of evidence and residual limitations.

## Tasks

- [x] 1.3.2-LW-1 Map the explicit-query reset boundary.
  - Confirm all normal query entry points: Fetch pods, manual refresh, retry, and preset application.
  - Confirm the existing distinction between `podsLoading` and silent `refreshing`.
  - Confirm `App` owns the stale log workspace state while the store owns query lifecycle and request
    identity.
  - Validation: source review plus existing store, preset-flow, and v0.6.3 regression tests.
  - Evidence: `frontend/src/App.tsx` owns the workspace state and `frontend/src/store.ts` owns the
    normal versus silent query lifecycle; the frontend suite passed 105 tests, including preset and
    store regression coverage.

- [x] 1.3.2-LW-2 Close complete stale logs state on explicit queries.
  - Close the main-panel logs workspace before replacement results are rendered.
  - Clear confirmed sources, selected log pods, consulted contexts, source modal state, selected pod,
    selected pod-row state, and the transient pod-list filter as required by the replacement
    boundary.
  - Preserve the existing `LogViewer` unmount cleanup and prevent stale events from crossing the
    replacement query.
  - Validation: focused frontend tests for Fetch pods, refresh, retry, preset application, partial
    results, request errors, and stale transport cleanup.
  - Evidence: `App.tsx` resets all listed UI state from the explicit-query revision before paint;
    `LogViewer` remains conditionally mounted by `logSources`, preserving unmount cleanup. The
    implementation passed frontend tests, typecheck, build, and source review. Direct mounted App/
    WebSocket cleanup coverage and interactive browser checks remain unavailable.

- [x] 1.3.2-LW-3 Preserve silent auto-refresh.
  - Keep logs, details, source scope, pod-list filter, and current presentation mounted during silent
    refresh.
  - Verify normal query cleanup does not run from `refreshing` alone.
  - Validation: focused store/App lifecycle tests and read-only manual auto-refresh check.
  - Evidence: `loadPods({ silent: true })` changes only the existing `refreshing` path and does not
    increment `explicitQueryRevision`; the focused store test passed. Interactive auto-refresh
    preservation was not available because browser automation hit a stale CDP target.

- [x] 1.3.2-LW-4 Make Wrap lines enabled by default.
  - Change the single display-state default to `wrapLines: true`.
  - Keep the current checkbox, toggle behavior, grouping, virtualization measurement, scrolling,
    Search state, and transport behavior unchanged.
  - Ensure a fresh workspace receives the default without persisting a previous instance's choice.
  - Validation: presentation tests, fresh-workspace render check, long-row visual check, and
    keyboard/pointer toggle check.
  - Evidence: `DEFAULT_LOG_DISPLAY_STATE.wrapLines` is `true`; toggle and grouping invariants passed
    in the focused presentation test. The existing native checkbox and virtualizer measurement wiring
    remain unchanged by source review. Fresh mounted-workspace, long-row visual, and keyboard/pointer
    browser checks were unavailable because browser automation hit a stale CDP target.

- [x] 1.3.2-LW-5 Run frontend regression and accessibility checks.
  - Cover source selection, LogViewer cleanup, Search, Live/History, filters, Pause, retained-event
    Clear, Group, Wrap lines, focus order, visible focus, and responsive layouts.
  - Verify no page-level horizontal overflow or overlap with wrapped rows at desktop, mobile, and
    high-zoom widths.
  - Validation: frontend test suite, typecheck, build, browser/Electron checks where available,
    and `git diff --check`.
  - Evidence: frontend tests (105 passed), frontend typecheck, frontend production build, backend
    tests (88 passed), diagnostics, and `git diff --check` passed. Headless Chrome rendered desktop,
    mobile, and 2x-scaled launchpad screenshots without visible horizontal overflow. Interactive log
    lifecycle, wrapped-row, and screen-reader checks remain unavailable due to stale CDP automation
    targets and no screen-reader tooling.

- [x] 1.3.2-LW-6 Run read-only integration and security evidence.
  - Open logs, apply a different preset, and confirm the old workspace closes before the new query
    settles.
  - Exercise explicit refresh/retry and silent refresh, including partial and error outcomes.
  - Confirm no Kubernetes mutation, new permission, credential/kubeconfig exposure, packaging, or
    release action occurred.
  - Validation: read-only integration QA record with environment, commands, evidence counts, and
    explicit unavailable checks.
  - Evidence: read-only QA used contexts `kubernetes-qa-tb` and `kubernetes-qa-gt`; fan-out returned
    17 annotated pods, partial failure preserved valid results plus a scoped error, describe and
    metrics returned successfully, the log WebSocket emitted `started`, and backend health reported
    `readOnly: true`. No mutation, package, publish, commit, or release action occurred. The cluster
    identity has some mutation-capable RBAC permissions, so read-only safety remains application-
    enforced; interactive preset/refresh/retry and silent-refresh browser evidence is unavailable.

## Validation record

Implementation owners SHALL append evidence here only after the corresponding task is actually
validated. A checked task requires concrete test or source evidence and SHALL record residual
limitations; it does not imply release approval.

- Frontend focused tests: 105 passed (`npm --prefix frontend test -- --run`).
- Store/preset/log-session regression tests: passed within the frontend suite; backend suite also
  passed with 88 tests.
- Frontend typecheck/build: passed; `git diff --check` passed.
- Read-only integration and accessibility evidence: read-only Kubernetes and headless responsive
  checks passed; interactive log lifecycle automation and screen-reader checks unavailable as noted
  above.
- Packaging, publishing, commit, and release: intentionally out of scope for this handoff.

## Definition of done

- Explicit target queries and preset application close stale log state before replacement results.
- Silent auto-refresh preserves the current logs workspace and details.
- New LogViewer instances start with `Wrap lines` checked and remain manually toggleable.
- Transport cleanup, stale-response protection, Search/History behavior, accessibility, and
  read-only boundaries are covered by focused evidence.
- Residual browser, Electron, cluster, or assistive-technology limitations are recorded honestly.
- This task list does not authorize implementation beyond the scoped change, commit, packaging, or
  release publication.
