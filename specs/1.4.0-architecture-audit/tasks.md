# Implementation Tasks - ops-union v1.4.0 architecture audit

These tasks define a read-only architecture investigation. They do not authorize product source changes, refactoring, dependency updates, packaging, release activity, commits, pushes, or Kubernetes mutation.

## Ownership and sequencing

- `@ops-union-architecture-review` coordinates the audit and owns the final report.
- Backend, frontend, and integration-QA specialists contribute read-only evidence in parallel where their domains are involved.
- `@ops-union-specs` may create later implementation specs from accepted findings after this audit is complete.
- The report synthesis depends on the specialist reviews; follow-up specification work depends on the final report.

## Tasks

- [x] 1.4.0-AR-1 Establish audit baseline and repository inventory.
  - Read this specification, current package scripts, workspace structure, active specs, technical docs, and relevant tests.
  - Record the audit date, environment, worktree status, package/process topology, entry points, and generated/runtime boundaries.
  - _Owner: @ops-union-architecture-review
  - _Copilot agent: @ops-union-architecture-review
  - _Requirements: AR-1.1-AR-1.4, AR-4.3
  - _Validation: source inventory, `git status --short`, package-script review, and report evidence.
  - _Definition of done: the baseline and architecture inventory cite workspace-relative evidence and preserve unrelated user changes.
  - _Evidence: `architecture-report.md` records Linux/Node/npm versions, `main` at `v1.3.2`, package scripts, package/process topology, generated/runtime boundaries, and the pre-existing `.github` worktree changes. No unrelated changes were reverted.

- [x] 1.4.0-AR-2 Review backend and Kubernetes architecture.
  - Trace backend startup, configuration, kubeconfig/context loading, client factories/caches, fan-out, normalization, REST routes, WebSocket logs/history, limits, cleanup, and safe error behavior.
  - Review read-only guarantees and identify contract, lifecycle, concurrency, security, and test gaps.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: AR-2.1-AR-2.3, AR-3.1-AR-3.2, AR-3.4
  - _Validation: backend source/tests review and focused existing backend checks where needed; no mutating cluster command.
  - _Definition of done: backend evidence and findings are returned to the architecture reviewer with severity, confidence, and validation checks.
  - _Evidence: Direct focused review traced startup, kubeconfig discovery, scoped client caches, REST routes, fan-out, details/metrics, live/history WebSockets, limits, cleanup, and read-only client calls. `npm test --workspace=backend` passed 88/88 and backend typecheck passed. No Kubernetes mutation was run.

- [x] 1.4.0-AR-3 Review frontend, desktop, and state architecture.
  - Trace React bootstrap, App/store ownership, target and preset flows, pod details, Live/History logs, WebSocket lifecycle, preload/IPC, local persistence, renderer privileges, and UI test coverage.
  - Review stale state, lifecycle cleanup, contract drift, accessibility/visual validation gaps, and ownership ambiguity.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: AR-1.2, AR-2.1-AR-2.3, AR-3.1-AR-3.3
  - _Validation: frontend/desktop source and test review plus available typecheck/build evidence; no source edits.
  - _Definition of done: frontend/desktop evidence and findings are returned to the architecture reviewer with explicit limitations.
  - _Evidence: Direct focused review traced React bootstrap/store, target and preset state, details/metrics, Live/History sockets, preload/IPC, local persistence, and BrowserWindow privileges. `npm test --workspace=frontend` passed 105/105; frontend and desktop typechecks passed. Desktop has no test script, and browser/Electron execution was unavailable.

- [x] 1.4.0-AR-4 Review validation, security, and operational evidence.
  - Assess existing unit, integration, browser/Electron, packaging, and real-cluster validation surfaces.
  - Confirm the application remains read-only in the audited paths and record unavailable checks without exposing secrets or raw cluster output.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: AR-3.1-AR-3.4, AR-4.3-AR-4.4
  - _Validation: read-only checks only; use explicit contexts and sanitized results when cluster validation is available.
  - _Definition of done: QA evidence includes pass/fail/unavailable outcomes, commands or scenarios, and residual risk.
  - _Evidence: `kubectl config get-contexts -o name` listed context names only; no context was selected or changed and no cluster payload was collected. Source review found only Kubernetes read/list/log/metrics calls in audited paths. Browser/Electron, packaged-runtime, and live-cluster scenarios are recorded as unavailable limitations. No separate integration-QA agent execution channel was available.

- [x] 1.4.0-AR-5 Synthesize the architecture map and findings.
  - Produce `architecture-report.md` with the required sections, flow traces, evidence matrix, findings, prioritized backlog, limitations, and next actions.
  - Resolve duplicate observations, distinguish facts from inferences, and order findings by severity and confidence.
  - _Owner: @ops-union-architecture-review
  - _Copilot agent: @ops-union-architecture-review
  - _Requirements: AR-1-AR-5, AR-7.1-AR-7.2
  - _Dependencies: 1.4.0-AR-1, 1.4.0-AR-2, 1.4.0-AR-3, 1.4.0-AR-4
  - _Validation: report section/link check, specialist evidence reconciliation, and `git diff --check`.
  - _Definition of done: the report is evidence-backed, bounded, and explicit about unknowns; no product source is changed.
  - _Evidence: `architecture-report.md` contains the required sections, flow traces, ownership matrix, evidence matrix, nine ARF findings, backlog, limitations, unresolved questions, and next actions. Required-section/ID check and `git diff --check` passed. Specialist reconciliation is explicitly limited to direct review because delegated agent execution was unavailable.

- [x] 1.4.0-AR-6 Decide follow-up specification boundaries.
  - Select the highest-value improvement candidates and group them into small, independently verifiable future specs.
  - Identify candidates that need more evidence before implementation and record the decision owner.
  - _Owner: @ops-union-specs
  - _Copilot agent: @ops-union-specs
  - _Requirements: AR-5.1-AR-5.4, AR-6.3
  - _Dependencies: 1.4.0-AR-5
  - _Validation: report review and proposed follow-up spec list; no implementation claims.
  - _Definition of done: accepted follow-ups have clear boundaries, owners, and evidence gates, while deferred items remain visibly deferred.
  - _Evidence: The report ranks eight future candidates, identifies P0-P3 boundaries, owners, dependencies, and acceptance evidence. No future implementation spec was created and no candidate is marked implemented, released, or production-approved. A separate specs-agent contribution was not available.

- [x] 1.4.0-AR-7 Close the audit with evidence and limitations.
  - Confirm all task evidence is recorded, no unsupported claim is labeled verified, and the worktree changes are limited to the audit artifacts.
  - Record unresolved questions, unavailable tooling, and residual risks.
  - _Owner: @ops-union-architecture-review
  - _Copilot agent: @ops-union-architecture-review
  - _Requirements: AR-4.1-AR-4.4, AR-7.3-AR-7.4
  - _Dependencies: 1.4.0-AR-5, 1.4.0-AR-6
  - _Validation: final report review, `git diff --check`, and `git status --short`.
  - _Definition of done: the audit is complete as an investigation only and explicitly does not approve implementation or release.
  - _Evidence: Final validation below records report checks, all focused tests/typechecks, limitations, and the permitted-path worktree check. The report explicitly states that this is an investigation only and does not approve implementation or release.

## Validation record

The architecture-review owner SHALL append concrete command results, specialist reports, environment limitations, and the date here only after each task has evidence. Checked tasks do not imply that findings are fixed or that a release is approved.

Audit date: 2026-09-18.

- `git status --short`, branch, recent log, and package-script review: completed. Pre-existing `.github` changes and the audit spec setup were preserved.
- `npm test --workspace=backend`: pass, 88 tests, 0 failures.
- `npm test --workspace=frontend`: pass, 105 tests, 0 failures. A non-failing Node localstorage-file warning was emitted.
- `npm run typecheck --workspace=backend && npm run typecheck --workspace=frontend && npm run typecheck --workspace=desktop`: pass.
- `kubectl config get-contexts -o name`: pass; context names only, no current-context change and no secret or cluster payload recorded.
- `git diff --check`: pass before and after the report/task edits.
- Report section and stable finding ID check: pass; all required sections and `ARF-001` through `ARF-009` are present.
- Browser/Electron, packaged-runtime, and real-cluster behavior: unavailable and not claimed as verified.
- Delegation: no separate backend, frontend, integration-QA, or specs-agent execution channel was available; the architecture owner performed direct focused reviews and records this limitation in the report.
- Boundary confirmation: no product source, product test, package manifest, lockfile, generated artifact, release artifact, kubeconfig, current Kubernetes context, or Kubernetes resource was changed. No commit, push, package, or publish operation was performed.

## Definition of done

- `architecture-report.md` maps the current system and required flows with evidence.
- Findings cover architecture, contracts, reliability, security, performance/resource limits, tests, documentation drift, and delivery risks where evidence exists.
- Findings and improvement candidates are prioritized and separated from implementation decisions.
- Specialist contributions and agent boundaries are recorded.
- Validation outcomes and unavailable checks are explicit.
- Only audit/spec artifacts changed; no source code, release artifact, commit, push, or Kubernetes mutation occurred.
