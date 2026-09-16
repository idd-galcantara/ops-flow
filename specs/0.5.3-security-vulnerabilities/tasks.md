# Implementation Plan — Security Vulnerability Remediation

The tasks are intentionally split so the low-risk backend patch can land independently from the
Electron major upgrade. No task below has been implemented yet.

## Phase 0 — Baseline and ownership

- [x] Capture the audit baseline for the candidate commit.
  - Record `npm audit --json` metadata and vulnerable package paths.
  - Confirm the versions in `npm ls electron extract-zip express qs --all`.
  - Confirm the working tree is clean before dependency changes.
  - _Owner: @ops-union-backend_
- [ ] Create a release note entry for the security remediation scope.
  - _Owner: repository maintainer_

## Phase 1 — Patch Express and qs

- [x] Update the backend dependency graph to `express >=4.22.3` and `qs >=6.16.0`.
  - Prefer the compatible Express 4 patch line.
  - Do not use `npm audit fix --force` in this phase.
  - _Owner: @ops-union-backend_
- [x] Review `package.json` and `package-lock.json` for unrelated churn.
  - _Owner: @ops-union-backend_
- [x] Run backend typecheck and unit tests.
  - `npm run typecheck --workspace=backend`
  - `npm test --workspace=backend`
  - _Owner: @ops-union-backend_
- [x] Verify the API remains read-only and the JSON validation behavior is unchanged.
  - _Owner: @ops-union-integration-qa_
- [x] Confirm `npm audit --omit=dev` no longer reports `express` or `qs`.
  - _Owner: @ops-union-integration-qa_

## Phase 2 — Upgrade Electron and extractor chain

- [x] Upgrade the desktop workspace to Electron `44.4.0` or a later selected fixed release.
  - Inspect the major-version changelog before implementation.
  - _Owner: @ops-union-backend_
- [x] Confirm the vulnerable `extract-zip@2.0.1` path is absent or replaced by the fixed
      Electron dependency chain.
  - _Owner: @ops-union-backend_
- [x] Recheck BrowserWindow, preload and backend process lifecycle behavior.
  - Preserve sandbox, context isolation, disabled Node integration and denied window creation.
  - _Owner: @ops-union-backend_
- [x] Run desktop typecheck and the complete workspace build.
  - `npm run typecheck`
  - `npm run build`
  - _Owner: @ops-union-backend_
- [ ] Smoke-test the Linux desktop package end to end.
  - [x] Launch the packaged executable; startup exited cleanly with code 0.
  - Start the application, load contexts, query pods, open details, view metrics and stream logs.
  - _Owner: @ops-union-integration-qa_
- [ ] Validate Windows and macOS packaging in the release workflow.
  - _Owner: @ops-union-integration-qa_

## Phase 3 — Security regression validation

- [x] Run the complete test suite.
  - `npm test --workspace=backend`
  - `npm test --workspace=frontend`
  - _Owner: @ops-union-integration-qa_
- [x] Run `npm audit --audit-level=high` and investigate every remaining high or critical result.
  - _Owner: @ops-union-backend_
- [x] Verify no credentials, certificates, tokens or raw Kubernetes errors appear in API responses,
      logs or packaged resources.
  - _Owner: @ops-union-integration-qa_
- [x] Verify no Kubernetes mutation method or new remote listener was introduced.
  - _Owner: @ops-union-integration-qa_
- [ ] Review the final dependency diff and generated artifacts.
  - _Owner: repository maintainer_

## Phase 4 — Release

- [x] Bump `package.json` and `package-lock.json` together using the next patch version.
  - _Owner: repository maintainer_
- [ ] Commit the remediation separately from unrelated feature work.
  - _Owner: repository maintainer_
- [ ] Push `main`, wait for the validation workflow, then create and push the matching `v*` tag.
  - _Owner: repository maintainer_
- [ ] Confirm the GitHub Release contains the expected Linux, Windows and macOS artifacts.
  - _Owner: @ops-union-integration-qa_

## Definition of done

- No high or critical audit finding remains in the dependency graph used to build or distribute
  the application.
- Express and qs runtime findings are removed without changing API behavior.
- Electron is on a fixed supported release and the desktop application still starts and operates.
- All typechecks, unit tests, builds and required packaging validations pass.
- The security remediation and any accepted residual risk are documented in the release notes.
