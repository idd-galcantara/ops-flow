# Implementation Tasks - ops-union v1.4.0 log snapshot export

These tasks depend on v1.3.0 and v1.3.1 as stated below. Every task is intentionally unchecked;
implementation evidence must be recorded by its named owner. These tasks do not authorize
Kubernetes mutation, commit, packaging, or release publication.

## Phase 1 - Export contract and privacy decisions

- [ ] 1.4.0-EX-1 Freeze formats, allowlisted metadata, scope, and current/previous behavior.
  - Define the versioned NDJSON schema, readable-text prefix/multiline policy, allowed metadata,
    source identity privacy treatment, ordering, footer/header records, and complete/bounded/partial
    status representation.
  - Confirm that unfiltered export consumes v1.3.0 snapshots, filtered export consumes the v1.3.1
    query contract, and export never rereads Kubernetes. Decide whether current+previous requires
    separate files (recommended) or approved labeled sections.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: EX-1.1-EX-1.5, EX-2.1-EX-2.6, EX-3.1-EX-6, EX-7.1-EX-7.5
  - _Dependencies: 1.3.0-HS-8, 1.3.1-HS-8
  - _Validation: contract/privacy review against evidenced v1.3.0/v1.3.1 IDs, fields, limits, and
    partial behavior; serialization examples containing null timestamps, multiline text, and both
    variants.
  - _Definition of done: format, scope, metadata, and `--previous` boundaries are implementable and
    cannot be mistaken for a fresh cluster read.

- [ ] 1.4.0-EX-2 Freeze destination, filename, limits, and cleanup policy.
  - Define native save-dialog/approval-token behavior, overwrite and symlink/reparse policy,
    restrictive permissions, safe filename components, staging location, atomic-finalization rules,
    orphan cleanup, and supported platform limitations.
  - Reconcile finite limits for records, output bytes, record/line size, staging disk, memory,
    duration, concurrent exports, and query-window consumption with the v1.3.x limit envelopes.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: EX-4.1-EX-4.6, EX-5.1-EX-5.6, EX-6.1-EX-6.6
  - _Dependencies: 1.4.0-EX-1, 1.3.0-HS-2, 1.3.1-HS-2
  - _Validation: approved desktop/security/limit matrix with boundary and restart-cleanup scenarios;
    no unrestricted renderer path API.
  - _Definition of done: resource and destination behavior is finite, platform-aware, and testable.

## Phase 2 - Backend and desktop export pipeline

- [ ] 1.4.0-EX-3 Implement snapshot/query-bound export streaming and serializers.
  - Add validated export request handling, snapshot/query identity checks, bounded readers, NDJSON
    allowlist serializer, readable-text serializer, progress accounting, limit enforcement, and
    current/previous variant labels.
  - Ensure unknown internal fields, headers, credentials, kubeconfig, raw errors, paths, and
    unrelated environment values cannot flow into output or metadata.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: EX-1.1-EX-1.5, EX-2.1-EX-2.6, EX-3.1-EX-3.6, EX-6.1-EX-6.6, EX-7.1-EX-7.5,
    EX-8.1-EX-8.5
  - _Dependencies: 1.4.0-EX-1, 1.4.0-EX-2
  - _Validation: focused backend tests for valid/invalid scope, filtered/unfiltered readers,
    Unicode/newlines/control characters, null timestamps, limits, ordering, and safe allowlists.
  - _Definition of done: bounded exports produce valid approved formats without Kubernetes access or
    sensitive-field leakage.

- [ ] 1.4.0-EX-4 Implement privileged destination approval, finalization, cancellation, and cleanup.
  - Add the desktop bridge/native save-dialog flow, safe filename generation, destination validation,
    staging writer, atomic completion, overwrite policy, cancellation, orphan cleanup, and safe status
    mapping without exposing unrestricted renderer filesystem access.
  - Preserve existing desktop security boundaries and platform-specific limitations in evidence.
  - _Owner: @ops-union-backend
  - _Copilot agents: @ops-union-backend, @ops-union-integration-qa
  - _Requirements: EX-4.1-EX-4.6, EX-5.1-EX-5.6, EX-6.3-EX-6.6, EX-8.1-EX-8.5
  - _Dependencies: 1.4.0-EX-2, 1.4.0-EX-3
  - _Validation: desktop/backend tests for approval, cancel, disk/permission failure, overwrite,
    path traversal, symlink/reparse behavior, restart/orphan cleanup, and no raw path/error output.
  - _Definition of done: only an approved destination can receive a finalized export and all
    incomplete work is bounded and cleaned.

- [ ] 1.4.0-EX-5 Add versioned export lifecycle messages to the aggregate transport.
  - Implement validated start/accepted/progress/cancel/terminal messages on the existing transport,
    scoped to session/generation/export ID and bounded frame sizes.
  - Reject stale/mismatched snapshot/query/destination approvals and duplicate writers with safe
    codes; preserve existing Live and History messages.
  - _Owner: @ops-union-backend
  - _Copilot agent: @ops-union-backend
  - _Requirements: EX-1.1-EX-1.5, EX-4.1-EX-4.6, EX-5.1-EX-5.6, EX-8.2-EX-8.4
  - _Dependencies: 1.4.0-EX-3, 1.4.0-EX-4
  - _Validation: protocol tests for progress, cancellation, duplicate/stale requests, expired
    snapshots/queries, frame limits, and unchanged existing session behavior.
  - _Definition of done: export lifecycle is observable, cancellable, and isolated from browsing and
    live transport state.

## Phase 3 - Frontend export workflow

- [ ] 1.4.0-EX-6 Implement explicit export review, format/scope controls, and progress UI.
  - Add export action, NDJSON/text choice, scope/range/filter/variant summary, partial/limit
    confirmation, native destination flow, safe proposed filename, progress, cancellation, terminal
    status, and accessible announcements.
  - Keep export out of automatic History/Live changes and preserve current Search, filters, Group,
    Wrap lines, Pause, Clear, Jump to latest, virtualization, and session state.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: EX-1.1-EX-1.5, EX-3.1-EX-3.6, EX-4.1-EX-4.6, EX-5.1-EX-5.3, EX-7.1-EX-7.5
  - _Dependencies: 1.4.0-EX-5, 1.3.0-HS-5, 1.3.1-HS-5
  - _Validation: focused frontend tests for explicit confirmation, scope summary, format, destination
    approval, progress/cancel, stale/expired states, duplicate prevention, accessibility, and no
    mutation of applied search/session state.
  - _Definition of done: users can knowingly export a bounded snapshot/query scope with clear status
    and no browser-side full materialization.

## Phase 4 - Integration, security, and handoff

- [ ] 1.4.0-EX-7 Validate formats, scope, limits, desktop security, cleanup, and read-only behavior.
  - Exercise current snapshots, partial/limited snapshots, filtered v1.3.1 results, multiple sources,
    missing timestamps, multiline/control text, output/disk/memory/concurrency limits, cancellation,
    destination approval, overwrite/path safety, restart cleanup, and explicit previous variants.
  - Compare output against the approved schema and assert absence of kubeconfig, credentials,
    headers, raw bodies/errors, local paths, arbitrary files, and unescaped markup. Verify no
    Kubernetes mutation or export-triggered reread.
  - _Owner: repository maintainer (specs handoff)
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: EX-2.1-EX-2.6, EX-3.1-EX-3.6, EX-4.1-EX-4.6, EX-5.1-EX-5.6, EX-6.1-EX-6.6,
    EX-7.1-EX-7.5, EX-8.1-EX-8.5, RA-1.1-RA-1.5
  - _Dependencies: 1.4.0-EX-3, 1.4.0-EX-4, 1.4.0-EX-5, 1.4.0-EX-6
  - _Validation: read-only integration/security/desktop matrix, output fixtures, resource
    observations, cleanup evidence, and platform limitations; no release or packaging.
  - _Definition of done: output correctness, resource bounds, destination security, cleanup, and
    read-only claims have independent evidence.

- [ ] 1.4.0-EX-8 Complete specification handoff and residual-risk review.
  - Review requirements/design/tasks and implementation evidence, preserve open tasks, and document
    exact v1.3.0/v1.3.1 dependencies, format version, export limits, current/previous support,
    platform caveats, and unresolved privacy decisions.
  - Identify follow-up work without marking it complete: bounded-live export, combined current plus
    previous files, alternative formats, or durable archival are outside this release unless
    separately specified.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: RA-1.1-RA-1.5, Definition of done
  - _Dependencies: 1.4.0-EX-7
  - _Validation: read-only spec/evidence audit and `git diff --check`; no commit, packaging, release,
    or Kubernetes mutation.
  - _Definition of done: implementation handoff names ready evidence, residual risk, and any next
    spec without implying release approval.

## Definition of done

- [ ] Explicit snapshot export supports approved NDJSON and readable text formats with safe metadata,
  source/range/filter scope, progress, cancellation, limits, cleanup, and user-selected destination.
- [ ] Unfiltered and filtered exports consume evidenced v1.3.0/v1.3.1 contracts and do not load the
  whole snapshot/results into the browser or reread Kubernetes.
- [ ] Current, restart/rotation, and explicit `--previous` behavior is labeled and deterministic;
  implicit previous lookup and unlabeled mixing are impossible.
- [ ] Desktop destination and filename security, allowlist sanitization, staging cleanup, resource
  limits, accessibility, and read-only integration evidence are recorded.
- [ ] Existing Live/History/Search/filter/group/wrap/virtualization/transport behavior remains
  covered, and no task is marked complete without named-owner evidence.
- [ ] No source code, commit, packaging, or release activity is implied by this specification.
