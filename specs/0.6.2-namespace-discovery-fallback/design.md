# Design - ops-flow v0.6.2 namespace discovery fallback

## Overview

The namespace autocomplete still uses the existing `POST /api/namespaces` fan-out. The store now
retains each cluster error instead of replacing it with a generic count. When every selected
context returns an error and no namespace data is available, the selector permits an explicitly
typed namespace and labels it as not verified.

## Behavior

- Successful discovery continues to provide filtered suggestions and cluster coverage.
- Partial discovery keeps successful namespace data and displays the failed contexts.
- Complete discovery failure with an empty namespace result enables the manual namespace fallback.
- Manual targets use the existing `addTarget` and `loadPods` paths; the Kubernetes API remains the
  authority on whether that namespace is accessible.

## Ownership and boundaries

- `frontend/src/store.ts` owns the formatted per-context discovery error.
- `frontend/src/namespaceSuggestions.ts` owns the pure fallback predicate.
- `NamespaceInput` owns the unverified status and manual entry interaction.
- `TargetSelector` owns target availability and uses the existing pod query flow.
- No new backend route or Kubernetes operation is introduced.

## Validation

Run frontend and backend tests, frontend and full typechecks, `git diff --check`, and the complete
production build. In the desktop app, select a kubeconfig whose `kubectl` can list namespaces,
confirm the selected-file status, and capture the displayed discovery error if the Node client
still fails. Then enter a known namespace manually and verify the pod query result.
