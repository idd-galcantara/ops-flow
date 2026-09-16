---
name: ops-union-mvp
description: "Implement or validate a task from the ops-union MVP specification while preserving its local read-only Kubernetes architecture."
argument-hint: "Describe the MVP task or phase to implement"
agent: "agent"
tools: [read, edit, execute]
---

Work on the requested ops-union MVP task using the project specification:

- [Requirements](../../specs/0.1.0-web/requirements.md)
- [Design](../../specs/0.1.0-web/design.md)
- [Implementation plan](../../specs/0.1.0-web/tasks.md)

If the requested work belongs to a newer release or another area, inspect `../../specs/` and use
the matching specification instead of assuming the MVP files are current.

Before editing, read the relevant existing implementation and tests. Keep the change scoped to the requested task, preserve the backend/frontend API contract, and follow the Copilot custom-agent boundaries in `.github/agents/`.

The application is local and strictly read-only. Never add or invoke Kubernetes mutations, expose kubeconfig secrets, or change unrelated behavior. After editing, run the narrowest relevant tests, typecheck, build, or lint commands and report the result.

Requested task:
$ARGUMENTS
