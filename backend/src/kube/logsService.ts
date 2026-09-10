import { PassThrough } from 'node:stream';
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
