# Design - ops-union v0.6.1 dark-mode readability

## Overview

The dark theme keeps the existing terracotta accent and component layout while raising the
baseline contrast of the surrounding visual system. The fix is intentionally centralized in the
dark-theme token block and its component-specific overrides in `frontend/src/index.css`.

## Visual strategy

- Lift the canvas, panel, surface, field, and hover colors so the interface is not uniformly near
  black.
- Raise `--ink` for primary text and `--muted` / `--text-soft` for supporting text.
- Strengthen borders and dividers to separate adjacent dark surfaces.
- Route eyebrows, detail labels, metric labels, table headings, and technical metadata through
  `--text-soft` in dark mode.
- Give low-emphasis messages and metadata a minimum readable weight without making all text bold.

## Ownership and boundaries

- `App` continues to own theme selection and persistence.
- `index.css` owns the dark-theme tokens and component overrides.
- No component state, API contract, persistence adapter, or backend behavior changes.

## Validation

Automated validation covers frontend typecheck, frontend tests, CSS diagnostics, and diff hygiene.
A manual smoke test should inspect the main table, details panel, forms, preset library, and
responsive narrow layout in both theme states.