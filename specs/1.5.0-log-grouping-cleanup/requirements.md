# Requirements - ops-union v1.5.0 log grouping cleanup

## Scope

Version 1.5.0 removes the misleading `GROUP` control from the logs workspace. Logs normally open
for one application, and the existing `Application`/`Source` choice does not create grouped output;
it only changes the primary label shown on a log row. The release therefore removes that control and
keeps the established compact pod/container identity in each row.

This is a frontend presentation and state cleanup after v1.4.0. It does not change log records,
source acquisition, filters, Search confirmation, History, Live mode, the aggregate WebSocket, or
any backend/transport contract. No source code is changed by this specification.

## User stories

- As a logs user, I see a single, unambiguous log-row identity without a control that suggests
  unsupported grouping.
- As a logs user, I can identify the pod and container from the compact row identity without losing
  the existing density of the workspace.
- As a logs user, I can continue using filters, Search, History, and Live exactly as before.
- As an assistive-technology user, I can understand the source identity and log content without a
  removed or inactive grouping control being announced.

## Glossary

- **GROUP control:** The existing `Application`/`Source` presentation control in the logs toolbar.
- **Compact identity:** The established row-level pod/container identity, shown without expanding
  the log line into a new source card or group header.
- **Single-application view:** The normal logs entry context in which one application is selected;
  it is not a promise that records are grouped by application.

## Requirements

### LG-1 - Remove misleading grouping affordance

1. The logs workspace SHALL no longer render the `GROUP` control or its `Application`/`Source`
   options.
2. The frontend SHALL not maintain, persist, serialize, or restore a grouping mode for this
   control.
3. Log rows SHALL remain record-oriented. The release SHALL not add application/source group
   headers, buckets, merged rows, or a second ordering rule.
4. Removing the control SHALL not remove or rename the existing source, pod, container, namespace,
   or cluster filter fields.

### LG-2 - Preserve compact source identity

1. Each log row SHALL retain the established compact pod/container identity in the primary row
   presentation.
2. The identity SHALL remain readable at the existing output density and SHALL not be replaced by
   the removed `Application` or `Source` label.
3. Pod and container values SHALL continue to be treated as structured source identity, not parsed
   back from a display label.
4. Long values SHALL remain within their layout bounds without overlapping the timestamp, message,
   controls, or adjacent rows; the existing truncation/wrapping convention SHALL be preserved.

### LG-3 - Preserve logs behavior and transport boundaries

1. Existing Pod, Container, Cluster, Namespace, and Message filters SHALL keep their current
   semantics and confirmation behavior.
2. Search SHALL continue to distinguish draft values from the confirmed query and SHALL not gain a
   grouping request or grouping-specific reset behavior.
3. History SHALL preserve its snapshot/session, bounded results, search, ordering, status, and
   virtualization behavior.
4. Live SHALL preserve its retained-record filtering, aggregate subscription, Pause, Clear, and
   Jump to latest behavior.
5. The existing aggregate WebSocket/session message shapes, routing, source scope, and lifecycle
   SHALL remain unchanged. This release SHALL not add grouping messages or backend fields.
6. Removing the control SHALL not trigger a new Kubernetes read, snapshot read, history query, or
   live subscription change.

### LG-4 - Accessibility and interaction

1. Keyboard navigation SHALL no longer stop on a removed `GROUP` control or on hidden inactive
   grouping options.
2. Accessible names and descriptions SHALL identify the compact pod/container source and the log
   message using the existing row semantics.
3. The compact identity SHALL remain available to assistive technology even when its visual text
   is truncated, subject to the existing safe display-value rules.
4. Removing the control SHALL not change focus order, labels, announcements, or operability of
   remaining filters, Search, History, Live, Pause, Clear, or Jump to latest controls except for
   the expected absence of the grouping control.

### LG-5 - Acceptance and regression evidence

1. Focused frontend tests SHALL prove the `GROUP` control and its options are absent and no grouping
   state is created when the logs workspace opens for one application.
2. Focused frontend tests SHALL prove compact pod/container identity remains present, bounded, and
   accessible for representative short and long values.
3. Regression tests SHALL cover filters, Search confirmation, History, Live, row ordering,
   virtualization, and existing density/presentation behavior.
4. Read-only integration validation SHALL prove the change emits no new backend/transport request
   and does not alter aggregate WebSocket/session behavior.
5. Accessibility validation SHALL cover keyboard navigation, accessible names, focus order, and
   visible text/layout at supported desktop and narrow viewport sizes.
6. Tasks SHALL remain open until their named owner records executable evidence or an explicit
   environment limitation.

## Definition of done

- The misleading `GROUP` control and its `Application`/`Source` options are removed from the logs
  workspace.
- Log rows retain one compact pod/container identity and remain record-oriented; no visual grouping
  behavior is introduced.
- Filters, Search, WebSocket/session transport, History, Live, and existing log density continue to
  behave as before.
- Accessibility and responsive layout evidence covers the remaining controls and compact identity.
- All implementation and validation tasks remain explicitly assigned and open until evidenced.
- This specification changes no source code, backend, transport contract, commit, package, or release.