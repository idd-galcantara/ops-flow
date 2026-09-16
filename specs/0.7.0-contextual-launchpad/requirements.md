# Requirements - ops-flow v0.7.0 contextual launchpad

## Scope

This specification defines contextual actions for the empty unified-view area. The launchpad helps
users reach saved presets or start the next pod query without changing the existing read-only
Kubernetes flow, preset persistence, or target-selection behavior.

## Glossary

- **Launchpad:** The contextual empty-state content rendered in the main unified-view panel.
- **Preset shortcut:** A compact action for applying one saved preset and loading its pods.
- **Initial state:** No targets are selected and no pod query is in progress.
- **Ready state:** At least one target is selected, no pod query is in progress, and no pods are
  currently displayed.
- **Recently used preset:** A preset with a persisted `lastUsedAt` timestamp set when the user
   applies it.

## Requirements

### Requirement 1 - Make the initial empty space actionable

1. WHEN the application has no targets, no pods, and no active pod query THEN the main panel SHALL
   show a launchpad explaining that the user can open a saved preset or build a view from the
   sidebar.
2. WHEN the launchpad is shown THEN it SHALL provide an `Open presets` action that opens the
   existing preset library, preserving its search, edit, apply, and persistence behavior.
3. IF saved presets exist THEN the launchpad SHALL show a compact list of available preset
   shortcuts, limited to a small number suitable for the empty state.
4. WHEN the user activates a preset shortcut THEN the application SHALL reuse the existing
   apply-preset-then-load flow, including loading, partial target errors, request errors, and
   active-preset state.
5. IF no saved presets exist THEN the launchpad SHALL omit the shortcut list and SHALL direct the
   user toward selecting targets in the sidebar.

### Requirement 2 - Make selected targets immediately actionable

1. WHEN one or more targets are selected, no pods are displayed, and no query is running THEN the
   main panel SHALL show a ready-to-query state.
2. The ready-to-query state SHALL provide a `Fetch pods` action that invokes the existing
   `loadPods` operation for the current targets.
3. The ready-to-query state SHALL communicate the number of targets that will be queried.
4. The action SHALL respect the existing loading state and SHALL be disabled while a query is in
   progress.

### Requirement 3 - Preserve contextual result states

1. WHEN a pod query has completed with no pods THEN the existing no-results explanation SHALL
   remain available, with retry or target-adjustment actions where the surrounding UI already
   provides them.
2. WHEN a filter produces no visible pods THEN the existing filter-specific empty state SHALL
   remain distinct from the initial launchpad and ready-to-query state.
3. WHEN a request-level error occurs THEN the existing error and retry behavior SHALL remain
   authoritative; the launchpad SHALL NOT hide or replace that error.
4. WHEN pods are loading THEN the existing loading state SHALL take priority over the launchpad.

### Requirement 4 - Preserve product boundaries and accessibility

1. The change SHALL remain frontend-only and SHALL reuse the existing Zustand store, preset
   library, preset persistence, and pod query operations.
2. The change SHALL NOT add Kubernetes mutation operations, backend routes, or renderer filesystem
   access.
3. Every launchpad action SHALL be a keyboard-accessible button with an accessible name and a
   visible focus state.
4. Applying a preset from a shortcut SHALL not create a second query mechanism or bypass the
   existing request/error lifecycle.
5. The launchpad SHALL remain usable at desktop and narrow responsive layouts without overlapping
   text or controls.

### Requirement 5 - Prioritize recently used presets

1. The preset model SHALL support an optional `lastUsedAt` timestamp without invalidating presets
   saved by earlier versions.
2. WHEN a user applies a valid preset from the library or a launchpad shortcut THEN the system
   SHALL update that preset's `lastUsedAt` value and persist the updated preset collection using
   the existing web or desktop preset storage path.
3. The preset library and the launchpad shortcut list SHALL use the same ordering: most recently
   used presets first, followed by presets that have never been used.
4. WHEN two presets have equal or missing usage timestamps THEN the system SHALL preserve their
   existing relative order.
5. The launchpad SHALL choose its bounded shortcut list after applying the recently-used ordering.
6. Creating, editing, opening the library, or deleting a preset SHALL not update `lastUsedAt` for
   another preset.
7. The web and desktop implementations SHALL persist the same preset shape and SHALL require no
   separate usage database or backend route.

### Requirement 6 - Return to the initial state from the brand header

1. WHEN the user clicks the ops-flow logo or application name in the top header THEN the system
   SHALL invoke the existing clear-targets behavior and return the main view to its initial empty
   state.
2. The header reset SHALL clear the selected targets, pod results, target errors, query error, and
   completed-query state using the existing store operation.
3. The header reset SHALL close any open pod-details panel and any open preset library or editor
   layer so the user is visibly back at the initial state.
4. The header reset SHALL preserve saved presets, preset usage timestamps, theme, grouping mode,
   filter text, and refresh interval.
5. The logo and application name SHALL be exposed as one keyboard-accessible button with an
   accessible name and visible focus state.

## Definition of done

- The initial empty main panel offers an entry point to presets.
- Existing saved presets can be applied directly from the initial state and populate the normal
  pod result flow.
- A selected target set exposes a direct fetch action in the main panel.
- Existing no-results, filter-empty, loading, and error states remain distinguishable.
- Presets are ordered by persisted recent use in both the library and launchpad, with legacy
   presets remaining readable.
- The header brand button returns the application to the initial target-selection state without
   deleting presets or changing view preferences.
- Frontend tests, typecheck, production build, and a read-only audit pass.
- Version metadata is prepared for `0.7.0`; no commit, tag, or push is created before user review.
