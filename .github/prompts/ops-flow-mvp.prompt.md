---
name: ops-flow-mvp
description: "Implement or validate a task from the ops-flow MVP specification while preserving its local read-only Kubernetes architecture."
argument-hint: "Describe the MVP task or phase to implement"
agent: "agent"
tools: [read, edit, execute]
---

Work on the requested ops-flow MVP task using the project specification:

- [Requirements](../../docs/specs/ops-flow-mvp/requirements.md)
- [Design](../../docs/specs/ops-flow-mvp/design.md)
- [Implementation plan](../../docs/specs/ops-flow-mvp/tasks.md)

Before editing, read the relevant existing implementation and tests. Keep the change scoped to the requested task, preserve the backend/frontend API contract, and follow the Copilot custom-agent boundaries in `.github/agents/`.

The application is local and strictly read-only. Never add or invoke Kubernetes mutations, expose kubeconfig secrets, or change unrelated behavior. After editing, run the narrowest relevant tests, typecheck, build, or lint commands and report the result.

Requested task:
$ARGUMENTS
