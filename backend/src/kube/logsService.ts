import { PassThrough } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { logForContext } from './kubeconfig.js';
import { safeErrorMessage } from './podsService.js';

export interface LogStreamOptions {
  cluster: string;
  namespace: string;
  pod: string;
  container: string;
  follow: boolean;
  tailLines: number;
}

export interface StructuredLogOptions extends LogStreamOptions {
  from?: string;
  to?: string;
  maxBytes?: number;
}

export interface StructuredLogLine {
  timestamp: string | null;
  message: string;
  bytes: number;
}

export interface StructuredLogCallbacks {
  onLine: (line: StructuredLogLine) => boolean | void;
  onWarning?: (count: number) => void;
  onError: (message: string) => void;
  onEnd: (reason: 'eof' | 'to-reached' | 'limit' | 'cancelled') => void;
}

export interface LogLineParser {
  push: (chunk: Buffer) => string[];
  end: () => string[];
}

export interface LogStreamHandle {
  /** Stops the upstream request and releases resources. */
  stop: () => void;
}

export interface LogStreamCallbacks {
  onLine: (line: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

/** Upper bound so a huge backlog can't be requested by accident. */
export const MAX_TAIL_LINES = 5000;

/** Clamps tailLines into a sane range. */
export function normalizeTailLines(raw: unknown, fallback = 500): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), MAX_TAIL_LINES);
}

export function parseTimestampedLine(line: string): { timestamp: string | null; message: string } {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)(?:\s+)?(.*)$/.exec(line);
  if (!match) return { timestamp: null, message: line };
  const date = new Date(match[1]);
  if (Number.isNaN(date.getTime())) return { timestamp: null, message: line };
  return { timestamp: date.toISOString(), message: match[2] };
}

export function parseLogLine(
  line: string,
  range: { from?: string; to?: string } = {},
): { kind: 'emit' | 'drop' | 'to-reached'; record?: StructuredLogLine } {
  const parsed = parseTimestampedLine(line);
  const hasBoundary = Boolean(range.from || range.to);
  if (!parsed.timestamp) {
    if (hasBoundary) return { kind: 'drop' };
    return { kind: 'emit', record: { ...parsed, bytes: Buffer.byteLength(parsed.message, 'utf8') + 1 } };
  }

  const timestampMs = Date.parse(parsed.timestamp);
  if (range.from && timestampMs < Date.parse(range.from)) return { kind: 'drop' };
  if (range.to && timestampMs >= Date.parse(range.to)) return { kind: 'to-reached' };
  return { kind: 'emit', record: { ...parsed, bytes: Buffer.byteLength(parsed.message, 'utf8') + 1 } };
}

export function createLogLineParser(): LogLineParser {
  const decoder = new StringDecoder('utf8');
  let buffer = '';
  const split = (): string[] => {
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    return lines.map((line) => line.endsWith('\r') ? line.slice(0, -1) : line);
  };
  return {
    push: (chunk) => {
      buffer += decoder.write(chunk);
      return split();
    },
    end: () => {
      buffer += decoder.end();
      if (!buffer) return [];
      const line = buffer;
      buffer = '';
      return [line];
    },
  };
}

/**
 * Streams a container's logs, emitting complete lines.
 *
 * Read-only: this uses the pod log endpoint only. The returned handle aborts the
 * upstream request, which matters because a `follow` stream would otherwise stay
 * open after the client disconnects.
 */
export function streamPodLogs(
  options: LogStreamOptions,
  callbacks: LogStreamCallbacks,
): LogStreamHandle {
  const stream = new PassThrough();
  let buffer = '';
  let stopped = false;
  let abort: AbortController | undefined;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    abort?.abort();
    stream.destroy();
  };

  stream.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    // Keep the trailing partial line in the buffer until its newline arrives.
    buffer = lines.pop() ?? '';
    for (const line of lines) callbacks.onLine(line);
  });

  stream.on('end', () => {
    if (buffer.length > 0) {
      callbacks.onLine(buffer);
      buffer = '';
    }
    callbacks.onEnd();
  });

  stream.on('error', (err: Error) => {
    if (!stopped) callbacks.onError(safeErrorMessage(err));
  });

  const log = logForContext(options.cluster);
  log
    .log(options.namespace, options.pod, options.container, stream, {
      follow: options.follow,
      tailLines: options.tailLines,
      timestamps: false,
    })
    .then((controller) => {
      abort = controller;
      // The client may have disconnected while the request was being set up.
      if (stopped) controller.abort();
    })
    .catch((err: unknown) => {
      // Sanitize: the client's ApiException message embeds the raw body and all
      // response headers, which must never reach the browser.
      callbacks.onError(safeErrorMessage(err));
    });

  return { stop };
}

/** Timestamped, bounded source stream used by the aggregate protocol. */
export function streamStructuredPodLogs(
  options: StructuredLogOptions,
  callbacks: StructuredLogCallbacks,
): LogStreamHandle {
  const stream = new PassThrough();
  const parser = createLogLineParser();
  let stopped = false;
  let completed = false;
  let abort: AbortController | undefined;

  const finish = (reason: 'eof' | 'to-reached' | 'limit' | 'cancelled') => {
    if (completed) return;
    completed = true;
    callbacks.onEnd(reason);
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    abort?.abort();
    stream.destroy();
    finish('cancelled');
  };
  const consumeLine = (line: string) => {
    const parsed = parseLogLine(line, options);
    if (parsed.kind === 'drop') {
      callbacks.onWarning?.(1);
      return;
    }
    if (parsed.kind === 'to-reached') {
      stopped = true;
      abort?.abort();
      stream.destroy();
      finish('to-reached');
      return;
    }
    if (parsed.record && callbacks.onLine(parsed.record) === false) {
      stopped = true;
      abort?.abort();
      stream.destroy();
      finish('limit');
    }
  };

  stream.on('data', (chunk: Buffer) => {
    if (stopped) return;
    for (const line of parser.push(chunk)) {
      consumeLine(line);
      if (stopped) break;
    }
  });
  stream.on('end', () => {
    if (stopped) return;
    for (const line of parser.end()) consumeLine(line);
    if (!stopped) finish('eof');
  });
  stream.on('error', (err: Error) => {
    if (!stopped) {
      stopped = true;
      callbacks.onError(safeErrorMessage(err));
    }
  });

  const log = logForContext(options.cluster);
  log
    .log(options.namespace, options.pod, options.container, stream, {
      follow: options.follow,
      tailLines: options.tailLines,
      limitBytes: options.maxBytes,
      sinceTime: options.from,
      timestamps: true,
    })
    .then((controller) => {
      abort = controller;
      if (stopped) controller.abort();
    })
    .catch((err: unknown) => {
      if (stopped) return;
      stopped = true;
      callbacks.onError(safeErrorMessage(err));
    });

  return { stop };
}
