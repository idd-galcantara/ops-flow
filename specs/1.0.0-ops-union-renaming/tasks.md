# Implementation Tasks - Ops Union v1.0.0 application rename

The implementation and user validation for this release are complete. These
tasks record the release evidence and commit gate.

## Phase 1 - Identity transition

- [x] 1.1 Apply the `Ops Union` product name to visible application and installer surfaces.
  - Update the window title, application header, and electron-builder product metadata.
  - Keep generated artifact filenames on the `ops-union` technical slug.
  - _Requirements: 1.1, 1.3, 1.4_
  - _Validation: production frontend build and Linux package inspection._

- [x] 1.2 Apply the `ops-union` technical slug across packages, repository links,
  documentation, automation, executables, storage keys, and specifications.
  - Preserve existing behavior and read-only Kubernetes boundaries.
  - _Requirements: 1.2, 4.1-4.3_
  - _Validation: reference audit, automated tests, and user smoke test._

- [x] 1.3 Preserve compatibility contracts.
  - Keep `com.opsflow.desktop` as the Electron appId.
  - Keep `window.opsFlowDesktop` as the preload bridge contract.
  - Configure Linux desktop association with the `ops-union` technical desktop name.
  - _Requirements: 2.1-2.4_
  - _Validation: effective electron-builder configuration and desktop build._

## Phase 2 - Version 1.0.0

- [x] 2.1 Promote the root release metadata to `1.0.0`.
  - Update the root entries in `package.json` and `package-lock.json`.
  - Leave private workspace package versions unchanged.
  - _Requirements: 3.1-3.4_
  - _Validation: package metadata assertion and lockfile review._

- [x] 2.2 Create the release specification.
  - Record requirements, identity mapping, compatibility boundaries, validation,
    and delivery scope under `specs/1.0.0-ops-union-renaming/`.
  - _Requirements: 3.4, 5.1_
  - _Validation: specification review._

## Phase 3 - Regression and commit gate

- [x] 3.1 Run the release validation gate.
  - Run `npm test --workspaces --if-present`.
  - Run `npm run typecheck` and `npm run build`.
  - Run `npm run package:linux`.
  - Run `git diff --check` and inspect the effective package metadata.
  - _Requirements: 4.4, 5.2_
  - _Evidence: 48 backend tests, 62 frontend tests, typecheck, production build,
    Linux AppImage and `.deb` packaging, diagnostics, and diff check passed._

- [x] 3.2 Stage and commit the completed release scope.
  - Review `git diff --cached` after `git add -A`.
  - Create the release commit for `v1.0.0`.
  - Do not tag or push until separately approved.
  - _Requirements: 5.1-5.4_
  - _Validation: clean staged review and commit inspection._

## Definition of done

- [x] Public identity is `Ops Union` and technical identity is `ops-union`.
- [x] Stable Electron identity and preload bridge are preserved.
- [x] Root version metadata is `1.0.0`.
- [x] Automated validation and Linux packaging pass.
- [x] Release specification is present.
- [x] All pending changes are staged and committed as the `1.0.0` release.
