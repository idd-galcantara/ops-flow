# Design - ops-union v1.4.0 architecture audit

## Overview

The current repository already has domain specialists for backend, frontend, integration QA, specification ownership, documentation convergence, implementation orchestration, and release delivery. None is the clear owner of a read-only, cross-cutting architecture investigation. This specification adds that missing coordination surface without changing product behavior.

The audit is evidence-first: source code and executable tests establish current behavior, current documentation and completed specs provide intended context, and unsupported claims remain explicitly unverified. The output is a durable report that can seed smaller follow-up specifications.

## Ownership and collaboration

- `@ops-union-architecture-review` owns audit scope, cross-cutting mapping, evidence synthesis, findings, backlog prioritization, and `architecture-report.md`.
- `@ops-union-backend` contributes a read-only review of Node/TypeScript services, Kubernetes clients, REST routes, WebSocket log services, limits, error isolation, and backend tests.
- `@ops-union-frontend` contributes a read-only review of React state ownership, API consumers, logs workspace/history behavior, desktop-facing assumptions, accessibility, and frontend tests.
- `@ops-union-integration-qa` contributes read-only validation evidence, security/read-only review, packaging/runtime observations, and explicit environment limitations.
- `@ops-union-specs` may turn accepted findings into later versioned product specifications after the audit; it does not implement findings as part of this work.
- `@ops-union-docs-convergence` is not an entry dependency because this is not a completed product implementation. `@ops-union-release` is out of scope.

The architecture-review agent may run repository checks and delegate focused inspection. Delegated specialists must not edit source code, mutate Kubernetes, commit, publish, or rewrite historical specs while contributing to the audit.

## Audit method

### 1. Establish the evidence baseline

Read the audit spec, current `git status`, package scripts, workspace structure, active specs, current technical documentation, and relevant tests. Preserve user changes and record the audit date and environment. Do not infer behavior from filenames alone.

### 2. Build the architecture map

Record:

- package and process topology;
- source entry points and lifecycle ownership;
- Electron Main/preload/renderer/backend/Kubernetes boundaries;
- REST, WebSocket, IPC, filesystem, and persistence contracts;
- state owners and cleanup/lifetime rules;
- test and validation surfaces;
- documentation/specification authority and drift.

Use a Mermaid diagram only when it improves the report; keep file paths and ownership labels readable.

### 3. Trace representative flows

For each required flow, follow the actual call path from initiation through transport, normalization, state update, rendering or response, failure handling, and cleanup. Capture the strongest available evidence and name missing links rather than filling them with assumptions.

### 4. Review risks and gaps

Use these categories: architecture/ownership, contract/API, reliability/lifecycle, security/privacy, performance/resource bounds, test/validation, documentation/spec drift, and delivery/operability. For each observation, decide whether it is a confirmed finding, likely risk, or unverified question.

Finding format:

```text
ID: ARF-###
Category: <category>
Severity: critical | high | medium | low
Confidence: confirmed | likely | unverified
Status: open | accepted-follow-up | deferred | informational
Evidence: <workspace-relative links and commands>
Observation: <fact or bounded inference>
Impact: <user, operator, security, reliability, or maintenance impact>
Recommendation: <smallest useful next action>
Suggested owner: <agent or repository maintainer>
Validation: <focused reproduction, test, or evidence needed>
```

### 5. Prioritize without implementing

Rank improvement candidates by impact, risk reduction, evidence confidence, dependency order, and expected effort. Keep the backlog separate from findings: a finding explains a problem; a candidate proposes a possible response. Candidates that are accepted should become separate versioned specs with normal implementation gates.

## Evidence rules

- Source code and executable tests are the primary evidence for current behavior.
- Specs define intended behavior for their version but do not prove current implementation.
- Documentation claims must be labeled aligned, stale, contradictory, missing, or unverified.
- Browser/Electron and real-cluster checks may be run only when available and must remain read-only.
- Commands must avoid printing secrets or raw cluster responses. Context names and sanitized status are sufficient.
- A failed or unavailable check is recorded as a limitation, not silently omitted.

## Report contract

`architecture-report.md` SHALL contain, in this order:

1. audit date, scope, environment, and executive summary;
2. repository/package and process map;
3. component ownership and boundary matrix;
4. required runtime/data-flow traces;
5. contract and state-lifecycle observations;
6. evidence matrix and validation record;
7. findings ordered by severity, then confidence;
8. prioritized improvement backlog;
9. unresolved questions and explicit limitations;
10. recommended follow-up specs and next actions.

The report is an audit artifact, not a replacement for `README.md`, `docs/TECH-DEFINITION.md`, or historical versioned specs. Those documents may be referenced as evidence, but they are not rewritten by default.

## Validation strategy

- Run the narrowest relevant existing tests for any behavior used as evidence, then package typechecks/builds as available.
- Run `git diff --check` for report/spec edits.
- Review report links and required sections with a lightweight repository check.
- If browser, Electron, package, or cluster validation is unavailable, record the limitation and the reason.
- Confirm no source code, generated artifact, release file, commit, push, or Kubernetes mutation changed during the audit.
