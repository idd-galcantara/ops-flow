import { chmodSync, closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readSync, rmSync, statSync, writeSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { streamStructuredPodLogs, type LogStreamHandle, type StructuredLogCallbacks, type StructuredLogLine, type StructuredLogOptions } from './kube/logsService.js';
import { safeErrorMessage } from './kube/podsService.js';
import { historyLimits, type HistoryLimits } from './historyLimits.js';
import type { AggregateLogEvent, HistoryAggregateProgress, HistoryCursor, HistoryPolicy, HistoryRecord, HistorySourceProgress, HistoryTerminalStatus, LogCounters, LogSource } from './logsTypes.js';

export type HistoryStreamFactory = (options: StructuredLogOptions, callbacks: StructuredLogCallbacks) => LogStreamHandle;

export interface HistoryStartInput {
  requestId: string;
  generation: number;
  policy: HistoryPolicy;
  from?: string;
  to?: string;
  sources: LogSource[];
}

export interface HistoryWindowResult {
  sourceKey: string;
  source: LogSource;
  startLine: number;
  endLine: number;
  records: HistoryRecord[];
  hasMoreBefore: boolean;
  hasMoreAfter: boolean;
}

export interface HistorySessionManagerOptions {
  rootDir?: string;
  limits?: Partial<HistoryLimits>;
  streamFactory?: HistoryStreamFactory;
  now?: () => number;
}

const HISTORY_ROOT_PREFIX = 'ops-union-history-';
const SESSION_DIR_PREFIX = 'session-';
const CLEANUP_RETRIES = 2;
const HISTORY_PAGE_MEMORY_ERROR = 'History page exceeds the in-flight decoded memory limit.';
const DECODED_RECORD_OVERHEAD_BYTES = 256;

interface IndexEntry {
  lineNumber: number;
  byteOffset: number;
  timestamp: string | null;
}

interface SourceState {
  source: LogSource;
  sourceKey: string;
  status: HistorySourceProgress['status'];
  counters: LogCounters;
  sequence: number;
  continuity: 'single-read' | 'unknown';
  writer?: SourceWriter;
  handle?: LogStreamHandle;
  error?: string;
  limitReason?: string;
  stopReason?: 'limit' | 'cancelled';
}

class HistoryLimitError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

class HistoryStorageError extends Error {}

class SourceWriter {
  readonly dataPath: string;
  readonly indexPath: string;
  lines = 0;
  logBytes = 0;
  diskBytes = 0;
  private dataBytes = 0;
  private dataFd!: number;
  private indexFd!: number;
  private closed = false;

  constructor(private readonly directory: string, private readonly limits: HistoryLimits) {
    this.dataPath = path.join(directory, `source-${randomUUID()}.ndjson`);
    this.indexPath = path.join(directory, `index-${randomUUID()}.ndjson`);
    let dataFd: number | undefined;
    try {
      dataFd = openSync(this.dataPath, 'w', 0o600);
      this.indexFd = openSync(this.indexPath, 'w', 0o600);
      this.dataFd = dataFd;
    } catch (error) {
      if (dataFd !== undefined) closeSync(dataFd);
      try { rmSync(this.dataPath, { force: true }); } catch { /* best effort */ }
      try { rmSync(this.indexPath, { force: true }); } catch { /* best effort */ }
      throw error;
    }
  }

  append(record: HistoryRecord, logBytes: number, totalDiskBytes: number): number {
    if (Buffer.byteLength(record.message, 'utf8') > this.limits.maxRecordBytes) throw new HistoryLimitError('record-size');
    const encoded = Buffer.from(`${JSON.stringify(record)}\n`, 'utf8');
    const entry: IndexEntry = { lineNumber: this.lines, byteOffset: this.dataBytes, timestamp: record.timestamp };
    const indexEncoded = Buffer.from(`${JSON.stringify(entry)}\n`, 'utf8');
    const addedDisk = encoded.byteLength + indexEncoded.byteLength;
    if (this.diskBytes + addedDisk > this.limits.maxDiskBytesPerSource) throw new HistoryLimitError('disk-per-source');
    if (totalDiskBytes + addedDisk > this.limits.maxDiskBytesTotal) throw new HistoryLimitError('disk-total');
    writeAll(this.dataFd, encoded);
    writeAll(this.indexFd, indexEncoded);
    this.lines += 1;
    this.logBytes += logBytes;
    this.diskBytes += addedDisk;
    this.dataBytes += encoded.byteLength;
    return addedDisk;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    closeSync(this.dataFd);
    closeSync(this.indexFd);
  }

}

function writeAll(fd: number, buffer: Buffer): void {
  let offset = 0;
  while (offset < buffer.length) offset += writeSync(fd, buffer, offset, buffer.length - offset);
}

function readFully(fd: number, buffer: Buffer, position: number): void {
  let offset = 0;
  while (offset < buffer.length) {
    const count = readSync(fd, buffer, offset, buffer.length - offset, position + offset);
    if (count === 0) throw new HistoryStorageError('History snapshot storage is unavailable.');
    offset += count;
  }
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function emptyCounters(): LogCounters {
  return { emittedLines: 0, emittedBytes: 0, droppedLines: 0 };
}

function copyCounters(value: LogCounters): LogCounters {
  return { ...value };
}

function decodedPageMemoryBytes(encodedBytes: number, recordCount: number): number {
  return encodedBytes * 3 + recordCount * DECODED_RECORD_OVERHEAD_BYTES;
}

function sourceProgress(state: SourceState): HistorySourceProgress {
  return {
    source: state.source,
    sourceKey: state.sourceKey,
    status: state.status,
    counters: copyCounters(state.counters),
    ...(state.limitReason ? { limitReason: state.limitReason } : {}),
    ...(state.error ? { error: state.error } : {}),
    continuity: state.continuity,
  };
}

export class HistorySession {
  readonly sessionId = randomUUID();
  readonly snapshotId = randomUUID();
  readonly generation: number;
  private readonly directory: string;
  private readonly states: SourceState[];
  private readonly limits: HistoryLimits;
  private readonly streamFactory: HistoryStreamFactory;
  private readonly now: () => number;
  private readonly emit: (event: AggregateLogEvent) => void;
  private readonly inFlightDecodedBytesBySource = new Map<string, number>();
  private inFlightDecodedBytes = 0;
  private activeReads = 0;
  private diskBytes = 0;
  private started = false;
  private finalized = false;
  private cleaned = false;
  private cancelRequested = false;
  private terminalAt?: number;
  private requestTimes: number[] = [];
  private status: HistoryTerminalStatus | 'starting' | 'reading' = 'starting';

  constructor(private readonly input: HistoryStartInput, options: Required<Pick<HistorySessionManagerOptions, 'rootDir' | 'streamFactory' | 'now'>> & { limits: HistoryLimits }, emit: (event: AggregateLogEvent) => void) {
    this.generation = input.generation;
    this.limits = options.limits;
    this.streamFactory = options.streamFactory;
    this.now = options.now;
    this.emit = emit;
    const directory = mkdtempSync(path.join(options.rootDir, SESSION_DIR_PREFIX));
    try {
      chmodSync(directory, 0o700);
    } catch (error) {
      try { rmSync(directory, { recursive: true, force: true }); } catch { /* best effort */ }
      throw error;
    }
    this.directory = directory;
    this.states = input.sources.map((source) => ({ source, sourceKey: Buffer.from(JSON.stringify([source.cluster, source.namespace, source.pod, source.container])).toString('base64url'), status: 'queued', counters: emptyCounters(), sequence: 0, continuity: 'single-read' }));
  }

  get policy(): HistoryPolicy { return this.input.policy; }
  get isTerminal(): boolean { return this.finalized; }
  get isCleaned(): boolean { return this.cleaned; }
  get terminalStatus(): HistoryTerminalStatus | undefined { return this.finalized ? this.status as HistoryTerminalStatus : undefined; }
  get terminalTimestamp(): number | undefined { return this.terminalAt; }

  prepare(): void {
    const writers: SourceWriter[] = [];
    try {
      for (const state of this.states) {
        state.writer = new SourceWriter(this.directory, this.limits);
        writers.push(state.writer);
      }
    } catch (error) {
      for (const writer of writers) {
        try { writer.close(); } catch { /* best effort */ }
      }
      throw error;
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.status = 'reading';
    this.writeManifest();
    this.emitProgress();
    this.pump();
  }

  cancel(): void {
    if (this.finalized && this.status === 'cancelled') return;
    if (this.finalized) return;
    this.cancelRequested = true;
    for (const state of this.states) {
      if (state.status === 'queued' || state.status === 'reading' || state.status === 'indexing') {
        state.status = 'cancelled';
        state.stopReason = 'cancelled';
        state.handle?.stop();
      }
    }
    this.finalize('cancelled', true);
  }

  expire(): void {
    if (!this.finalized || this.cleaned) return;
    this.status = 'expired';
    this.cleanupFiles();
    this.emitTerminal();
  }

  cleanup(): void {
    this.cleanupFiles();
  }

  readWindow(cursor: HistoryCursor | undefined, direction: 'forward' | 'backward', requestedLimit: number): HistoryWindowResult | { error: string } {
    if (!this.finalized) return { error: 'History snapshot is still being prepared.' };
    if (this.status === 'cancelled') return { error: 'History session was cancelled.' };
    if (this.status === 'expired' || this.cleaned) return { error: 'History session expired.' };
    const now = this.now();
    this.requestTimes = this.requestTimes.filter((time) => now - time < 60_000);
    if (this.requestTimes.length >= this.limits.maxWindowRequestsPerMinute) return { error: 'History window request rate exceeded.' };
    this.requestTimes.push(now);
    const state = cursor ? this.states.find((candidate) => candidate.sourceKey === cursor.sourceKey) : this.states[0];
    if (!state || !state.writer) return { error: 'History cursor is invalid.' };
    const limit = Math.min(requestedLimit, this.limits.maxWindowRecords);
    if (!Number.isInteger(limit) || limit <= 0) return { error: 'History window limit is invalid.' };
    const total = state.writer!.lines;
    if (cursor && cursor.line > total) return { error: 'History cursor is invalid.' };
    let start = cursor?.line ?? 0;
    let end = Math.min(total, start + limit);
    if (direction === 'backward') {
      end = cursor?.line ?? total;
      start = Math.max(0, end - limit);
    }
    const result = this.readRecords(state, start, end);
    if ('error' in result) return result;
    const records = result.records;
    return { sourceKey: state.sourceKey, source: state.source, startLine: start, endLine: end, records, hasMoreBefore: start > 0, hasMoreAfter: end < total };
  }

  private readRecords(state: SourceState, start: number, end: number): { records: HistoryRecord[] } | { error: string } {
    if (start === end) return { records: [] };
    const writer = state.writer!;
    const offsets = this.readIndexOffsets(writer, start, end);
    if ('error' in offsets) return offsets;
    const bytes = offsets.endOffset - offsets.startOffset;
    if (bytes < 0 || bytes > this.limits.maxWindowBytes) return { error: 'History window exceeds the storage read limit.' };
    const memoryBytes = decodedPageMemoryBytes(bytes, end - start);
    const sourceInFlightBytes = this.inFlightDecodedBytesBySource.get(state.sourceKey) ?? 0;
    if (sourceInFlightBytes + memoryBytes > this.limits.maxInFlightDecodedBytesPerSource || this.inFlightDecodedBytes + memoryBytes > this.limits.maxInFlightDecodedBytesPerSession) {
      return { error: HISTORY_PAGE_MEMORY_ERROR };
    }
    this.inFlightDecodedBytesBySource.set(state.sourceKey, sourceInFlightBytes + memoryBytes);
    this.inFlightDecodedBytes += memoryBytes;
    try {
      const fd = openSync(writer.dataPath, 'r');
      try {
        const buffer = Buffer.alloc(bytes);
        readFully(fd, buffer, offsets.startOffset);
        const lines = buffer.toString('utf8').split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        if (lines.length !== end - start || lines.some((line) => line.length === 0)) return { error: 'History snapshot storage is invalid.' };
        const records = lines.map((line) => this.parseStoredRecord(line, state.sourceKey));
        return { records };
      } finally {
        closeSync(fd);
      }
    } catch (error) {
      if (error instanceof HistoryStorageError) return { error: error.message };
      return { error: 'History snapshot storage is unavailable.' };
    } finally {
      this.inFlightDecodedBytes -= memoryBytes;
      const remainingSourceBytes = (this.inFlightDecodedBytesBySource.get(state.sourceKey) ?? 0) - memoryBytes;
      if (remainingSourceBytes > 0) this.inFlightDecodedBytesBySource.set(state.sourceKey, remainingSourceBytes);
      else this.inFlightDecodedBytesBySource.delete(state.sourceKey);
    }
  }

  private readIndexOffsets(writer: SourceWriter, start: number, end: number): { startOffset: number; endOffset: number } | { error: string } {
    try {
      const fd = openSync(writer.indexPath, 'r');
      try {
        const chunk = Buffer.alloc(16 * 1024);
        let pending = '';
        let position = 0;
        let expectedLine = 0;
        let startOffset: number | undefined;
        let endOffset: number | undefined;
        let bytesRead = 0;
        while ((bytesRead = readSync(fd, chunk, 0, chunk.length, position)) > 0 && endOffset === undefined) {
          position += bytesRead;
          pending += chunk.subarray(0, bytesRead).toString('utf8');
          const lines = pending.split('\n');
          pending = lines.pop() ?? '';
          if (Buffer.byteLength(pending, 'utf8') > this.limits.maxIndexEntryBytes) return { error: 'History snapshot index is invalid.' };
          for (const line of lines) {
            if (!line || Buffer.byteLength(line, 'utf8') > this.limits.maxIndexEntryBytes) return { error: 'History snapshot index is invalid.' };
            const entry = JSON.parse(line) as Partial<IndexEntry>;
            const byteOffset = entry.byteOffset;
            if (entry.lineNumber !== expectedLine || !isInteger(byteOffset) || byteOffset < 0) return { error: 'History snapshot index is invalid.' };
            if (entry.lineNumber === start) startOffset = byteOffset;
            if (entry.lineNumber === end) endOffset = byteOffset;
            expectedLine += 1;
          }
        }
        if (endOffset === undefined && pending) {
          const entry = JSON.parse(pending) as Partial<IndexEntry>;
          const byteOffset = entry.byteOffset;
          if (entry.lineNumber !== expectedLine || !isInteger(byteOffset) || byteOffset < 0) return { error: 'History snapshot index is invalid.' };
          if (entry.lineNumber === start) startOffset = byteOffset;
          if (entry.lineNumber === end) endOffset = byteOffset;
          expectedLine += 1;
        }
        if (startOffset === undefined) return { error: 'History snapshot index is invalid.' };
        if (endOffset === undefined) {
          if (end !== writer.lines || expectedLine !== writer.lines) return { error: 'History snapshot index is invalid.' };
          endOffset = statSync(writer.dataPath).size;
        }
        return { startOffset, endOffset };
      } finally {
        closeSync(fd);
      }
    } catch {
      return { error: 'History snapshot storage is unavailable.' };
    }
  }

  private parseStoredRecord(line: string, sourceKey: string): HistoryRecord {
    let value: unknown;
    try { value = JSON.parse(line); } catch { throw new HistoryStorageError('History snapshot storage is invalid.'); }
    if (!value || typeof value !== 'object') throw new HistoryStorageError('History snapshot storage is invalid.');
    const record = value as Partial<HistoryRecord>;
    const sequence = record.sequence;
    const bytes = record.bytes;
    if (record.sourceKey !== sourceKey || !record.source || typeof record.source !== 'object' || !isInteger(sequence) || sequence <= 0 || (typeof record.timestamp !== 'string' && record.timestamp !== null) || typeof record.message !== 'string' || !isInteger(bytes) || bytes < 0) {
      throw new HistoryStorageError('History snapshot storage is invalid.');
    }
    return record as HistoryRecord;
  }

  private pump(): void {
    if (this.finalized) return;
    while (!this.cancelRequested && this.activeReads < this.limits.maxConcurrentSourceReads) {
      const next = this.states.find((state) => state.status === 'queued');
      if (!next) break;
      this.startSource(next);
    }
    if (!this.finalized && this.states.every((state) => ['ready', 'partial', 'failed', 'cancelled'].includes(state.status))) this.finalize(this.aggregateStatus(), false);
  }

  private startSource(state: SourceState): void {
    this.activeReads += 1;
    state.status = 'reading';
    try {
      const callbacks: StructuredLogCallbacks = {
        onLine: (line) => this.appendLine(state, line),
        onWarning: (count) => { state.counters.droppedLines += count; this.emitProgress(); },
        onLimit: (reason) => { state.stopReason = 'limit'; state.limitReason = reason; },
        onError: (message) => this.finishSource(state, 'failed', message),
        onEnd: (reason) => this.finishSource(state, reason === 'limit' ? 'partial' : reason === 'cancelled' ? 'cancelled' : 'ready'),
      };
      state.handle = this.streamFactory({ cluster: state.source.cluster, namespace: state.source.namespace, pod: state.source.pod, container: state.source.container, follow: false, tailLines: undefined, maxBytes: undefined, maxRecordBytes: this.limits.maxRecordBytes, from: this.input.from, to: this.input.to }, callbacks);
      if (this.cancelRequested) state.handle.stop();
    } catch (error) {
      this.finishSource(state, 'failed', safeErrorMessage(error));
    }
    this.emitProgress();
  }

  private appendLine(state: SourceState, line: StructuredLogLine): boolean {
    if (this.cancelRequested || state.status !== 'reading') return false;
    if (line.bytes > this.limits.maxRecordBytes) {
      state.stopReason = 'limit';
      state.limitReason = 'record-size';
      return false;
    }
    const total = this.aggregateCounters();
    if (state.counters.emittedLines + 1 > this.limits.maxLinesPerSource || state.counters.emittedBytes + line.bytes > this.limits.maxBytesPerSource) {
      state.stopReason = 'limit';
      state.limitReason = state.counters.emittedLines + 1 > this.limits.maxLinesPerSource ? 'lines-per-source' : 'bytes-per-source';
      return false;
    }
    const exceedsLines = total.lines + 1 > this.limits.maxLinesTotal;
    const exceedsBytes = total.bytes + line.bytes > this.limits.maxBytesTotal;
    if (exceedsLines || exceedsBytes) {
      state.stopReason = 'limit';
      state.limitReason = exceedsLines ? 'lines-total' : 'bytes-total';
      for (const other of this.states) {
        if (other !== state && (other.status === 'reading' || other.status === 'queued')) {
          other.status = 'partial';
          other.limitReason = 'aggregate-limit';
          other.handle?.stop();
        }
      }
      return false;
    }
    state.sequence += 1;
    const record: HistoryRecord = { sourceKey: state.sourceKey, source: state.source, sequence: state.sequence, timestamp: line.timestamp, message: line.message, bytes: line.bytes, ...(state.source.application ? { application: state.source.application } : {}) };
    try {
      const addedDisk = state.writer!.append(record, line.bytes, this.diskBytes);
      this.diskBytes += addedDisk;
      state.counters.emittedLines += 1;
      state.counters.emittedBytes += line.bytes;
      this.emitProgress();
      return true;
    } catch (error) {
      if (error instanceof HistoryLimitError) state.limitReason = error.reason;
      else state.error = 'History snapshot storage failed.';
      state.stopReason = 'limit';
      return false;
    }
  }

  private finishSource(state: SourceState, result: 'ready' | 'partial' | 'failed' | 'cancelled', error?: string): void {
    if (!['reading', 'indexing'].includes(state.status)) return;
    state.status = 'indexing';
    if (error) state.error = safeErrorMessage(error);
    if (state.writer) {
      try { state.writer.close(); } catch { state.error = 'History snapshot storage failed.'; }
    }
    state.status = state.stopReason === 'cancelled' || this.cancelRequested || result === 'cancelled' ? 'cancelled' : state.error ? 'failed' : state.stopReason === 'limit' || result === 'partial' ? 'partial' : result;
    this.activeReads = Math.max(0, this.activeReads - 1);
    this.emitProgress();
    this.pump();
  }

  private aggregateCounters(): { lines: number; bytes: number } {
    return this.states.reduce((total, state) => ({ lines: total.lines + state.counters.emittedLines, bytes: total.bytes + state.counters.emittedBytes }), { lines: 0, bytes: 0 });
  }

  private aggregateStatus(): HistoryTerminalStatus {
    if (this.cancelRequested || this.states.some((state) => state.status === 'cancelled')) return 'cancelled';
    if (this.states.every((state) => state.status === 'failed')) return 'failed';
    return this.states.every((state) => state.status === 'ready') ? 'complete' : 'partial';
  }

  private progress(): { aggregate: HistoryAggregateProgress; sources: HistorySourceProgress[] } {
    const counts = this.states.reduce((result, state) => {
      if (state.status === 'queued') result.queuedSources += 1;
      if (state.status === 'reading' || state.status === 'indexing') result.activeSources += 1;
      if (['ready', 'partial', 'failed', 'cancelled'].includes(state.status)) result.completedSources += 1;
      return result;
    }, { queuedSources: 0, activeSources: 0, completedSources: 0 });
    const counters = this.aggregateCounters();
    return {
      aggregate: { capturedLines: counters.lines, capturedBytes: counters.bytes, ...counts, sourceCount: this.states.length, determinate: false, limits: { maxLinesTotal: this.limits.maxLinesTotal, maxBytesTotal: this.limits.maxBytesTotal, maxDiskBytesTotal: this.limits.maxDiskBytesTotal, usedDiskBytes: this.diskBytes } },
      sources: this.states.map(sourceProgress),
    };
  }

  private emitProgress(): void {
    const progress = this.progress();
    this.emit({ type: 'history.progress', sessionId: this.sessionId, snapshotId: this.snapshotId, generation: this.generation, ...progress });
  }

  private finalize(status: HistoryTerminalStatus, cleanup: boolean): void {
    if (this.finalized) return;
    this.finalized = true;
    this.status = status;
    this.terminalAt = this.now();
    for (const state of this.states) {
      if (state.writer) {
        try { state.writer.close(); } catch { state.error = 'History snapshot storage failed.'; }
      }
    }
    this.writeManifest();
    this.emitTerminal();
    if (cleanup) this.cleanupFiles();
  }

  private emitTerminal(): void {
    const progress = this.progress();
    const reasons = [...new Set(this.states.map((state) => state.limitReason).filter((reason): reason is string => Boolean(reason)))];
    this.emit({ type: 'history.terminal', sessionId: this.sessionId, snapshotId: this.snapshotId, generation: this.generation, status: this.status as HistoryTerminalStatus, policy: this.input.policy, ...progress, limitReasons: reasons });
  }

  private writeManifest(): void {
    try {
      const manifest = { version: 1, sessionId: this.sessionId, snapshotId: this.snapshotId, generation: this.generation, policy: this.input.policy, range: { from: this.input.from ?? null, to: this.input.to ?? null }, sources: this.states.map(sourceProgress), status: this.status, terminalAt: this.terminalAt ?? null };
      const manifestPath = path.join(this.directory, 'manifest.json');
      const fd = openSync(manifestPath, 'w', 0o600);
      writeAll(fd, Buffer.from(JSON.stringify(manifest), 'utf8'));
      closeSync(fd);
    } catch {
      // Manifest failure cannot expose a local path or replace the snapshot's safe status.
    }
  }

  private cleanupFiles(): void {
    if (this.cleaned) return;
    for (let attempt = 0; attempt <= CLEANUP_RETRIES; attempt += 1) {
      try {
        rmSync(this.directory, { recursive: true, force: true });
        this.cleaned = true;
        return;
      } catch {
        // Bounded retries; the renderer only sees the safe lifecycle status.
      }
    }
  }
}

export class HistorySessionManager {
  private readonly rootDir: string;
  private readonly configuredLimits: HistoryLimits;
  private readonly streamFactory: HistoryStreamFactory;
  private readonly now: () => number;
  private readonly sessions = new Map<string, HistorySession>();
  private nextGeneration = 0;
  private readonly cleanupTimer: NodeJS.Timeout;
  private readonly storageReady: boolean;

  constructor(options: HistorySessionManagerOptions = {}) {
    this.rootDir = options.rootDir ?? path.join(os.tmpdir(), HISTORY_ROOT_PREFIX);
    let storageReady = true;
    try {
      mkdirSync(this.rootDir, { recursive: true, mode: 0o700 });
      chmodSync(this.rootDir, 0o700);
    } catch {
      storageReady = false;
    }
    this.storageReady = storageReady;
    this.configuredLimits = historyLimits(options.limits);
    this.streamFactory = options.streamFactory ?? streamStructuredPodLogs;
    this.now = options.now ?? Date.now;
    if (this.storageReady) cleanupOrphanedHistorySessions(this.rootDir, this.configuredLimits.orphanGraceMs, this.now);
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), Math.min(this.configuredLimits.ttlMs, 60_000));
    this.cleanupTimer.unref();
  }

  get limits(): Readonly<HistoryLimits> { return this.configuredLimits; }

  start(input: HistoryStartInput, emit: (event: AggregateLogEvent) => void): { session?: HistorySession; error?: string } {
    this.cleanupExpired();
    if (!this.storageReady) return { error: 'Could not start history session.' };
    const activeSessions = [...this.sessions.values()].filter((session) => !session.isTerminal).length;
    if (activeSessions >= this.configuredLimits.maxConcurrentSessions) return { error: 'History capacity is currently full.' };
    const generation = ++this.nextGeneration;
    let session: HistorySession | undefined;
    try {
      session = new HistorySession({ ...input, generation }, { rootDir: this.rootDir, limits: this.configuredLimits, streamFactory: this.streamFactory, now: this.now }, emit);
      session.prepare();
    } catch {
      session?.cleanup();
      return { error: 'Could not start history session.' };
    }
    this.sessions.set(session.sessionId, session);
    return { session };
  }

  get(sessionId: string, generation: number): HistorySession | { error: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { error: 'History session was not found.' };
    if (session.generation !== generation) return { error: 'History generation is stale.' };
    return session;
  }

  cancel(sessionId: string, generation: number): string | undefined {
    const session = this.get(sessionId, generation);
    if ('error' in session) return session.error;
    session.cancel();
    return undefined;
  }

  cleanupExpired(now = this.now()): void {
    for (const [sessionId, session] of this.sessions) {
      if (session.isTerminal && !session.isCleaned && session.terminalStatus !== 'cancelled' && session.terminalTimestamp !== undefined && now - session.terminalTimestamp >= this.configuredLimits.ttlMs) session.expire();
      if (this.sessions.size > this.configuredLimits.maxRetainedSessions && (session.isCleaned || session.isTerminal)) this.sessions.delete(sessionId);
    }
  }

  close(): void {
    clearInterval(this.cleanupTimer);
    for (const session of this.sessions.values()) {
      if (session.isTerminal) session.cleanup();
      else session.cancel();
    }
    this.sessions.clear();
  }
}

export function cleanupOrphanedHistorySessions(rootDir: string, graceMs: number, now = Date.now): number {
  if (!existsSync(rootDir)) return 0;
  let removed = 0;
  for (const name of readdirSync(rootDir)) {
    if (!name.startsWith(SESSION_DIR_PREFIX)) continue;
    const candidate = path.join(rootDir, name);
    try {
      if (now() - statSync(candidate).mtimeMs >= graceMs) {
        rmSync(candidate, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      // Startup cleanup is best effort and never exposes local filesystem details.
    }
  }
  return removed;
}