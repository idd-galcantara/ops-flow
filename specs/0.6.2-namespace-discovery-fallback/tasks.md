# Implementation Tasks - ops-union v0.6.2 namespace discovery fallback

## Phase 1 - Diagnostics and fallback

- [x] 1.1 Preserve sanitized per-context namespace discovery errors in the frontend state.
  - Replace the generic failure count with each context and its safe backend message.
  - Keep successful namespace data when only part of the fan-out fails.

- [x] 1.2 Add a pure predicate for the manual namespace fallback.
  - Enable it only after loading finishes, no namespaces were returned, and a discovery error exists.
  - Cover success, partial data, missing error, and loading states with unit tests.

- [x] 1.3 Permit and label manual namespace entry after discovery failure.
  - Mark typed values as not verified.
  - Route added values through the existing target and pod-loading flow.
  - Preserve exact-match validation and coverage behavior when discovery succeeds.

## Phase 2 - Regression gate

- [x] 2.1 Run frontend tests and typecheck.
  - Evidence: 55 frontend tests passed; frontend typecheck passed.

- [x] 2.2 Run backend tests and the full production build.
  - Evidence: 48 backend tests passed; backend, frontend, and desktop build passed.

- [x] 2.3 Package the Linux release artifacts.
  - Evidence: `.deb` and AppImage packaging completed successfully.

## Definition of done

- The UI explains why namespace discovery failed.
- A known namespace can be queried manually when discovery is unavailable.
- Existing successful discovery behavior is preserved.
- Automated validation and Linux packaging pass.
