# Implementation Tasks - ops-flow v0.6.3 close pod details on fetch

## Phase 1 - Query lifecycle behavior

- [x] 1.1 Map all pod-fetch entry points and the selected-details owner.
  - Confirm `App` owns the selected pod while `loadPods` owns query lifecycle state.
  - Distinguish normal fetches from silent auto-refresh.

- [x] 1.2 Close selected details when normal pod loading starts.
  - Observe `podsLoading` in `App` and clear the selected pod.
  - Preserve silent refresh behavior through the existing `refreshing` state.

## Phase 2 - Regression gate

- [x] 2.1 Run frontend typecheck and tests.
  - Evidence: frontend typecheck passed; 55 frontend tests passed.

- [x] 2.2 Run backend tests and the production build.
  - Evidence: 48 backend tests passed; backend, frontend, and desktop build passed.
- [x] 2.3 Manually validate sidebar fetch, refresh, retry, preset query, and silent auto-refresh.
  - Evidence: user confirmed the behavior is correct after local validation.

- [x] 2.4 Obtain user approval before changing version, committing, pushing, or tagging.
  - Evidence: user explicitly approved the release preparation.

## Definition of done

- Explicit fetches cannot leave stale pod details visible.
- Silent auto-refresh does not close the details panel.
- Automated checks pass and manual validation is recorded.
- No release commit or tag is created before user approval.
