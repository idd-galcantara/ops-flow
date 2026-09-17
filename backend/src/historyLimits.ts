/**
 * Finite, process-local history envelope. These limits are deliberately
 * separate from live log retention: a history snapshot is backend storage,
 * while live retention is a browser concern.
 */
export interface HistoryLimits {
  maxLinesPerSource: number;
  maxBytesPerSource: number;
  maxLinesTotal: number;
  maxBytesTotal: number;
  maxDiskBytesPerSource: number;
  maxDiskBytesTotal: number;
  maxRecordBytes: number;
  maxIndexEntryBytes: number;
  maxWindowRecords: number;
  maxWindowBytes: number;
  maxInFlightDecodedBytesPerSource: number;
  maxInFlightDecodedBytesPerSession: number;
  maxFrameBytes: number;
  maxConcurrentSessions: number;
  maxConcurrentSourceReads: number;
  ttlMs: number;
  orphanGraceMs: number;
  maxWindowRequestsPerMinute: number;
  maxRetainedSessions: number;
}

export const DEFAULT_HISTORY_LIMITS: HistoryLimits = {
  maxLinesPerSource: 100_000,
  maxBytesPerSource: 32 * 1024 * 1024,
  maxLinesTotal: 1_000_000,
  maxBytesTotal: 256 * 1024 * 1024,
  maxDiskBytesPerSource: 48 * 1024 * 1024,
  maxDiskBytesTotal: 384 * 1024 * 1024,
  maxRecordBytes: 256 * 1024,
  maxIndexEntryBytes: 1024,
  maxWindowRecords: 2_000,
  maxWindowBytes: 256 * 1024,
  maxInFlightDecodedBytesPerSource: 4 * 1024 * 1024,
  maxInFlightDecodedBytesPerSession: 32 * 1024 * 1024,
  maxFrameBytes: 512 * 1024,
  maxConcurrentSessions: 2,
  maxConcurrentSourceReads: 8,
  ttlMs: 15 * 60 * 1000,
  orphanGraceMs: 60 * 60 * 1000,
  maxWindowRequestsPerMinute: 120,
  maxRetainedSessions: 8,
};

export function historyLimits(overrides: Partial<HistoryLimits> = {}): HistoryLimits {
  const merged = { ...DEFAULT_HISTORY_LIMITS, ...overrides };
  for (const value of Object.values(merged)) {
    if (!Number.isInteger(value) || value <= 0) throw new Error('History limits must be finite positive integers.');
  }
  return merged;
}