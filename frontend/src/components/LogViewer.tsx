import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pause, Play, Search, Trash2, X } from 'lucide-react';
import { aggregateLogsUrl, serializeLogSubscription } from '../api';
import { LOG_PERIODS, resolveLogRange } from '../logsRange';
import { appendBoundedEvent, CLIENT_LOG_BUFFER, filterLogRecords, logFilterValues, sourceLabel, sourceStateForEvent, sourcesForPods, type LogRecordFilters } from '../logsSession';
import { ErrorState } from './Feedback';
import type { AggregateLogEvent, LogEventRecord, LogLimits, LogSource, LogSourceState, NormalizedPod, PodRef, SummaryReason } from '../types';

const DEFAULT_LIMITS: LogLimits = { maxLinesPerSource: 2_000, maxBytesPerSource: 2 * 1024 * 1024, maxLinesTotal: 10_000, maxBytesTotal: 10 * 1024 * 1024 };
type ConnectionState = 'validating' | 'connecting' | 'streaming' | 'paused' | 'ended' | 'partial' | 'error';
type LogGrouping = 'application' | 'source';

export function LogViewer({ pod, pods = [pod], sources }: { pod: PodRef; pods?: PodRef[]; sources?: LogSource[] }) {
  const availableSources = useMemo(() => sources ?? sourcesForPods(pods.map((item): NormalizedPod => ({ cluster: item.cluster, namespace: item.namespace, name: item.name, status: '', ready: '', restarts: 0, node: '', ageSeconds: 0, containers: item.containers, application: item.application ?? { key: `pod:${item.name}`, name: item.name, source: 'pod' } }))), [pods, sources]);
  const [period, setPeriod] = useState<'all' | '5m' | '15m' | '1h' | '6h' | '24h' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [follow, setFollow] = useState(true);
  const [filters, setFilters] = useState<LogRecordFilters>({ pod: '', container: '', cluster: '', namespace: '', text: '' });
  const [grouping, setGrouping] = useState<LogGrouping>('application');
  const [events, setEvents] = useState<LogEventRecord[]>([]);
  const [sourceStates, setSourceStates] = useState<Map<string, LogSourceState>>(new Map());
  const [state, setState] = useState<ConnectionState>('validating');
  const [error, setError] = useState<string>();
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
  const filterValues = useMemo(() => logFilterValues(selectedSources, events), [selectedSources, events]);
  const customRange = useMemo(() => ({ from: customFrom, to: customTo }), [customFrom, customTo]);
  const rangeResult = useMemo(() => resolveLogRange(period, new Date(), customRange), [period, customRange]);
  const visibleEvents = useMemo(() => filterLogRecords(events, filters), [events, filters]);
  const virtualizer = useVirtualizer({ count: visibleEvents.length, getScrollElement: () => outputRef.current, estimateSize: () => 34, getItemKey: (index) => visibleEvents[index] ? `${visibleEvents[index].event.sourceId}:${visibleEvents[index].event.sequence}` : index, overscan: 10 });

  useEffect(() => {
    setEvents([]); setSourceStates(new Map()); setSummaryReason(undefined); summaryRef.current = undefined; setError(rangeResult.error); setReceivedWhilePaused(0); setAutoScroll(true); setAcceptedLimits(DEFAULT_LIMITS);
    if (rangeResult.error) { setState('error'); return; }
    if (selectedSources.length === 0) { setState('error'); setError('No confirmed log sources are available.'); return; }
    let active = true;
    const socket = new WebSocket(aggregateLogsUrl());
    setState('connecting');
    socket.onopen = () => { if (active && rangeResult.range) socket.send(serializeLogSubscription({ type: 'subscribe', period, follow, ...rangeResult.range, sources: selectedSources, limits: DEFAULT_LIMITS })); };
    socket.onmessage = (message: MessageEvent<string>) => {
      if (!active) return;
      let event: AggregateLogEvent;
      try { event = JSON.parse(message.data) as AggregateLogEvent; } catch { setError('The log stream returned an invalid event.'); setState('error'); return; }
      if (event.type === 'accepted') { setAcceptedLimits(event.limits); setState(pausedRef.current ? 'paused' : 'streaming'); return; }
      if (event.type === 'sourceStarted' || event.type === 'sourceEnded' || event.type === 'sourceError' || event.type === 'sourceWarning') {
        setSourceStates((current) => { const next = sourceStateForEvent(current, event); sourceStatesRef.current = next; return next; });
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
      if (event.type === 'summary') { summaryRef.current = event.reason; setSummaryReason(event.reason); setAcceptedLimits(event.limits); setState((current) => current === 'partial' ? 'partial' : 'ended'); return; }
      if (event.type === 'error') { setError(event.message); setState('error'); }
    };
    socket.onerror = () => { if (active) { setError('Could not connect to the aggregate log stream.'); setState('error'); } };
    socket.onclose = () => { if (active) setState((current) => current === 'error' || current === 'partial' || summaryRef.current ? current : 'ended'); };
    return () => { active = false; socket.close(); };
  }, [follow, period, rangeResult, selectedSources]);

  useEffect(() => { if (autoScroll && !paused && visibleEvents.length > 0) virtualizer.scrollToIndex(visibleEvents.length - 1, { align: 'end' }); }, [autoScroll, paused, visibleEvents.length, virtualizer]);
  const sourceErrors = [...sourceStates.values()].filter((item) => item.status === 'error');
  const totalDropped = [...sourceStates.values()].reduce((sum, item) => sum + item.counters.droppedLines, 0);
  const totalLines = [...sourceStates.values()].reduce((sum, item) => sum + item.counters.emittedLines, 0);
  const updateFilter = (field: keyof LogRecordFilters, value: string) => setFilters((current) => ({ ...current, [field]: value }));
  const clearFilters = () => setFilters({ pod: '', container: '', cluster: '', namespace: '', text: '' });
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const onScroll = () => { const element = outputRef.current; if (element) setAutoScroll(element.scrollHeight - element.scrollTop - element.clientHeight < 40); };
  const jumpToLatest = () => { setAutoScroll(true); if (visibleEvents.length > 0) virtualizer.scrollToIndex(visibleEvents.length - 1, { align: 'end' }); };

  return <div className="log-viewer">
    <div className="log-toolbar">
      <label className="log-control"><span>Period</span><select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} aria-label="Log period">{LOG_PERIODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      {period === 'custom' && <div className="log-range-fields" aria-label="Custom UTC range"><label className="log-control"><span>From inclusive</span><input type="datetime-local" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} aria-label="Log range start UTC" /></label><label className="log-control"><span>To exclusive</span><input type="datetime-local" value={customTo} onChange={(event) => setCustomTo(event.target.value)} aria-label="Log range end UTC" /></label></div>}
      <label className="log-follow"><input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} /> Follow</label>
      <span className={`log-state log-state-${state}`} role="status" aria-live="polite"><span className="status-dot" />{stateLabel(state)}</span>
      <div className="log-structured-filters" aria-label="Structured log filters">
        <FilterSelect label="Pod" value={filters.pod} values={filterValues.pods} onChange={(value) => updateFilter('pod', value)} />
        <FilterSelect label="Container" value={filters.container} values={filterValues.containers} onChange={(value) => updateFilter('container', value)} />
        <FilterSelect label="Cluster" value={filters.cluster} values={filterValues.clusters} onChange={(value) => updateFilter('cluster', value)} />
        <FilterSelect label="Namespace" value={filters.namespace} values={filterValues.namespaces} onChange={(value) => updateFilter('namespace', value)} />
        <label className="log-filter"><Search size={13} aria-hidden="true" /><span className="visually-hidden">Filter log message text</span><input value={filters.text} onChange={(event) => updateFilter('text', event.target.value)} placeholder="Message text" aria-label="Filter log message text" />{filters.text && <button type="button" className="filter-clear" onClick={() => updateFilter('text', '')} aria-label="Clear message text filter"><X size={11} /></button>}</label>
        {activeFilterCount > 0 && <button type="button" className="text-button" onClick={clearFilters}>Clear filters ({activeFilterCount})</button>}
      </div>
      <label className="log-control log-grouping"><span>Group</span><select value={grouping} onChange={(event) => setGrouping(event.target.value as LogGrouping)} aria-label="Log grouping"><option value="application">Application</option><option value="source">Source</option></select></label>
      <div className="log-actions"><button type="button" className="icon-button subtle" onClick={() => setPaused((value) => !value)} title={paused ? 'Resume' : 'Pause'} aria-label={paused ? 'Resume log stream' : 'Pause log stream'}>{paused ? <Play size={14} /> : <Pause size={14} />}</button><button type="button" className="icon-button subtle" onClick={() => setEvents([])} title="Clear" aria-label="Clear retained log events"><Trash2 size={14} /></button></div>
    </div>
    <div className="log-range-summary" role="status"><span>{formatRange(rangeResult.range)}</span><span>{selectedSources.length} source(s) selected</span><span>Effective limit: {formatBytes(acceptedLimits.maxBytesTotal)} / {acceptedLimits.maxLinesTotal.toLocaleString()} lines</span></div>
    <div className="log-sources" aria-label="Confirmed log sources"><span className="log-sources-heading">Confirmed sources</span>{availableSources.map((source) => { const sourceState = sourceStates.get(source.sourceId); return <span key={source.sourceId} className="log-source-option" title={sourceLabel(source)}>{grouping === 'application' ? source.application?.name ?? source.pod : source.pod} <small>{source.container} · {source.cluster}/{source.namespace}{sourceState ? ` · ${sourceState.status}${sourceState.endReason ? `:${sourceState.endReason}` : ''}` : ''}</small></span>; })}</div>
    {error && <ErrorState message={error} />}
    {sourceErrors.length > 0 && <div className="log-partial-summary" role="status" aria-live="polite"><strong>{sourceErrors.length} source(s) failed</strong>{sourceErrors.map((item) => <span key={item.source.sourceId}>{sourceLabel(item.source)}: {item.error}</span>)}</div>}
    <div className="log-output" ref={outputRef} onScroll={onScroll} tabIndex={0} role="log" aria-label="Structured log output" aria-live="polite">{visibleEvents.length === 0 ? <p className="log-empty">{state === 'connecting' ? 'Connecting to selected sources...' : events.length > 0 && activeFilterCount > 0 ? 'No event matches the selected filters.' : 'No log events received yet.'}</p> : <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>{virtualizer.getVirtualItems().map((item) => { const record = visibleEvents[item.index]; return record ? <LogRow key={item.key} record={record} grouping={grouping} query={filters.text} start={item.start} /> : null; })}</div>}</div>
    <div className="log-footer"><span aria-live="polite">{activeFilterCount > 0 ? `${visibleEvents.length} of ${events.length}` : `${events.length}`} retained / {totalLines.toLocaleString()} emitted{totalDropped > 0 ? ` / ${totalDropped} dropped` : ''}{events.length >= CLIENT_LOG_BUFFER ? ' · client buffer full' : ''}{receivedWhilePaused > 0 ? ` · ${receivedWhilePaused} received while paused` : ''}</span>{summaryReason && <span>ended: {summaryReason}</span>}{!autoScroll && <button type="button" className="text-button" onClick={jumpToLatest}>Jump to latest</button>}</div>
  </div>;
}

function FilterSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="log-control log-filter-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} aria-label={`Filter by ${label.toLowerCase()}`}><option value="">All {label.toLowerCase()}s</option>{values.map((option) => <option value={option} key={option}>{option}</option>)}</select>{value && <button type="button" className="filter-clear" onClick={() => onChange('')} aria-label={`Clear ${label.toLowerCase()} filter`}><X size={11} /></button>}</label>;
}
function stateLabel(state: ConnectionState): string { if (state === 'validating') return 'validating'; if (state === 'connecting') return 'connecting'; if (state === 'streaming') return 'live'; if (state === 'paused') return 'paused'; if (state === 'partial') return 'partial'; if (state === 'error') return 'error'; return 'ended'; }
function formatRange(range?: { from?: string; to?: string }): string { if (!range || (!range.from && !range.to)) return 'Range: all available'; return `Range: ${range.from ?? 'all available'} to ${range.to ?? 'now'} (UTC, end exclusive)`; }
function formatBytes(bytes: number): string { if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MiB`; if (bytes >= 1024) return `${Math.round(bytes / 1024)} KiB`; return `${bytes} B`; }
function LogRow({ record, grouping, query, start }: { record: LogEventRecord; grouping: LogGrouping; query: string; start: number }) { const group = grouping === 'application' ? record.source.application?.name ?? record.source.pod : record.source.container; return <div className="log-line structured-log-line" style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${start}px)` }}><span className="log-event-meta" title={sourceLabel(record.source)}><strong>{group}</strong><span>{record.source.cluster}/{record.source.namespace}/{record.source.pod}/{record.source.container}</span><time dateTime={record.event.timestamp ?? undefined}>{record.event.timestamp ?? 'no timestamp'}</time></span><span>{highlightSegments(record.event.message, query).map((segment, index) => segment.match ? <mark className="log-mark" key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>)}</span></div>; }
function highlightSegments(value: string, query: string): Array<{ text: string; match: boolean }> { const needle = query.trim(); if (!needle) return [{ text: value, match: false }]; const lower = value.toLowerCase(); const lowerNeedle = needle.toLowerCase(); const segments: Array<{ text: string; match: boolean }> = []; let cursor = 0; let index = lower.indexOf(lowerNeedle); while (index >= 0) { if (index > cursor) segments.push({ text: value.slice(cursor, index), match: false }); segments.push({ text: value.slice(index, index + needle.length), match: true }); cursor = index + needle.length; index = lower.indexOf(lowerNeedle, cursor); } if (cursor < value.length) segments.push({ text: value.slice(cursor), match: false }); return segments.length > 0 ? segments : [{ text: value, match: false }]; }
