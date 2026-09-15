# Requirements — Security Vulnerability Remediation

## Status

This specification maps the dependency vulnerabilities found in the `0.5.2` release.
The remediation is implemented in the `0.5.3` candidate. Cross-platform packaging and publishing
the release tag remain operational follow-up work.

Audit snapshot: **2026-09-15**

## Scope

The remediation covers the dependency graph used by the web backend and by the distributed
Electron desktop application. It must preserve the existing read-only behavior, localhost-only
operation and secure renderer configuration.

## Vulnerability baseline

The baseline was collected with:

```bash
npm audit
npm ls electron extract-zip express qs --all
```

The audit reported four vulnerable package entries:

- `electron@38.8.6`: direct desktop dependency, high severity.
- `extract-zip@2.0.1`: transitive Electron dependency, high severity.
- `express@4.22.2`: direct backend dependency, moderate severity.
- `qs@6.15.3`: transitive Express dependency, moderate severity.

There were no critical findings. Electron aggregates 19 advisories. The `qs` and `express`
findings remain visible when running `npm audit --omit=dev`; Electron is declared as a desktop
development dependency but is embedded in the distributed application runtime.

## Requirements

### Requirement 1 — Remove the Express and qs findings

1. The dependency graph SHALL resolve `express` to `4.22.3` or a later compatible 4.x release,
   unless a tested Express 5 migration is explicitly chosen.
2. The dependency graph SHALL resolve `qs` to `6.16.0` or later.
3. `package.json` and `package-lock.json` SHALL remain aligned after the update.
4. The backend SHALL preserve all existing route contracts and read-only behavior.
5. The backend test suite SHALL pass after the update.

### Requirement 2 — Update Electron and its archive extractor

1. The desktop dependency SHALL resolve Electron to `44.4.0` or a later release containing the
   audit fixes, unless a newer supported fixed release is selected during implementation.
2. The resulting dependency graph SHALL no longer resolve the vulnerable `extract-zip@2.0.1`
   path from Electron.
3. The desktop application SHALL continue to start the backend on `127.0.0.1` and wait for its
   health endpoint before opening the renderer.
4. The renderer SHALL retain `sandbox: true`, `contextIsolation: true` and
   `nodeIntegration: false`.
5. The renderer SHALL continue denying uncontrolled window creation.

### Requirement 3 — Preserve the security boundary

1. No new Kubernetes mutation operation SHALL be introduced.
2. No kubeconfig token, certificate, key or raw sensitive error SHALL be returned or logged.
3. The desktop preload SHALL expose only the existing validated operations.
4. The backend SHALL remain bound to localhost and continue using the internal request token for
   kubeconfig selection.

### Requirement 4 — Make the audit reproducible

1. A clean `npm ci` SHALL reproduce the committed lockfile.
2. `npm audit --audit-level=high` SHALL report no high or critical vulnerability after the
   remediation.
3. Moderate findings that cannot be removed without a deliberate major migration SHALL be
   documented with owner, reason and follow-up decision.
4. The release checklist SHALL include dependency audit, typecheck, unit tests and desktop
   packaging validation.

### Requirement 5 — Validate the distributed application

1. Backend typecheck and tests SHALL pass.
2. Frontend typecheck, build and tests SHALL pass.
3. Desktop typecheck SHALL pass.
4. At least the Linux desktop package SHALL be generated and opened or smoke-tested locally.
5. The release workflow SHALL be exercised for the selected version before publishing a new tag.

## Non-goals

- Replacing Express with another HTTP framework.
- Enabling remote access or adding multi-user authentication.
- Adding Kubernetes write operations.
- Applying `npm audit fix --force` without reviewing the Electron major upgrade.
