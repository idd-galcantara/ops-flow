# Requirements - ops-union v1.4.0 architecture audit

## Scope

Version 1.4.0 defines a read-only architecture audit of the current ops-union checkout. The audit SHALL map the code structure, runtime boundaries, important data flows, ownership boundaries, contracts, test coverage, known gaps, risks, review findings, and prioritized improvement opportunities.

This specification is an investigation and decision-support deliverable. It SHALL NOT authorize product implementation, refactoring, dependency upgrades, packaging, release, commit, push, or Kubernetes mutation. Accepted improvements SHALL become separate implementation specifications with their own scope and validation gates.

## User stories

- As a maintainer, I can understand where each product responsibility lives and how requests move through the desktop, renderer, backend, and Kubernetes boundaries.
- As a reviewer, I can distinguish confirmed defects from risks, hypotheses, missing evidence, and future improvement ideas.
- As a contributor, I can see which code areas own each contract and which agent should handle a follow-up change.
- As a product owner, I can prioritize architecture improvements by impact, evidence, effort, dependencies, and risk reduction.
- As a security-conscious operator, I can verify that the audit does not expose kubeconfig secrets or authorize mutating Kubernetes operations.

## Glossary

- **Architecture map:** Evidence-backed description of components, boundaries, entry points, ownership, dependencies, and runtime/data flows.
- **Finding:** A review observation with evidence, impact, confidence, severity, and a recommended action.
- **Gap:** A missing capability, test, contract, documentation item, or ownership rule required to make behavior reliable or maintainable.
- **Improvement candidate:** A proposed follow-up change that has not been approved or implemented by this specification.
- **Audit report:** The final `architecture-report.md` artifact produced under this specification folder.

## Requirements

### AR-1 - Current architecture inventory

1. The audit SHALL identify the repository packages, major source modules, entry points, generated/runtime boundaries, and relevant documentation/specification surfaces.
2. The audit SHALL map the Electron Main, preload, renderer, backend HTTP/WebSocket, Kubernetes client, local persistence, and packaging boundaries where present.
3. Every mapped responsibility SHALL cite a workspace-relative file or a clearly identified executable/package contract.
4. The audit SHALL identify ownership ambiguity, duplicated responsibility, dead or apparently unreachable surfaces, and undocumented coupling as findings or explicit non-findings.

### AR-2 - Runtime and contract flows

1. The audit SHALL trace at least startup/shutdown, kubeconfig/context discovery, target-to-pod query, pod details/metrics, live logs, History logs, preset persistence, and desktop IPC flows.
2. Each flow SHALL identify its initiator, state owner, transport or function boundary, normalization/validation point, failure behavior, cleanup behavior, and observable test evidence.
3. REST, WebSocket, IPC, and important internal state contracts SHALL be compared with their consumers and producers for drift, ambiguity, unsafe assumptions, and missing versioning or validation.
4. The report SHALL distinguish behavior observed in source/tests from behavior inferred from documentation or not verified in the available environment.

### AR-3 - Reliability, security, and maintainability review

1. The audit SHALL review error isolation, cancellation, cleanup, concurrency/limits, stale-response handling, resource ownership, and partial-failure behavior across the mapped flows.
2. The audit SHALL review the read-only Kubernetes guarantee, kubeconfig/credential boundaries, local process security, renderer privileges, filesystem access, and sensitive-data handling.
3. The audit SHALL review test coverage and validation depth for unit, integration, browser/Electron, packaging, and real-cluster behavior, recording unavailable checks as limitations.
4. Findings SHALL be classified by severity (`critical`, `high`, `medium`, or `low`) and confidence (`confirmed`, `likely`, or `unverified`).

### AR-4 - Review quality and evidence

1. Each finding SHALL include a stable ID, category, severity, confidence, evidence links, affected behavior, impact, recommendation, proposed owner, and a focused validation or reproduction check.
2. The audit SHALL separate facts, reasoned inferences, hypotheses, and proposals; a recommendation SHALL NOT be presented as an existing requirement or implemented behavior.
3. The report SHALL record commands and tests run, their outcomes, environment limitations, and any user changes observed in the worktree without reverting them.
4. The audit SHALL not copy kubeconfig contents, tokens, certificates, private keys, authorization headers, raw sensitive cluster output, or local secret values into the report.

### AR-5 - Prioritized improvement backlog

1. The audit SHALL produce a prioritized backlog of improvement candidates with problem statement, expected benefit, risk, dependencies, approximate scope, suggested owner/agent, and acceptance evidence.
2. The backlog SHALL identify quick wins, structural improvements, and items that require additional investigation before implementation.
3. The report SHALL identify which candidates should become separate versioned specs and SHALL avoid silently turning all findings into implementation tasks.
4. No candidate SHALL be marked implemented, released, or approved for production solely because it appears in the audit.

### AR-6 - Agent collaboration and boundaries

1. The architecture-review agent SHALL coordinate the audit and may request read-only contributions from the backend, frontend, and integration-QA agents.
2. The backend and frontend agents SHALL review their domain contracts and ownership boundaries; integration-QA SHALL review executable validation, read-only guarantees, and environment evidence.
3. The specs agent MAY convert accepted findings into future requirements, but the audit SHALL remain separate from product implementation and release orchestration.
4. Release and documentation-convergence agents SHALL not be required for the audit entry path; documentation changes SHALL be proposed as follow-up work unless the user explicitly requests them.

### AR-7 - Deliverable and completion gate

1. The audit SHALL produce `architecture-report.md` under this specification folder containing the architecture map, flow inventory, evidence matrix, findings, prioritized backlog, unresolved questions, and validation record.
2. The report SHALL include a concise executive summary and a list of the highest-value next actions.
3. The audit is complete only when every task in `tasks.md` has recorded evidence or an explicit limitation, and no unsupported claim is presented as verified.
4. Completion of this specification SHALL not change product source code or authorize commit, packaging, release, or Kubernetes mutation.

## Definition of done

- The current architecture and major runtime/data flows are mapped with workspace-relative evidence.
- Ownership boundaries and agent responsibilities are explicit.
- Reliability, security, maintainability, test, and documentation gaps are reviewed with severity and confidence.
- Confirmed findings are separated from hypotheses and improvement proposals.
- A prioritized, evidence-backed backlog exists and identifies follow-up specifications.
- `architecture-report.md` records commands, tests, limitations, and unresolved questions honestly.
- No product source, generated artifact, release state, or Kubernetes resource was changed by the audit.
