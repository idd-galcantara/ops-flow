# Requirements - ops-union v1.4.0 log snapshot export

## Scope

Version 1.4.0 adds an explicit user-initiated export of logs captured by the v1.3.0 history
snapshot session. It may export the complete available snapshot or a bounded scope selected by the
user, including source scope, range, and the applied v1.3.1 server-side filters/search. Export is a
separate operation from browsing and SHALL produce a user-visible progress/cancellation lifecycle.

NDJSON is the preferred machine-readable format and a legible text format is required for ordinary
review. The user chooses the destination through the desktop's native save flow. The renderer does
not receive filesystem access and the backend SHALL write only to a validated destination approved
by the desktop bridge.

This release depends on v1.3.0 for immutable snapshot storage/lifecycle and on v1.3.1 when a
server-side query is included in export. It does not reread Kubernetes, add `--previous` implicitly,
change live transport, persist kubeconfig, or publish artifacts. Exporting means exporting records
already present in an eligible snapshot, subject to explicit limits and source availability.

## User stories

- As a logs user, I can explicitly choose NDJSON or readable text and export a known history scope.
- As a logs user, I can see the selected sources, range, filters, result/snapshot status, progress,
  cancellation, limits, and the final destination without guessing what was exported.
- As a logs user, I can choose a safe destination and receive a safe filename that does not expose
  credentials, kubeconfig values, raw errors, or uncontrolled path segments.
- As a logs user, I can export a filtered server-side history result without loading the entire
  snapshot into the browser.
- As an operator, I can verify that exports are read-only, bounded, temporary working files are
  cleaned, and current versus explicitly captured `--previous` logs cannot be mixed silently.

## Glossary

- **Export request:** Explicit user action plus format, snapshot/query identity, scope, destination
  approval, and limit policy.
- **Snapshot export:** Records read from one immutable v1.3.0 snapshot version; it never means a
  fresh Kubernetes log request.
- **Filtered export:** A snapshot export evaluated through the v1.3.1 query contract, including
  structured filters and optional message search.
- **NDJSON:** One sanitized log record per JSON line, with a versioned schema and no HTML.
- **Readable text:** A line-oriented human-readable representation with stable source context and
  escaped message content; it is not a reparseable protocol format.
- **Export scope:** Selected snapshot/session, source tuples, range, query/filters, current/previous
  variant, and any explicit record/window bounds.
- **Destination approval:** A path returned by the native desktop save dialog and validated by the
  privileged writer; the renderer cannot supply an arbitrary filesystem write path directly.
- **Current variant:** Logs from the ordinary current container read.
- **Previous variant:** Logs from an explicitly captured `--previous` source/read variant. It is not
  inferred from an empty/current snapshot, restart, or export failure.

## Requirements

### EX-1 - Explicit export and dependency contract

1. Export SHALL require an explicit user action and SHALL never start on opening History mode,
   receiving a page, changing a filter, or closing the workspace.
2. An export request SHALL bind to exactly one valid v1.3.0 snapshot ID/generation and SHALL record
   whether it is complete, bounded, partial, cancelled, or otherwise limited.
3. A filtered export SHALL bind to one v1.3.1 query ID/fingerprint and snapshot version. The export
   SHALL reject a missing, stale, expired, cancelled, or mismatched query/snapshot rather than
   silently exporting a different result set.
4. The export control SHALL be unavailable or require an explicit user decision when the snapshot is
   still reading, expired, cancelled, unavailable, or partial in a way that makes the scope unclear.
   If partial export is allowed, the UI SHALL state that it is partial before confirmation.
5. Export SHALL not reread Kubernetes, create a replacement snapshot, alter the live/history session,
   change Search-applied filters, or change the user's current scroll/window state.

### EX-2 - Format and safe content contract

1. The preferred machine-readable format SHALL be versioned NDJSON. Each output record SHALL contain
   only an allowlisted, sanitized schema: schema version, source tuple, source-local sequence or
   line number, timestamp or null, message, and explicitly approved non-sensitive status fields.
2. NDJSON SHALL escape newlines/control characters according to JSON rules, use valid UTF-8, and
   emit one complete JSON object per line. It SHALL never contain HTML, raw protocol frames, headers,
   credentials, kubeconfig fields, local paths, stack traces, or raw Kubernetes error bodies.
3. Readable text SHALL be line-oriented and stable enough for review. It SHALL include approved source
   identity and timestamp/null marker where available, preserve message content with an unambiguous
   escaping/continuation rule, and include a short non-sensitive export header.
4. The format SHALL identify whether records are current or explicitly previous. Current and previous
   records SHALL not be merged without a visible variant field/header and a documented ordering rule.
5. Export metadata SHALL be limited to non-sensitive values such as export schema/format, creation
   time, opaque snapshot/query IDs where approved, applied range, selected source counts, filter
   summary, record/byte counts, limit/partial status, and application version if approved.
6. Metadata SHALL not include kubeconfig contents, tokens, client certificates, authorization or
   cookie headers, request/response headers, request bodies, raw error bodies, filesystem paths,
   cluster connection details, or unrelated local environment data.

### EX-3 - Scope, sources, range, filters, and ordering

1. The export UI SHALL show and confirm the effective snapshot/session, source tuples or a safe
   source summary, applied range, current/previous variant, completeness/partial status, and active
   v1.3.1 filters/search before writing.
2. Export SHALL support the selected source scope and the applied range from the snapshot. It SHALL
   not invent records outside the immutable snapshot or silently include unselected contexts.
3. A filtered export SHALL use the v1.3.1 server-side query contract and export exactly the query's
   accepted result scope, subject to export limits. It SHALL not reimplement a different case,
   filter, ordering, or timestamp rule in the browser.
4. An unfiltered export SHALL use snapshot line/sequence ordering and preserve missing-timestamp
   records. A filtered export SHALL use the query result ordering and cursor/limit semantics.
5. Grouping and Wrap lines SHALL be presentation choices unless the user explicitly selects a text
   layout option; they SHALL not mutate records or cause a second Kubernetes/session request.
6. A live retained buffer may be exportable only through an explicitly approved bounded-live export
   mode. The default 1.4.0 export scope is History snapshots; the UI SHALL not imply that a live
   export is a complete cluster history.

### EX-4 - Progress, cancellation, and lifecycle

1. Export SHALL expose queued, validating, preparing, writing, finalizing, complete, partial,
   cancelled, failed, and expired states as applicable, with accessible status text.
2. Progress SHALL report honest units such as records/bytes written and known totals. It SHALL be
   indeterminate when a trustworthy total is unavailable and SHALL not claim complete before the
   file is finalized and validated.
3. Cancellation SHALL be idempotent, stop further reads/writes at a bounded checkpoint, close file
   handles, remove incomplete temporary output, and leave the source snapshot/query available until
   its own v1.3.x TTL unless the user explicitly cancels that session too.
4. A completed export SHALL be atomically finalized where the platform permits. A partial or failed
   export SHALL not be presented as complete and SHALL not leave an untracked final-looking file.
5. Repeated export actions SHALL not create concurrent unbounded writers. The implementation SHALL
   define per-session/process export concurrency and a safe capacity response.
6. Cleanup SHALL remove staging files, cancelled outputs, expired export metadata, and orphaned
   export work after restart according to a bounded TTL/grace policy. The user-selected completed
   destination is not deleted by automatic temporary cleanup.

### EX-5 - Destination, filename, and desktop security

1. The user SHALL choose the destination through the native desktop save dialog or an equivalent
   privileged approved picker. The renderer SHALL not write files or receive unrestricted path APIs.
2. The application SHALL propose a safe filename derived only from sanitized app/scope/date/format
   components, with a fixed extension (`.ndjson` or `.log`/`.txt`) and bounded length. Separators,
   control characters, traversal segments, credentials, tokens, and raw error text SHALL be removed
   or replaced.
3. Existing-file behavior SHALL be explicit and platform-correct: the native dialog MAY confirm
   overwrite, while the writer SHALL refuse an unapproved path or unexpected extension/policy.
4. The writer SHALL validate the approved destination, use restrictive permissions where supported,
   and avoid following unsafe links or writing outside the approved user-selected target according
   to the desktop platform contract.
5. Export diagnostics SHALL expose only a safe correlation/status code. They SHALL not expose local
   paths, environment variables, kubeconfig data, credentials, headers, or raw response/error text.
6. Export SHALL not add renderer filesystem access, change authentication, persist kubeconfig,
   introduce a download server, or broaden desktop security permissions without separate approval.

### EX-6 - Limits and resource behavior

1. The export contract SHALL define finite limits for records, source count, snapshot bytes read,
   output bytes, text line length, NDJSON record size, metadata size, staging disk, in-flight
   memory, export duration, concurrent exports, and result-window/query consumption.
2. Limits SHALL be checked before and during writing. A limit hit SHALL produce a visible bounded or
   partial status, count/byte evidence where known, and a stable reason; silent truncation is not
   allowed.
3. The export SHALL stream from the snapshot/query reader into a bounded staging writer and SHALL
   not load all records, all search results, or the whole output into browser/process memory.
4. Multi-source exports SHALL enforce both per-source and aggregate limits. A large source set SHALL
   not multiply allowances without an aggregate cap.
5. Disk-full, permission, destination-unavailable, snapshot-expired, query-expired, cancellation,
   and serialization failures SHALL be distinguishable safe outcomes with cleanup behavior.
6. The implementation SHALL record and test the selected limit values before claiming completion;
   values may be tighter than proposed defaults from v1.3.0/v1.3.1.

### EX-7 - Current, restarted, and `--previous` logs

1. The default export SHALL export only current-variant records present in the selected snapshot.
   It SHALL not invoke Kubernetes `--previous` during export.
2. Logs from a restarted container SHALL be exported according to the v1.3.0 source-generation and
   continuity metadata. A restart SHALL not cause current and previous records to be silently mixed.
3. If v1.3.0 captured an explicit `--previous` snapshot/read variant, v1.4.0 SHALL either support
   exporting it as a separately labeled variant or explicitly report that the variant is not
   exportable. It SHALL never infer or synthesize it.
4. If both current and previous variants are selected in a future approved flow, the export SHALL
   use distinct variant metadata/header sections and a deterministic documented ordering; a single
   unlabeled combined stream is forbidden.
5. An empty current snapshot, rotation, source failure, or missing container SHALL not trigger an
   implicit previous-log lookup.

### EX-8 - Read-only, privacy, and regression boundaries

1. Export SHALL be read-only with respect to Kubernetes and application configuration. It SHALL not
   add permissions, mutate resources, or execute arbitrary cluster commands.
2. Existing History browsing, History search, Live mode, Search confirmation, filters, grouping,
   wrapping, virtualization, aggregate WebSocket, source scope, safe errors, and desktop bridge
   behavior SHALL remain intact when export is unused.
3. Export output, progress, errors, screenshots, and test evidence SHALL not include kubeconfig,
   credentials, headers, raw error bodies, request bodies, or unrelated local files.
4. Export authorization shall be scoped to the user-selected snapshot/query and destination. A
   client cannot substitute a filesystem path, snapshot ID, query ID, source tuple, or cursor to
   escape the validated session scope.
5. The application SHALL retain enough safe metadata to explain what was exported without retaining
   a durable server archive after temporary work and export metadata TTL cleanup.

### RA-1 - Acceptance and evidence

1. Focused backend tests SHALL cover NDJSON/text serialization, escaping, metadata allowlists,
   source/range/filter scope, current/previous labeling, ordering, limits, streaming, cancellation,
   atomic finalization, cleanup, destination validation, and safe errors.
2. Focused frontend/desktop tests SHALL cover explicit confirmation, format/scope summary, native
   destination selection, safe filename, progress/cancel states, disabled/expired/partial sources,
   and no mutation of current search/session state.
3. Integration validation SHALL prove a browser does not receive unrestricted filesystem access, an
   export does not reread Kubernetes, output is bounded and sanitized, cancellation removes staging
   files, and no sensitive material is included.
4. Existing v1.3.0 snapshot and v1.3.1 search tests SHALL continue to pass, including snapshot
   consistency, partial/limit behavior, result ordering, cancellation, and TTL boundaries.
5. Tasks SHALL remain open when browser, desktop, platform-permission, disk, or security evidence is
   unavailable; a static plan is not acceptance evidence.

## Definition of done

- Export is an explicit, snapshot-bound, user-confirmed operation with NDJSON and readable-text
  formats, effective scope metadata, progress, cancellation, safe filename, and chosen destination.
- Filtered export consumes the v1.3.1 query contract without loading all results into the browser;
  unfiltered export consumes the v1.3.0 snapshot contract.
- Output and metadata are allowlisted and sanitized; kubeconfig, credentials, headers, raw bodies,
  local paths, and unrelated files cannot be included.
- Limits, multi-source behavior, atomic finalization, cleanup, restart/rotation behavior, and
  current versus explicit `--previous` handling are defined and evidenced.
- Existing Live/History browsing and search behavior, read-only Kubernetes access, desktop security,
  and transport contracts remain intact.
- Named owners record automated, read-only integration, desktop/security, and resource evidence;
  unresolved platform limitations and decisions remain explicit.
- This specification changes no source code, does not commit, package, or publish a release.
