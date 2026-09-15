# Design — Security Vulnerability Remediation

## Overview

The audit findings have two independent dependency chains. The first is a small backend patch
that can be handled without a framework migration. The second is an Electron major upgrade that
must be validated against the packaged desktop application.

```text
root workspace
├── backend
│   └── express 4.22.2
│       └── qs 6.15.3                 moderate
└── desktop
    └── electron 38.8.6               high
        └── extract-zip 2.0.1         high
```

The audit dry run identified these non-forced fixes:

```text
express 4.22.2 -> 4.22.3
qs      6.15.3 -> 6.16.0
```

The full fix requires:

```text
electron 38.8.6 -> 44.4.0            SemVer major
```

`extract-zip` is fixed through the Electron upgrade path rather than by adding a new direct
runtime dependency.

## Risk map

| Chain | Finding | Exposure in ops-flow | Priority | Planned treatment |
| --- | --- | --- | --- | --- |
| Electron | Context-isolation, navigation, protocol, DevTools, window and memory-safety advisories | Electron is embedded in every desktop package; exploitability is reduced by the local renderer and current BrowserWindow restrictions | High | Controlled Electron major upgrade and package smoke tests |
| extract-zip | Symlink path traversal and arbitrary file writes in ZIP extraction | Primarily install/build supply-chain exposure; inherited from Electron | High | Resolve through the fixed Electron line |
| Express/qs | Array-limit bypass and `isBuffer`-controlled DoS | Backend is localhost-only; current routes use JSON bodies and path params, with no application use of `req.query` found | Moderate | Patch Express and qs, then retain regression tests |

## Existing mitigations to preserve

The desktop shell currently uses the following controls in `desktop/src/main.ts`:

- `sandbox: true`;
- `contextIsolation: true`;
- `nodeIntegration: false`;
- `setWindowOpenHandler(() => ({ action: 'deny' }))`;
- backend bound to `127.0.0.1`;
- random internal token for the kubeconfig selection endpoint.

The preload exposes only validated preference, preset and kubeconfig-selection operations. No
current code uses `shell.openPath`, custom protocols, clipboard APIs, offscreen rendering,
extensions or uncontrolled external windows. These mitigations reduce attack surface but do not
replace the Electron security update.

## Remediation sequence

### Phase A — Backend dependency patch

Update the lockfile to the latest compatible Express 4 patch and `qs` fixed version. Prefer a
normal install/update over a forced audit fix so unrelated packages are not upgraded.

After the update:

- inspect the lockfile diff;
- run backend typecheck and tests;
- verify all existing HTTP route contracts;
- run `npm audit --omit=dev` and confirm the two runtime findings are gone.

### Phase B — Electron major upgrade

Update the desktop workspace to Electron `44.4.0` or a newer selected fixed release. Treat this
as a compatibility change, not a lockfile-only patch.

Validation must cover:

- startup and backend health synchronization;
- preload IPC calls;
- kubeconfig selection;
- theme and preset persistence;
- renderer loading and window restrictions;
- Linux package generation;
- Windows and macOS CI packaging jobs.

Do not weaken sandbox, isolation or navigation restrictions to compensate for an upgrade issue.

### Phase C — Audit and release gate

The release candidate must pass:

```bash
npm ci
npm run typecheck
npm test --workspace=backend
npm test --workspace=frontend
npm run build
npm audit --audit-level=high
```

The security change should be released separately from unrelated product changes. The package
version and lockfile must be updated together, followed by the normal main-branch push and tag
workflow described in `docs/VERSIONING-AND-RELEASE.md`.

## Failure handling

- If Express 4 patching changes request parsing behavior, stop and investigate before migrating
  to Express 5.
- If Electron 44 breaks packaging or preload behavior, keep the backend patch separate and open a
  focused compatibility task for the desktop upgrade.
- If a high or critical finding remains, do not publish a new desktop installer without recording
  the exact package path, exploitability assessment and accepted owner decision.
