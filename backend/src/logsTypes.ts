import type { ApplicationIdentity } from './kube/types.js';

export interface LogSource {
  sourceId: string;
  cluster: string;
  namespace: string;
  pod: string;
  container: string;
  application?: ApplicationIdentity;
}

export interface LogLimits {
  maxLinesPerSource: number;
  maxBytesPerSource: number;
  maxLinesTotal: number;
  maxBytesTotal: number;
}

export interface LogRange {
  from?: string;
  to?: string;
}

export interface SubscribeMessage extends LogRange {
  type: 'subscribe';
  period?: string;
  follow?: boolean;
  sources: LogSource[];
  limits?: Partial<LogLimits>;
}

export interface EffectiveLogSubscription extends LogRange {
  follow: boolean;
  limits: LogLimits;
  sources: LogSource[];
}

export type HistorySourceStatus = 'queued' | 'reading' | 'indexing' | 'ready' | 'partial' | 'failed' | 'cancelled';
export type HistoryTerminalStatus = 'complete' | 'partial' | 'failed' | 'cancelled' | 'expired';

export interface HistoryCursor {
  sourceKey: string;
  line: number;
}

export interface HistorySourceProgress {
  source: LogSource;
  sourceKey: string;
  status: HistorySourceStatus;
  counters: LogCounters;
  limitReason?: string;
  error?: string;
  continuity: 'single-read' | 'unknown';
}

export interface HistoryAggregateProgress {
  capturedLines: number;
  capturedBytes: number;
  completedSources: number;
  activeSources: number;
  queuedSources: number;
  sourceCount: number;
  determinate: false;
  limits: {
    maxLinesTotal: number;
    maxBytesTotal: number;
    maxDiskBytesTotal: number;
    usedDiskBytes: number;
  };
}

export interface HistoryRecord {
  sourceKey: string;
  source: LogSource;
  sequence: number;
  timestamp: string | null;
  message: string;
  bytes: number;
  application?: ApplicationIdentity;
}

export interface HistoryQueryFilters {
  pod: string;
  container: string;
  cluster: string;
  namespace: string;
  text: string;
}

export interface LogCounters {
  emittedLines: number;
  emittedBytes: number;
  droppedLines: number;
}

export interface LogLineEvent {
  type: 'line';
  sourceId: string;
  sequence: number;
  timestamp: string | null;
  message: string;
  bytes: number;
  application?: ApplicationIdentity;
}

export type SourceEndReason = 'eof' | 'to-reached' | 'limit' | 'cancelled';
export type SummaryReason = 'completed' | 'aggregate-limit' | 'cancelled' | 'all-failed';

export type AggregateLogEvent =
  | { type: 'accepted'; from: string | null; to: string | null; follow: boolean; limits: LogLimits; sourceCount: number }
  | { type: 'sourceStarted'; source: LogSource; counters: LogCounters }
  | LogLineEvent
  | { type: 'sourceWarning'; sourceId: string; warning: 'dropped-unparseable'; count: number }
  | { type: 'sourceError'; source: LogSource; message: string; counters: LogCounters; status: 'error' }
  | { type: 'sourceEnded'; source: LogSource; counters: LogCounters; reason: SourceEndReason }
  | { type: 'summary'; sources: Array<{ source: LogSource; counters: LogCounters; status: 'ended' | 'error' }>; limits: LogLimits; reason: SummaryReason }
  | { type: 'history.accepted'; requestId: string; sessionId: string; snapshotId: string; generation: number; sourceCount: number }
  | { type: 'history.progress'; sessionId: string; snapshotId: string; generation: number; aggregate: HistoryAggregateProgress; sources: HistorySourceProgress[] }
  | { type: 'history.window'; sessionId: string; snapshotId: string; generation: number; sourceKey: string; source: LogSource; startLine: number; endLine: number; records: HistoryRecord[]; hasMoreBefore: boolean; hasMoreAfter: boolean }
  | { type: 'history.terminal'; sessionId: string; snapshotId: string; generation: number; status: HistoryTerminalStatus; aggregate: HistoryAggregateProgress; sources: HistorySourceProgress[]; limitReasons: string[] }
  | { type: 'history.query.ready'; sessionId: string; snapshotId: string; generation: number; queryId: string; totalMatches: number }
  | { type: 'history.query.window'; sessionId: string; snapshotId: string; generation: number; queryId: string; startIndex: number; endIndex: number; records: HistoryRecord[]; hasMoreBefore: boolean; hasMoreAfter: boolean }
  | { type: 'error'; message: string };

export type LegacyLogEvent =
  | { type: 'line'; line: string }
  | { type: 'error'; message: string }
  | { type: 'end' }
  | { type: 'started'; container: string };