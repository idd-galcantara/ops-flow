---
name: ops-union-architecture-review
description: "Run a read-only architecture, code-structure, gap, risk, and review audit for ops-union"
argument-hint: "Describe the architecture area or flow to audit"
agent: "ops-union-architecture-review"
tools: [read, edit, search, execute, agent, todo]
---

Run the architecture audit defined by:

- [Requirements](../../specs/1.4.0-architecture-audit/requirements.md)
- [Design](../../specs/1.4.0-architecture-audit/design.md)
- [Tasks](../../specs/1.4.0-architecture-audit/tasks.md)

Review the current checkout and produce or update:

- [Architecture report](../../specs/1.4.0-architecture-audit/architecture-report.md)

Map the requested area or flow, then cover adjacent ownership and contract boundaries that affect
it. Use the existing backend, frontend, and integration-QA agents for focused read-only reviews when
useful. Classify findings by severity and confidence, cite workspace-relative evidence, separate
facts from hypotheses, and propose small follow-up specifications for accepted improvements.

Do not implement findings. Do not edit product source, tests, manifests, generated/release files, or
historical specs. Do not run Kubernetes mutations, expose secrets, commit, push, package, or publish.

Requested audit scope:
$ARGUMENTS
