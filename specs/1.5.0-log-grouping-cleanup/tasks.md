# Implementation Tasks - ops-union v1.5.0 log grouping cleanup

These tasks depend on the v1.4.0 logs workspace and remain unchecked until named owners provide
evidence. They authorize no backend, transport, Kubernetes, commit, packaging, or release change.

## Phase 1 - Frontend presentation cleanup

- [ ] 1.5.0-LG-1 Remove the misleading GROUP control and grouping state.
  - Remove the `GROUP` control and its `Application`/`Source` options from the logs workspace.
  - Remove only the associated frontend grouping state, persistence, and render branches; preserve
    the remaining toolbar controls and their current order/semantics.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LG-1.1-LG-1.4, LG-3.1-LG-3.6, LG-4.1-LG-4.4
  - _Dependencies: 1.4.0 log workspace behavior
  - _Validation: focused frontend tests show the control/options, grouping state, grouping request,
    and grouping-specific render path are absent while filters and Search remain operable.
  - _Definition of done: the logs workspace has no misleading grouping affordance or state.

- [ ] 1.5.0-LG-2 Preserve compact pod/container identity and accessibility.
  - Keep the established compact pod/container identity in the primary log-row presentation.
  - Verify safe truncation/wrapping and accessible names for short, long, and special display
    values without changing record order or output density.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LG-2.1-LG-2.4, LG-4.2-LG-4.4
  - _Dependencies: 1.5.0-LG-1
  - _Validation: focused component/accessibility tests and narrow/desktop layout scenarios cover
    pod/container identity, message/timestamp boundaries, keyboard traversal, and accessible text.
  - _Definition of done: every row keeps a compact, readable, assistive-technology-visible source
    identity without a new grouping presentation.

## Phase 2 - Regression and boundary validation

- [ ] 1.5.0-LG-3 Verify filters, Search, History, Live, and presentation regressions.
  - Exercise source filters, Message filters, Search draft/confirmation, History snapshots and
    search results, Live retained filtering, virtualization, ordering, Pause, Clear, Jump to latest,
    and existing density/wrapping behavior.
  - Confirm the removal does not reset confirmed filters, alter mode transitions, regroup records,
    or change visible status/error behavior.
  - _Owner: @ops-union-frontend
  - _Copilot agent: @ops-union-frontend
  - _Requirements: LG-2.1-LG-3.4, LG-4.4, LG-5.1-LG-5.3
  - _Dependencies: 1.5.0-LG-1, 1.5.0-LG-2
  - _Validation: focused frontend regression suite with History and Live scenarios and explicit
    assertions for record order, filter state, Search confirmation, and bounded rendering.
  - _Definition of done: existing logs workflows remain behaviorally unchanged except for removal
    of the grouping affordance.

- [ ] 1.5.0-LG-4 Verify transport, read-only, responsive, and accessibility boundaries.
  - Observe aggregate WebSocket/session traffic and confirm no new grouping message, backend field,
    Kubernetes read, snapshot read, or Live subscription change occurs.
  - Validate keyboard order, accessible names, visible focus, truncation/wrapping, and non-overlap
    at supported desktop and narrow viewport sizes.
  - _Owner: @ops-union-integration-qa
  - _Copilot agent: @ops-union-integration-qa
  - _Requirements: LG-3.5-LG-3.6, LG-4.1-LG-4.4, LG-5.4-LG-5.6
  - _Dependencies: 1.5.0-LG-3
  - _Validation: read-only transport/session observation, accessibility checks, responsive scenarios,
    and documented environment limitations where executable evidence is unavailable.
  - _Definition of done: no backend/transport scope expansion or accessibility regression is inferred
    from the frontend diff; each claim has recorded evidence.

## Definition of done

- [ ] `GROUP`, `Application`, and `Source` grouping options are absent from the logs workspace.
- [ ] Compact pod/container identity and record-oriented output remain intact and accessible.
- [ ] Filters, Search, WebSocket/session transport, History, Live, and existing presentation behavior
  remain covered by focused regression evidence.
- [ ] All tasks remain open until their named owners record validation evidence or limitations.
- [ ] No source code, backend, transport, Kubernetes, commit, packaging, or release activity is
  implied by this specification.