# Design - ops-union v1.4.0 log snapshot export

## Overview

Version 1.4.0 consumes the bounded immutable history contract from v1.3.0 and, when filtered,
the query/result contract from v1.3.1. Export is an explicit privileged desktop workflow. The
backend streams sanitized records from a validated snapshot/query reader into a staging file,
reports progress over the existing session transport, atomically finalizes the user-approved
format/destination, and cleans incomplete work.

The design choice is that export never initiates a Kubernetes read. A snapshot is the source of
truth, and a filtered export is a server-side query over that snapshot. This preserves consistency,
prevents a long export from changing cluster load, and makes the exported scope explainable.

## Ownership boundaries

- v1.3.0 history storage/session owns snapshot IDs, generation, immutable records, indexes, source
  continuity, TTL, and source/partial/limit metadata.
- v1.3.1 history search owns filtered query identity, normalization, result ordering, cursors,
  cancellation, and server-side match semantics.
- A backend export owner owns request validation, bounded record streaming, format serialization,
  staging, finalization, cleanup, export limits, and safe status/error mapping. It reads through
  snapshot/query abstractions and does not call Kubernetes or accept arbitrary paths.
- The existing aggregate WebSocket/session owner carries export accepted/progress/terminal/cancel
  messages without adding one socket per export or per source.
- `desktop/src/preload.ts` owns validated bridge methods for native save-dialog approval and export
  status. The renderer never opens a filesystem path or writes a file.
- `frontend/src` owns explicit export confirmation, scope/format summary, progress/cancel state,
  and History/Live UI. It does not serialize the snapshot in the browser.
- `@ops-union-backend` owns export protocol, streaming, serialization, limits, cleanup, and tests.
- `@ops-union-frontend` owns export controls, state, summaries, accessibility, and tests.
- `@ops-union-integration-qa` owns read-only integration, desktop permission, security, limit,
  cross-platform, and regression evidence.
- Specification handoff is coordinated by the repository maintainer; handoff does not close
  implementation or validation tasks.

## Export request and state model

The request binds all scope identity before destination approval:

```ts
interface ExportRequest {
  requestId: string;
  snapshotId: string;
  sessionGeneration: string;
  queryId?: string;
  queryFingerprint?: string;
  format: 'ndjson' | 'text';
  variant: 'current' | 'previous';
  sourceScope: SourceTuple[];
  range: AppliedRange;
  limitsPolicy: 'standard' | 'bounded';
}
```

`sourceScope`, `range`, and `variant` are verified against the snapshot manifest and query result
metadata. The client cannot replace them with a different source set after confirmation. A previous
variant is accepted only if v1.3.0 recorded it explicitly; no `--previous` flag is added by export.

The frontend state is:

```text
idle
  -> scope-review
  -> destination-pending
  -> export-validating
  -> export-queued
  -> export-writing
  -> export-finalizing
  -> complete

export-writing -> cancelling -> cancelled -> staging-cleaned
export-* -> partial | failed | expired
```

Opening the destination dialog is not export execution. The user reviews format, source/range/
filter summary, partial/limit warnings, and the proposed filename before the backend starts. A
second export action is disabled or assigned a distinct explicit request after the first terminal
state; duplicate starts cannot share a writer.

## Exportable records and metadata

### NDJSON schema

The canonical output uses one object per line. A safe initial schema is:

```json
{"type":"log","schemaVersion":1,"variant":"current","source":{"cluster":"...","namespace":"...","pod":"...","container":"..."},"sequence":42,"line":43,"timestamp":null,"message":"..."}
```

The exact allowlist must be implemented as a serializer, not by copying arbitrary backend objects.
A small header record may carry `type: "export"`, format/schema version, generated time, opaque
snapshot/query IDs if approved, range, counts/status, and a non-sensitive filter summary. Header
and record fields are versioned; unknown fields from internal records are dropped. JSON escaping
keeps embedded newlines/control characters valid and preserves message content.

### Readable text

Text begins with a short safe header, for example format/schema, range, source count, filter
summary, and partial/limit status. Each log line uses a stable prefix such as:

```text
[2026-09-16T12:00:00Z] cluster/ns pod/container [current] message
[no-timestamp] cluster/ns pod/container [current] message continued with escaped/newline policy
```

The final prefix and multiline/CRLF escaping must be fixed before implementation. Source values are
validated display fields from the selected scope; messages are rendered as text, never interpreted
as markup. The text format is for reading, not round-tripping.

Cluster and namespace may be included because they identify the user-selected source scope, but the
metadata allowlist excludes connection endpoints, auth details, headers, kubeconfig values, raw
responses, and unrelated environment data. If product privacy review classifies any scope value as
sensitive, the serializer must redact it consistently and preserve a stable source key for
correlation without leaking the original value.

## Scope and v1.3.1 relationship

The default source of unfiltered export is the v1.3.0 immutable snapshot reader. A filtered export
uses the v1.3.1 query reader with the same snapshot version and query fingerprint. It consumes
query results in deterministic windows or a bounded streaming cursor; it does not ask the frontend
for all pages and does not reapply matching rules locally.

The export summary states:

- snapshot/session and query status, using opaque IDs only when approved;
- selected source count and safe source summary;
- applied range and current/previous variant;
- active filter/search summary without exposing internal request payloads;
- complete/bounded/partial status and known limits;
- selected format and proposed destination filename.

Grouping and Wrap lines do not alter NDJSON records. Text may have a separate explicit layout option,
but the default is record order and safe source/timestamp/message presentation. Current Live export
is not part of the default contract; if later enabled, it must be a separately named bounded-live
mode and cannot claim snapshot completeness.

## Destination and desktop boundary

The renderer requests a native save dialog with a suggested sanitized filename and allowed format
extensions. The dialog returns an approval token or equivalent privileged handle, not an unrestricted
renderer path. The backend/desktop writer validates that token, destination policy, extension, and
user approval before opening a staging file.

Suggested filename components are fixed and bounded, for example `ops-union-logs-<scope>-<date>.ndjson`.
Scope is normalized to safe ASCII-like filename characters, length-limited, and never contains raw
query text, credentials, error text, slashes, `..`, control characters, or full paths. The platform
must decide overwrite confirmation. The writer uses restrictive permissions where supported and
must document symlink/reparse-point behavior. Staging occurs in an application-owned temporary
location; only a successfully finalized file reaches the approved destination.

## Streaming, limits, cancellation, and cleanup

The export reader yields records from a snapshot or query cursor. It passes each record through the
allowlist serializer and a bounded writer. It tracks records, bytes, source progress, known totals,
and limit reasons. A writer flushes incrementally; no complete output is held in browser memory.

Proposed limit categories are inherited from v1.3.0/v1.3.1 and require final numeric reconciliation
before implementation: source/session record and byte caps, maximum output bytes, maximum line and
record size, staging disk, in-flight memory, duration, result-window consumption, and one or a
small bounded number of concurrent exports. A limit produces `partial`/`limit-reached`, closes the
staging writer safely, and never silently labels truncated output complete.

Cancellation checks occur between bounded records/bytes. Cancellation closes readers and writers,
removes staging output, releases the export slot, and leaves the snapshot/query lifecycle unchanged.
Completion writes a footer/terminal metadata record where the format allows it, flushes and validates
counts, then renames atomically when the platform permits. Startup cleanup removes orphan staging
files using an application-owned manifest and grace period; it never deletes a user-selected
completed destination.

## Protocol

The existing aggregate WebSocket can carry versioned messages equivalent to:

```text
client -> server: export.start { requestId, sessionId, generation, request, destinationApproval }
server -> client: export.accepted { requestId, exportId, scopeSummary }
server -> client: export.progress { exportId, phase, records, bytes, knownTotal, status }
client -> server: export.cancel { exportId, generation }
server -> client: export.terminal { exportId, status, records, bytes, limitReason, safeCode }
```

The actual names follow the existing protocol. Destination approval is validated at the privileged
boundary and is not a user-provided arbitrary path in a WebSocket payload. Messages contain no raw
filesystem paths or sensitive data. Export status is scoped to the session/generation and stale
status frames are discarded by the frontend.

## Current, restart, and previous variants

A current snapshot can contain continuity metadata if v1.3.0 observed rotation/restart. Export
preserves that safe status and does not invent missing records. An empty/current failure never
triggers a previous read.

`--previous` is a source acquisition choice, not an export option. If v1.3.0 has not captured an
explicit previous variant, the export UI reports unavailable. If it has, export accepts the exact
previous snapshot/query only when the variant is labeled in both metadata and output. A combined
current+previous export, if approved later, is a single file only with distinct variant labels and
deterministic sections; the default implementation should require separate exports to make mixing
harder to misunderstand.

## Security and validation strategy

### Backend/desktop checks

- Test allowlist serialization, NDJSON validity, UTF-8/control/newline escaping, text formatting,
  null timestamps, current/previous labels, source/range/filter scope, ordering, counts, and
  partial/limit metadata.
- Test snapshot/query mismatch, expired/cancelled sessions, destination approval, filename/path
  validation, overwrite policy, symlink/reparse-point handling as supported, atomic finalization,
  staging cleanup, restart/orphan cleanup, cancellation, disk-full/permission errors, concurrency,
  and safe error mapping.
- Assert no serializer path can copy arbitrary object fields, headers, credentials, kubeconfig,
  raw response/error bodies, local paths, or environment values.

### Frontend checks

- Test explicit export confirmation, format and scope summary, partial warnings, destination dialog
  result, sanitized filename, progress phases, cancel/terminal states, expired query/snapshot,
  no mutation of Search/session state, accessible announcements, and duplicate prevention.
- Test filtered exports use the v1.3.1 identity and unfiltered exports use v1.3.0 snapshot identity.

### Read-only integration and platform checks

- Export fixed snapshots/query fixtures without Kubernetes mutation and compare output records,
  counts, filters, order, statuses, and absence of sensitive fields.
- Verify the browser cannot write arbitrary files or receive paths, staging files disappear on
  cancellation, destination selection is honored, and multi-source/limit behavior is bounded.
- Run workspace tests, typechecks, builds, and `git diff --check` after implementation. Record
  unavailable OS, desktop, disk, browser, or permission checks as limitations.
