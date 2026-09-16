# Requirements - ops-flow v0.6.2 namespace discovery fallback

## Scope

This specification covers namespace discovery failures when a kubeconfig can authenticate to a
cluster and list namespaces with `kubectl`, but the application cannot complete the Kubernetes
client request. It improves diagnostics and preserves a manual namespace workflow. The product
remains read-only.

## Requirements

### Requirement 1 - Explain namespace discovery failures

1. WHEN namespace discovery fails for a selected context THEN the UI SHALL show the context name
   and the sanitized Kubernetes error message returned by the backend.
2. WHEN discovery succeeds for some selected contexts and fails for others THEN the UI SHALL keep
   the discovered namespaces and identify each failed context separately.
3. Error presentation SHALL NOT expose kubeconfig paths, tokens, certificates, response headers,
   or other credentials.

### Requirement 2 - Allow a known namespace to be queried manually

1. WHEN all selected contexts finish namespace discovery with no namespaces and a discovery error
   THEN the user SHALL be able to enter a namespace manually.
2. A manually entered namespace SHALL be marked as unverified rather than presented as confirmed
   available.
3. The user SHALL be able to add the manual namespace as a target and use the existing pod query.
4. WHEN namespace discovery is still loading, succeeds with an empty result, or returns known
   namespaces THEN an arbitrary manual value SHALL remain unavailable for adding.
5. The existing autocomplete and per-context coverage behavior SHALL remain unchanged when
   discovery succeeds.

### Requirement 3 - Preserve product boundaries

1. The change SHALL remain within the existing frontend namespace-selection flow and read-only
   backend error contract.
2. The change SHALL NOT add Kubernetes mutation operations, renderer filesystem access, or new
   credential exposure.
3. Pod query failures SHALL continue to use the existing per-target error and retry behavior.

## Definition of done

- Discovery errors identify the affected context and useful sanitized reason.
- A known namespace can be entered manually when discovery is unavailable.
- Successful namespace discovery keeps the existing suggestions and validation behavior.
- Focused frontend tests, frontend typecheck, backend tests, and the production build pass.
