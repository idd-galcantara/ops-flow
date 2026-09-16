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
  | { type: 'error'; message: string };

export type LegacyLogEvent =
  | { type: 'line'; line: string }
  | { type: 'error'; message: string }
  | { type: 'end' }
  | { type: 'started'; container: string };