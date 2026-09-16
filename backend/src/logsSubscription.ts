import { MAX_TAIL_LINES, streamStructuredPodLogs, type LogStreamHandle, type StructuredLogCallbacks, type StructuredLogLine, type StructuredLogOptions } from './kube/logsService.js';
import { safeErrorMessage } from './kube/podsService.js';
import type { EffectiveLogSubscription, AggregateLogEvent, LogCounters, LogSource, SummaryReason } from './logsTypes.js';

export type SubscriptionStreamFactory = (
  options: StructuredLogOptions,
  callbacks: StructuredLogCallbacks,
) => LogStreamHandle;

export type SubscriptionEmitter = (event: AggregateLogEvent) => void;

interface SourceState {
  source: LogSource;
  counters: LogCounters;
  sequence: number;
  status: 'active' | 'ended' | 'error';
  handle?: LogStreamHandle;
}

function counters(): LogCounters {
  return { emittedLines: 0, emittedBytes: 0, droppedLines: 0 };
}

function copyCounters(value: LogCounters): LogCounters {
  return { ...value };
}

export interface RunningLogSubscription {
  cancel: () => void;
  completion: Promise<void>;
}

/** Fans out read-only source streams while keeping protocol accounting centralized. */
export function startLogSubscription(
  subscription: EffectiveLogSubscription,
  emit: SubscriptionEmitter,
  streamFactory: SubscriptionStreamFactory = streamStructuredPodLogs,
): RunningLogSubscription {
  const states: SourceState[] = subscription.sources.map((source) => ({
    source,
    counters: counters(),
    sequence: 0,
    status: 'active',
  }));
  let cancelled = false;
  let summarySent = false;
  let aggregateStopping = false;
  let resolveCompletion!: () => void;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });

  const totals = () => states.reduce(
    (total, state) => ({
      lines: total.lines + state.counters.emittedLines,
      bytes: total.bytes + state.counters.emittedBytes,
    }),
    { lines: 0, bytes: 0 },
  );

  const sendSummary = (reason: SummaryReason) => {
    if (summarySent || cancelled) return;
    summarySent = true;
    emit({
      type: 'summary',
      sources: states.map((state) => ({ source: state.source, counters: copyCounters(state.counters), status: state.status === 'error' ? 'error' : 'ended' })),
      limits: subscription.limits,
      reason,
    });
    resolveCompletion();
  };

  const maybeComplete = () => {
    if (cancelled || summarySent || states.some((state) => state.status === 'active')) return;
    const totalLines = totals().lines;
    const allFailed = states.every((state) => state.status === 'error') && totalLines === 0;
    sendSummary(allFailed ? 'all-failed' : 'completed');
  };

  const endSource = (state: SourceState, reason: 'eof' | 'to-reached' | 'limit' | 'cancelled') => {
    if (state.status !== 'active') return;
    state.status = 'ended';
    emit({ type: 'sourceEnded', source: state.source, counters: copyCounters(state.counters), reason });
    maybeComplete();
  };

  const stopForAggregate = (trigger: SourceState) => {
    if (aggregateStopping) return;
    aggregateStopping = true;
    for (const state of states) {
      if (state.status !== 'active') continue;
      state.status = 'ended';
      emit({
        type: 'sourceEnded',
        source: state.source,
        counters: copyCounters(state.counters),
        reason: state === trigger ? 'limit' : 'cancelled',
      });
      state.handle?.stop();
    }
    sendSummary('aggregate-limit');
  };

  const onLine = (state: SourceState, line: StructuredLogLine): boolean => {
    if (cancelled || state.status !== 'active') return false;
    const total = totals();
    const sourceLimit = state.counters.emittedLines + 1 > subscription.limits.maxLinesPerSource
      || state.counters.emittedBytes + line.bytes > subscription.limits.maxBytesPerSource;
    const aggregateLimit = total.lines + 1 > subscription.limits.maxLinesTotal
      || total.bytes + line.bytes > subscription.limits.maxBytesTotal;
    if (sourceLimit) {
      endSource(state, 'limit');
      return false;
    }
    if (aggregateLimit) {
      stopForAggregate(state);
      return false;
    }

    state.sequence += 1;
    state.counters.emittedLines += 1;
    state.counters.emittedBytes += line.bytes;
    emit({
      type: 'line',
      sourceId: state.source.sourceId,
      sequence: state.sequence,
      timestamp: line.timestamp,
      message: line.message,
      bytes: line.bytes,
      ...(state.source.application ? { application: state.source.application } : {}),
    });
    return true;
  };

  const startSource = (state: SourceState) => {
    if (cancelled || aggregateStopping) return;
    const callbacks: StructuredLogCallbacks = {
      onLine: (line) => onLine(state, line),
      onWarning: (count) => {
        if (state.status !== 'active') return;
        state.counters.droppedLines += count;
        emit({ type: 'sourceWarning', sourceId: state.source.sourceId, warning: 'dropped-unparseable', count: state.counters.droppedLines });
      },
      onError: (message) => {
        if (state.status !== 'active' || cancelled) return;
        state.status = 'error';
        emit({ type: 'sourceError', source: state.source, message, counters: copyCounters(state.counters), status: 'error' });
        maybeComplete();
      },
      onEnd: (reason) => endSource(state, reason),
    };
    try {
      state.handle = streamFactory(
        {
          cluster: state.source.cluster,
          namespace: state.source.namespace,
          pod: state.source.pod,
          container: state.source.container,
          follow: subscription.follow,
          tailLines: Math.min(MAX_TAIL_LINES, subscription.limits.maxLinesPerSource),
          maxBytes: subscription.limits.maxBytesPerSource,
          from: subscription.from,
          to: subscription.to,
        },
        callbacks,
      );
      if (cancelled || state.status !== 'active') state.handle.stop();
    } catch (error) {
      callbacks.onError(safeErrorMessage(error));
    }
  };

  for (const state of states) {
    emit({ type: 'sourceStarted', source: state.source, counters: copyCounters(state.counters) });
  }
  for (const state of states) startSource(state);
  maybeComplete();

  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      for (const state of states) {
        if (state.status === 'active') state.status = 'ended';
        state.handle?.stop();
      }
      resolveCompletion();
    },
    completion,
  };
}