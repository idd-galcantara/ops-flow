# Design - ops-union v1.5.0 log grouping cleanup

## Overview

The logs workspace is normally entered with one application selected. The current `GROUP`
`Application`/`Source` control does not change record structure or create actual groups; it only
changes the primary label rendered for a row. That mismatch makes the control misleading. v1.5.0
removes the control and its presentation state, while retaining the compact pod/container identity
already used by log rows.

This is a frontend-only presentation change. The backend remains authoritative for structured source
metadata, filtering, History snapshots/search, and Live subscriptions. The existing aggregate
WebSocket remains the only session transport and receives no new or changed messages.

## Ownership boundaries

- `frontend/src` owns removal of the toolbar control, removal of its local grouping state, row
  identity presentation, focus behavior, and accessibility semantics.
- Existing frontend filter, Search, History, Live, virtualization, and log-density owners remain
  authoritative for those behaviors; this release does not reimplement them.
- Backend and desktop transport owners retain the existing source/filter/session contracts. No
  backend or preload change is authorized by this spec.
- `@ops-union-frontend` owns implementation and focused frontend/accessibility tests.
- `@ops-union-integration-qa` owns read-only regression, transport, and responsive/accessibility
  validation evidence.

## UI contract

The toolbar no longer contains `GROUP`, `Application`, or `Source` grouping options. The remaining
toolbar controls keep their existing order, labels, state, and confirmation rules, with the removed
control simply absent.

Each record row keeps its compact pod/container identity in the established primary identity slot.
The row remains one record with its existing timestamp/message content. A source value may be
visually truncated according to the existing density rules, but its accessible name exposes the
complete safe display value. No group header, aggregate count, source bucket, or alternate grouping
order is introduced.

Structured source fields remain data fields. Rendering must not split, normalize, or infer pod and
container values from the compact display string. Existing safe display and escaping rules continue
to apply.

## State and behavior

The grouping state is removed from the frontend state model, URL/persisted view state if present,
and request-building path. Opening a single-application logs view renders the normal row list
directly:

```text
logs-open -> record-list
record-list -> filter-draft -> filter-confirmed -> record-list
record-list -> history-session | live-subscription
```

The `filter-draft` and `filter-confirmed` transitions retain their current semantics. History keeps
its snapshot/query identity, bounded result windows, ordering, status, and cancellation behavior.
Live keeps its retained buffer, local filters, aggregate subscription, Pause, Clear, and Jump to
latest behavior. Removing the grouping state cannot cancel, restart, or mutate any of these flows.

## Transport and backend boundary

No API, WebSocket frame, source scope, filter schema, query fingerprint, snapshot/session contract,
or Live subscription message changes. A render caused by opening the logs workspace must not issue a
new grouping request or cause an otherwise unnecessary backend/Kubernetes read. Existing requests
continue to carry structured source fields where already required.

The frontend must not emulate grouping by regrouping received records. It renders the existing
record sequence and compact identity supplied by the current data contract.

## Accessibility and layout

The removed control is removed from the accessibility tree and keyboard order. Remaining controls
retain their current labels, roles, focus order, and live/status announcements. Each row exposes a
clear accessible name containing the safe pod/container identity and the log message, while visual
truncation does not make the source unknowable to assistive technology.

The compact identity uses stable layout constraints already used by the log output. Long pod or
container names must not overlap timestamps, messages, row actions, or adjacent rows at supported
desktop and narrow widths. Existing wrapping/truncation behavior is preferred over introducing a
new density mode.

## Validation strategy

- Frontend tests assert absence of the control/options and absence of grouping state or grouping
  requests, while checking compact identity and row-oriented rendering.
- Regression tests exercise filters, confirmed Search, History, Live, virtualization, ordering,
  Pause, Clear, Jump to latest, and existing output density.
- Accessibility checks cover keyboard traversal, accessible row names, truncation, focus order, and
  status announcements at supported viewport sizes.
- Read-only integration checks observe the existing aggregate WebSocket/session traffic and prove
  that no backend/transport contract or Kubernetes read changes.
- Implementation and validation remain separate: passing a static design review is not evidence that
  an open task is complete.