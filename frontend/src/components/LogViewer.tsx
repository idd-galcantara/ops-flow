import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pause, Play, Search, Trash2, X } from 'lucide-react';
import { aggregateLogsUrl, serializeLogSubscription } from '../api';
import { LOG_PERIODS, resolveLogRange } from '../logsRange';
import { cloneLogSearchValues, DEFAULT_LOG_SEARCH_VALUES, searchHasPendingChanges, transportSearchValuesEqual, type LogSearchState } from '../logsSearch';
import { DEFAULT_LOG_DISPLAY_STATE, logRecordKey, setWrapLines, type LogGrouping } from '../logsPresentation';
import { appendBoundedEvent, CLIENT_LOG_BUFFER, filterLogRecords, logFilterValues, sourceLabel, sourceStateForEvent, sourcesForPods, type LogRecordFilters } from '../logsSession';
import { ErrorState } from './Feedback';
import type { AggregateLogEvent, LogEventRecord, LogLimits, LogSource, LogSourceState, NormalizedPod, PodRef, SummaryReason, Target } from '../types';

const DEFAULT_LIMITS: LogLimits = { maxLinesPerSource: 2_000, maxBytesPerSource: 2 * 1024 * 1024, maxLinesTotal: 10_000, maxBytesTotal: 10 * 1024 * 1024 };
type ConnectionState = 'validating' | 'connecting' | 'streaming' | 'paused' | 'ended' | 'partial' | 'error';

interface LogViewerProps {
  pod: PodRef;
  pods?: PodRef[];
  sources?: LogSource[];
  consultedContexts?: Target[];
  onChangeSources?: () => void;
  onClose?: () => void;
}

export function LogViewer({ pod, pods = [pod], sources, consultedContexts, onChangeSources, onClose }: LogViewerProps) {
  const availableSources = useMemo(() => sources ?? sourcesForPods(pods.map((item): NormalizedPod => ({ cluster: item.cluster, namespace: item.namespace, name: item.name, status: '', ready: '', restarts: 0, node: '', ageSeconds: 0, containers: item.containers, application: item.application ?? { key: `pod:${item.name}`, name: item.name, source: 'pod' } }))), [pods, sources]);
  const [search, setSearch] = useState<LogSearchState>(() => ({ draft: cloneLogSearchValues(DEFAULT_LOG_SEARCH_VALUES), applied: cloneLogSearchValues(DEFAULT_LOG_SEARCH_VALUES) }));
  const [display, setDisplay] = useState(DEFAULT_LOG_DISPLAY_STATE);
  const [events, setEvents] = useState<LogEventRecord[]>([]);
  const [sourceStates, setSourceStates] = useState<Map<string, LogSourceState>>(new Map());
  const [state, setState] = useState<ConnectionState>('validating');
  const [error, setError] = useState<string>();
  const [validationError, setValidationError] = useState<string>();
  const [isSearchApplying, setIsSearchApplying] = useState(false);
  const [summaryReason, setSummaryReason] = useState<SummaryReason | undefined>(undefined);
  const [acceptedLimits, setAcceptedLimits] = useState(DEFAULT_LIMITS);
  const [paused, setPaused] = useState(false);
  const [receivedWhilePaused, setReceivedWhilePaused] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const outputRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<SummaryReason | undefined>(undefined);
  const pausedRef = useRef(paused);
  const acceptedLimitsRef = useRef(acceptedLimits);
  pausedRef.current = paused;
  acceptedLimitsRef.current = acceptedLimits;
  const sourceStatesRef = useRef(sourceStates);
  sourceStatesRef.current = sourceStates;
  const selectedSources = availableSources;
  const { draft, applied } = search;
  const hasPendingSearch = searchHasPendingChanges(search);
  const filterValues = useMemo(() => logFilterValues(selectedSources, events), [selectedSources, events]);
  const appliedCustomRange = useMemo(() => ({ from: applied.customFrom, to: applied.customTo }), [applied.customFrom, applied.customTo]);
  const appliedRangeResult = useMemo(() => resolveLogRange(applied.period, new Date(), appliedCustomRange), [applied.period, appliedCustomRange]);
  const visibleEvents = useMemo(() => filterLogRecords(events, applied.filters), [events, applied.filters]);
  const virtualizer = useVirtualizer({
    count: visibleEvents.length,
    getScrollElement: () => outputRef.current,
    estimateSize: () => 34,
    measureElement: (element) => element.getBoundingClientRect().height,
    getItemKey: (index) => visibleEvents[index] ? logRecordKey(visibleEvents[index]) : index,
    overscan: 10,
  });

  useEffect(() => {
    setEvents([]);
    setSourceStates(new Map());
    setSummaryReason(undefined);
    summaryRef.current = undefined;
    setError(appliedRangeResult.error);
    setReceivedWhilePaused(0);
    setAutoScroll(true);
    setAcceptedLimits(DEFAULT_LIMITS);
    if (appliedRangeResult.error) {
      setIsSearchApplying(false);
      setState('error');
      return;
    }
    if (selectedSources.length === 0) {
      setIsSearchApplying(false);
      setState('error');
      setError('No confirmed log sources are available.');
      return;
    }
    let active = true;
    const socket = new WebSocket(aggregateLogsUrl());
    setState('connecting');
    socket.onopen = () => {
      if (active && appliedRangeResult.range) socket.send(serializeLogSubscription({ type: 'subscribe', period: applied.period, follow: applied.follow, ...appliedRangeResult.range, sources: selectedSources, limits: DEFAULT_LIMITS }));
    };
    socket.onmessage = (message: MessageEvent<string>) => {
      if (!active) return;
      let event: AggregateLogEvent;
      try {
        event = JSON.parse(message.data) as AggregateLogEvent;
      } catch {
        setError('The log stream returned an invalid event.');
        setIsSearchApplying(false);
        setState('error');
        return;
      }
      if (event.type === 'accepted') {
        setAcceptedLimits(event.limits);
        setIsSearchApplying(false);
        setState(pausedRef.current ? 'paused' : 'streaming');
        return;
      }
      if (event.type === 'sourceStarted' || event.type === 'sourceEnded' || event.type === 'sourceError' || event.type === 'sourceWarning') {
        setSourceStates((current) => {
          const next = sourceStateForEvent(current, event);
          sourceStatesRef.current = next;
          return next;
        });
        if (event.type === 'sourceError') setState('partial');
        return;
      }
      if (event.type === 'line') {
        const source = sourceStatesRef.current.get(event.sourceId)?.source ?? selectedSources.find((item) => item.sourceId === event.sourceId);
        if (!source) return;
        setEvents((current) => appendBoundedEvent(current, { source: event.application ? { ...source, application: event.application } : source, event }, Math.min(CLIENT_LOG_BUFFER, acceptedLimitsRef.current.maxLinesTotal)));
        if (pausedRef.current) setReceivedWhilePaused((count) => count + 1);
        setState((current) => current === 'partial' || pausedRef.current ? 'paused' : 'streaming');
        return;
      }
      if (event.type === 'summary') {
        summaryRef.current = event.reason;
        setSummaryReason(event.reason);
        setAcceptedLimits(event.limits);
        setIsSearchApplying(false);
        setState((current) => current === 'partial' ? 'partial' : 'ended');
        return;
      }
      if (event.type === 'error') {
        setError(event.message);
        setIsSearchApplying(false);
        setState('error');
      }
    };
    socket.onerror = () => {
      if (active) {
        setError('Could not connect to the aggregate log stream.');
        setIsSearchApplying(false);
        setState('error');
      }
    };
    socket.onclose = () => {
      if (active) {
        setIsSearchApplying(false);
        setState((current) => current === 'error' || current === 'partial' || summaryRef.current ? current : 'ended');
      }
    };
    return () => {
      active = false;
      socket.close();
    };
  }, [applied.follow, applied.period, appliedRangeResult, selectedSources]);

  useEffect(() => {
    virtualizer.measure();
  }, [display.wrapLines, virtualizer]);

  useEffect(() => {
    if (autoScroll && !paused && visibleEvents.length > 0) virtualizer.scrollToIndex(visibleEvents.length - 1, { align: 'end' });
  }, [autoScroll, paused, visibleEvents.length, virtualizer]);

  const sourceErrors = [...sourceStates.values()].filter((item) => item.status === 'error');
  const totalDropped = [...sourceStates.values()].reduce((sum, item) => sum + item.counters.droppedLines, 0);
  const totalLines = [...sourceStates.values()].reduce((sum, item) => sum + item.counters.emittedLines, 0);
  const updateDraft = (update: (current: LogSearchState['draft']) => LogSearchState['draft']) => {
    setValidationError(undefined);
    setSearch((current) => ({ ...current, draft: update(current.draft) }));
  };
  const updateFilter = (field: keyof LogRecordFilters, value: string) => updateDraft((current) => ({ ...current, filters: { ...current.filters, [field]: value } }));
  const clearFilters = () => updateDraft((current) => ({ ...current, filters: { pod: '', container: '', cluster: '', namespace: '', text: '' } }));
  const draftFilterCount = Object.values(draft.filters).filter(Boolean).length;
  const activeFilterCount = Object.values(applied.filters).filter(Boolean).length;
  const confirmSearch = () => {
    if (isSearchApplying) return;
    const candidateRange = resolveLogRange(draft.period, new Date(), { from: draft.customFrom, to: draft.customTo });
    if (candidateRange.error) {
      setValidationError(candidateRange.error);
      return;
    }
    setValidationError(undefined);
    const transportChanged = !transportSearchValuesEqual(applied, draft);
    setIsSearchApplying(transportChanged);
    setSearch({ draft: cloneLogSearchValues(draft), applied: cloneLogSearchValues(draft) });
  };
  const onScroll = () => {
    const element = outputRef.current;
    if (element) setAutoScroll(element.scrollHeight - element.scrollTop - element.clientHeight < 40);
  };
  const jumpToLatest = () => {
    setAutoScroll(true);
    if (visibleEvents.length > 0) virtualizer.scrollToIndex(visibleEvents.length - 1, { align: 'end' });
  };
  const application = selectedSources[0]?.application;
  const contexts = consultedContexts && consultedContexts.length > 0
    ? consultedContexts.map((context) => `${context.cluster} / ${context.namespace}`)
    : [...new Set(selectedSources.map((source) => `${source.cluster} / ${source.namespace}`))];
  const selectedPods = new Set(selectedSources.map((source) => `${source.cluster}\u0000${source.namespace}\u0000${source.pod}`)).size;
  const sidecarCount = selectedSources.filter((source) => source.containerRole === 'sidecar').length;

  return <div className="log-viewer">
    <header className="log-workspace-header">
      <div className="log-workspace-identity">
        <span className="eyebrow">Logs workspace</span>
        <h2 title={application?.name ?? pod.name}>{application?.name ?? pod.name}</h2>
        <span title={application?.key}>{application?.key ?? 'pod identity'}</span>
      </div>
      <div className="log-workspace-contexts" aria-label="Selected log contexts">
        <span className="summary-label">Contexts</span>
        <div>{contexts.map((context) => <span key={context} title={context}>{context}</span>)}</div>
      </div>
      <div className="log-workspace-stats">
        <span>{selectedPods} pod(s)</span>
        <span>{selectedSources.length} container(s)</span>
        <span>{sidecarCount} sidecar(s)</span>
        <span>{formatRange(appliedRangeResult.range)}</span>
        <span className={`log-workspace-status log-state-${state}`} role="status" aria-live="polite"><span className="status-dot" />{sourceErrors.length > 0 ? `${stateLabel(state)} · partial` : stateLabel(state)}</span>
      </div>
      <div className="log-workspace-actions">
        {onChangeSources && <button type="button" className="secondary-button" onClick={onChangeSources}>Change sources</button>}
        {onClose && <button type="button" className="icon-button subtle" onClick={onClose} aria-label="Close logs workspace" title="Close logs workspace"><X size={15} /></button>}
      </div>
    </header>
    <div className="log-toolbar">
      <div className="log-toolbar-range">
        <label className="log-control"><span>Period</span><select value={draft.period} onChange={(event) => updateDraft((current) => ({ ...current, period: event.target.value as typeof draft.period }))} aria-label="Log period">{LOG_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        {draft.period === 'custom' && <div className="log-range-fields" aria-label="Custom UTC range"><label className="log-control"><span>From inclusive</span><input type="datetime-local" value={draft.customFrom} onChange={(event) => updateDraft((current) => ({ ...current, customFrom: event.target.value }))} aria-label="Log range start UTC" /></label><label className="log-control"><span>To exclusive</span><input type="datetime-local" value={draft.customTo} onChange={(event) => updateDraft((current) => ({ ...current, customTo: event.target.value }))} aria-label="Log range end UTC" /></label></div>}
        <label className="log-follow"><input type="checkbox" checked={draft.follow} onChange={(event) => updateDraft((current) => ({ ...current, follow: event.target.checked }))} /> Follow</label>
      </div>
      <div className="log-structured-filters" aria-label="Structured log filters">
        <FilterSelect label="Pod" value={draft.filters.pod} values={filterValues.pods} onChange={(value) => updateFilter('pod', value)} />
        <FilterSelect label="Container" value={draft.filters.container} values={filterValues.containers} onChange={(value) => updateFilter('container', value)} />
        <FilterSelect label="Cluster" value={draft.filters.cluster} values={filterValues.clusters} onChange={(value) => updateFilter('cluster', value)} />
        <FilterSelect label="Namespace" value={draft.filters.namespace} values={filterValues.namespaces} onChange={(value) => updateFilter('namespace', value)} />
        <label className="log-filter"><Search size={13} aria-hidden="true" /><span className="visually-hidden">Filter log message text</span><input value={draft.filters.text} onChange={(event) => updateFilter('text', event.target.value)} placeholder="Message text" aria-label="Filter log message text" />{draft.filters.text && <button type="button" className="filter-clear" onClick={() => updateFilter('text', '')} aria-label="Clear message text filter"><X size={11} aria-hidden="true" /></button>}</label>
        {draftFilterCount > 0 && <button type="button" className="text-button" onClick={clearFilters}>Clear filters ({draftFilterCount})</button>}
      </div>
      <div className="log-toolbar-actions">
        <div className="log-search-cluster">
          <label className="log-control log-grouping"><span>Group</span><select value={display.grouping} onChange={(event) => setDisplay((current) => ({ ...current, grouping: event.target.value as LogGrouping }))} aria-label="Log grouping"><option value="application">Application</option><option value="source">Source</option></select></label>
          <button type="button" className="primary-button log-search-button" onClick={confirmSearch} disabled={!hasPendingSearch || isSearchApplying} aria-busy={isSearchApplying}><Search size={14} aria-hidden="true" /> Search</button>
        </div>
        <span className="log-search-status" role="status" aria-live="polite">{isSearchApplying ? 'Applying search...' : hasPendingSearch ? `Search changes pending · ${activeFilterCount} applied filter(s)` : `Search applied · ${activeFilterCount} filter(s)`}</span>
        <label className="log-follow"><input type="checkbox" checked={display.wrapLines} onChange={(event) => setDisplay((current) => setWrapLines(current, event.target.checked))} /> Wrap lines</label>
        <span className={`log-state log-state-${state}`} role="status" aria-live="polite"><span className="status-dot" />{stateLabel(state)}</span>
        <div className="log-actions"><button type="button" className="icon-button subtle" onClick={() => setPaused((value) => !value)} title={paused ? 'Resume' : 'Pause'} aria-label={paused ? 'Resume log stream' : 'Pause log stream'}>{paused ? <Play size={14} /> : <Pause size={14} />}</button><button type="button" className="icon-button subtle" onClick={() => setEvents([])} title="Clear" aria-label="Clear retained log events"><Trash2 size={14} /></button></div>
      </div>
    </div>
    <div className="log-range-summary" role="status"><span>{formatRange(appliedRangeResult.range)}</span><span>{selectedSources.length} source(s) selected</span><span>Effective limit: {formatBytes(acceptedLimits.maxBytesTotal)} / {acceptedLimits.maxLinesTotal.toLocaleString()} lines</span></div>
    <details className="log-source-inspection">
      <summary>Inspect selected sources ({selectedSources.length}){sourceErrors.length > 0 ? ` · ${sourceErrors.length} failed` : ''}</summary>
      <div className="log-source-inspection-list">{selectedSources.map((source) => { const sourceState = sourceStates.get(source.sourceId); return <span key={source.sourceId} title={sourceLabel(source)}>{sourceLabel(source)}{sourceState ? ` · ${sourceState.status}${sourceState.endReason ? `:${sourceState.endReason}` : ''}` : ''}</span>; })}</div>
    </details>
    {error && <ErrorState message={error} />}
    {validationError && <div className="log-validation-error" role="alert"><strong>Search was not applied.</strong> {validationError}</div>}
    {sourceErrors.length > 0 && <div className="log-partial-summary" role="status" aria-live="polite"><strong>{sourceErrors.length} source(s) failed</strong>{sourceErrors.map((item) => <span key={item.source.sourceId}>{sourceLabel(item.source)}: {item.error}</span>)}</div>}
    <div className="log-output" ref={outputRef} onScroll={onScroll} tabIndex={0} role="log" aria-label="Structured log output" aria-live="polite"><div className={`log-output-inner ${display.wrapLines ? 'is-wrapped' : 'is-nowrap'}`} style={{ height: virtualizer.getTotalSize() }}>{visibleEvents.length === 0 ? <p className="log-empty">{state === 'connecting' ? 'Connecting to selected sources...' : events.length > 0 && activeFilterCount > 0 ? 'No event matches the selected filters.' : 'No log events received yet.'}</p> : virtualizer.getVirtualItems().map((item) => { const record = visibleEvents[item.index]; return record ? <LogRow key={item.key} record={record} grouping={display.grouping} query={applied.filters.text} start={item.start} wrapLines={display.wrapLines} measureElement={virtualizer.measureElement} index={item.index} /> : null; })}</div></div>
    <div className="log-footer"><span aria-live="polite">{activeFilterCount > 0 ? `${visibleEvents.length} of ${events.length}` : `${events.length}`} retained / {totalLines.toLocaleString()} emitted{totalDropped > 0 ? ` / ${totalDropped} dropped` : ''}{events.length >= CLIENT_LOG_BUFFER ? ' · client buffer full' : ''}{receivedWhilePaused > 0 ? ` · ${receivedWhilePaused} received while paused` : ''}</span>{summaryReason && <span>ended: {summaryReason}</span>}{!autoScroll && <button type="button" className="text-button" onClick={jumpToLatest}>Jump to latest</button>}</div>
  </div>;
}

function FilterSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="log-control log-filter-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} aria-label={`Filter by ${label.toLowerCase()}`}><option value="">All {label.toLowerCase()}s</option>{values.map((option) => <option value={option} key={option}>{option}</option>)}</select>{value && <button type="button" className="filter-clear" onClick={() => onChange('')} aria-label={`Clear ${label.toLowerCase()} filter`}><X size={11} aria-hidden="true" /></button>}</label>;
}

function stateLabel(state: ConnectionState): string { if (state === 'validating') return 'validating'; if (state === 'connecting') return 'connecting'; if (state === 'streaming') return 'live'; if (state === 'paused') return 'paused'; if (state === 'partial') return 'partial'; if (state === 'error') return 'error'; return 'ended'; }
function formatRange(range?: { from?: string; to?: string }): string { if (!range || (!range.from && !range.to)) return 'Range: all available'; return `Range: ${range.from ?? 'all available'} to ${range.to ?? 'now'} (UTC, end exclusive)`; }
function formatBytes(bytes: number): string { if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MiB`; if (bytes >= 1024) return `${Math.round(bytes / 1024)} KiB`; return `${bytes} B`; }

function LogRow({ record, grouping, query, start, wrapLines, measureElement, index }: { record: LogEventRecord; grouping: LogGrouping; query: string; start: number; wrapLines: boolean; measureElement: (element: HTMLElement) => void; index: number }) {
  const group = grouping === 'application' ? record.source.application?.name ?? record.source.pod : record.source.container;
  const message = record.event.message || '(empty message)';
  return <div ref={(element) => { if (element) measureElement(element); }} data-index={index} className={`log-line structured-log-line ${wrapLines ? 'is-wrapped' : 'is-nowrap'}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${start}px)` }}>
    <time className="log-timestamp" dateTime={record.event.timestamp ?? undefined}>{record.event.timestamp ?? 'no timestamp'}</time>
    <span className="log-context-cell" title={`${record.source.cluster} / ${record.source.namespace}`}>{record.source.cluster} / {record.source.namespace}</span>
    <span className="log-source-cell" title={`${record.source.pod} / ${record.source.container}`}><strong>{group}</strong><small>{record.source.pod} / {record.source.container}</small></span>
    <span className="log-message" aria-label={message}>{highlightSegments(message, query).map((segment, index) => segment.match ? <mark className="log-mark" key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>)}</span>
  </div>;
}

function highlightSegments(value: string, query: string): Array<{ text: string; match: boolean }> { const needle = query.trim(); if (!needle) return [{ text: value, match: false }]; const lower = value.toLowerCase(); const lowerNeedle = needle.toLowerCase(); const segments: Array<{ text: string; match: boolean }> = []; let cursor = 0; let index = lower.indexOf(lowerNeedle); while (index >= 0) { if (index > cursor) segments.push({ text: value.slice(cursor, index), match: false }); segments.push({ text: value.slice(index, index + needle.length), match: true }); cursor = index + needle.length; index = lower.indexOf(lowerNeedle, cursor); } if (cursor < value.length) segments.push({ text: value.slice(cursor), match: false }); return segments.length > 0 ? segments : [{ text: value, match: false }]; }
