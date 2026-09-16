import type {
  AggregateLogEvent,
  LogEventRecord,
  LogSource,
  LogSourceState,
  NormalizedPod,
} from './types';

export interface LogRecordFilters {
  pod: string;
  container: string;
  cluster: string;
  namespace: string;
  text: string;
}

export interface LogFilterValues {
  pods: string[];
  containers: string[];
  clusters: string[];
  namespaces: string[];
}

export const CLIENT_LOG_BUFFER = 5_000;

export function sourceTupleKey(source: Pick<LogSource, 'cluster' | 'namespace' | 'pod' | 'container'>): string {
  return [source.cluster, source.namespace, source.pod, source.container].join('\u0000');
}

export function sourceIdFor(source: Pick<LogSource, 'cluster' | 'namespace' | 'pod' | 'container'>): string {
  return [source.cluster, source.namespace, source.pod, source.container]
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function sourcesForPods(pods: NormalizedPod[]): LogSource[] {
  const sources: LogSource[] = [];
  const seen = new Set<string>();
  for (const pod of pods) {
    for (const container of pod.containers) {
      const source = {
        sourceId: sourceIdFor({
          cluster: pod.cluster,
          namespace: pod.namespace,
          pod: pod.name,
          container,
        }),
        cluster: pod.cluster,
        namespace: pod.namespace,
        pod: pod.name,
        container,
        application: pod.application,
      } satisfies LogSource;
      const key = sourceTupleKey(source);
      if (!seen.has(key)) {
        seen.add(key);
        sources.push(source);
      }
    }
  }
  return sources;
}

export function dedupeSources(sources: LogSource[]): LogSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = sourceTupleKey(source);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sourceStateForEvent(
  state: Map<string, LogSourceState>,
  event: Extract<AggregateLogEvent, { type: 'sourceStarted' | 'sourceEnded' | 'sourceError' | 'sourceWarning' }>,
): Map<string, LogSourceState> {
  const next = new Map(state);
  if (event.type === 'sourceStarted') {
    next.set(event.source.sourceId, {
      source: event.source,
      status: 'started',
      counters: event.counters,
    });
  } else if (event.type === 'sourceWarning') {
    const current = next.get(event.sourceId);
    if (current) next.set(event.sourceId, { ...current, warningCount: event.count });
  } else {
    next.set(event.source.sourceId, {
      source: event.source,
      status: event.type === 'sourceError' ? 'error' : 'ended',
      counters: event.counters,
      ...(event.type === 'sourceError' ? { error: event.message } : { endReason: event.reason }),
    });
  }
  return next;
}

export function appendBoundedEvent(
  events: LogEventRecord[],
  record: LogEventRecord,
  limit = CLIENT_LOG_BUFFER,
): LogEventRecord[] {
  const next = [...events, record];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

export function logRecordMatches(record: LogEventRecord, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  if (!needle) return true;
  const { event, source } = record;
  return [
    event.timestamp ?? '',
    event.message,
    event.sourceId,
    source.cluster,
    source.namespace,
    source.pod,
    source.container,
    source.application?.key ?? '',
    source.application?.name ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

export function recordMatchesFilters(record: LogEventRecord, filters: LogRecordFilters): boolean {
  const { source, event } = record;
  const text = filters.text.trim().toLowerCase();
  return (
    (!filters.pod || source.pod === filters.pod) &&
    (!filters.container || source.container === filters.container) &&
    (!filters.cluster || source.cluster === filters.cluster) &&
    (!filters.namespace || source.namespace === filters.namespace) &&
    (!text || event.message.toLowerCase().includes(text))
  );
}

export function filterLogRecords(records: LogEventRecord[], filters: LogRecordFilters): LogEventRecord[] {
  return records.filter((record) => recordMatchesFilters(record, filters));
}

export function logFilterValues(sources: LogSource[], events: LogEventRecord[]): LogFilterValues {
  const allSources = [...sources, ...events.map((record) => record.source)];
  return {
    pods: distinct(allSources.map((source) => source.pod)),
    containers: distinct(allSources.map((source) => source.container)),
    clusters: distinct(allSources.map((source) => source.cluster)),
    namespaces: distinct(allSources.map((source) => source.namespace)),
  };
}

function distinct(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function sourceLabel(source: LogSource): string {
  return `${source.cluster} / ${source.namespace} / ${source.pod} / ${source.container}`;
}
