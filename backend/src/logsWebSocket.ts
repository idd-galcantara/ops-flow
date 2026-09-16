import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { normalizeTailLines, streamPodLogs } from './kube/logsService.js';
import { startLogSubscription, type RunningLogSubscription } from './logsSubscription.js';
import type { AggregateLogEvent, LegacyLogEvent } from './logsTypes.js';
import { validateSubscription } from './logsProtocol.js';
import { safeErrorMessage } from './kube/podsService.js';

/** Messages pushed to the browser over the log socket. */
type OutboundMessage = LegacyLogEvent;

const LOGS_PATH = /^\/api\/pods\/([^/]+)\/([^/]+)\/([^/]+)\/logs$/;
const AGGREGATE_LOGS_PATH = '/api/logs';

/**
 * Attaches the log-streaming WebSocket endpoint to the HTTP server.
 *
 * Path: /api/pods/:cluster/:namespace/:pod/logs?container=&follow=&tailLines=
 *
 * Uses `noServer` + manual upgrade handling so only this exact path is accepted;
 * any other upgrade attempt is rejected instead of silently held open.
 */
export function attachLogsWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '', 'http://localhost');
    if (url.pathname === AGGREGATE_LOGS_PATH) {
      wss.handleUpgrade(request, socket, head, (ws) => handleAggregateLogSocket(ws));
      return;
    }
    const match = LOGS_PATH.exec(url.pathname);

    if (!match) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      handleLogSocket(ws, {
        cluster: decodeURIComponent(match[1]),
        namespace: decodeURIComponent(match[2]),
        pod: decodeURIComponent(match[3]),
        container: url.searchParams.get('container') ?? '',
        follow: url.searchParams.get('follow') !== 'false',
        tailLines: normalizeTailLines(url.searchParams.get('tailLines')),
      });
    });
  });

  return wss;
}

function handleAggregateLogSocket(ws: WebSocket): void {
  let receivedMessage = false;
  let subscription: RunningLogSubscription | undefined;

  const send = (event: AggregateLogEvent) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
  };

  const failProtocol = (message: string) => {
    send({ type: 'error', message });
    if (ws.readyState === ws.OPEN) ws.close();
  };

  ws.on('close', () => subscription?.cancel());
  ws.on('error', () => subscription?.cancel());
  ws.on('message', (data) => {
    if (receivedMessage) {
      failProtocol('Only one subscribe message is allowed.');
      return;
    }
    receivedMessage = true;

    let raw: unknown;
    try {
      raw = JSON.parse(data.toString());
    } catch {
      failProtocol('The subscribe message must be valid JSON.');
      return;
    }
    const validated = validateSubscription(raw);
    if ('error' in validated) {
      failProtocol(validated.error);
      return;
    }

    const effective = validated.subscription;
    send({
      type: 'accepted',
      from: effective.from ?? null,
      to: effective.to ?? null,
      follow: effective.follow,
      limits: effective.limits,
      sourceCount: effective.sources.length,
    });
    subscription = startLogSubscription(effective, send);
    void subscription.completion.then(() => {
      if (ws.readyState === ws.OPEN) ws.close();
    });
  });
}

function handleLogSocket(
  ws: WebSocket,
  options: {
    cluster: string;
    namespace: string;
    pod: string;
    container: string;
    follow: boolean;
    tailLines: number;
  },
): void {
  const send = (message: OutboundMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  };

  if (!options.container) {
    send({ type: 'error', message: 'Provide the container (the "container" parameter).' });
    ws.close();
    return;
  }

  let handle: { stop: () => void } | undefined;
  let stopRequested = false;

  /**
   * Stops the upstream stream. Safe to call before `streamPodLogs` has returned:
   * the request is marked as stopped and aborted as soon as the handle exists.
   */
  const stopStream = () => {
    stopRequested = true;
    handle?.stop();
  };

  // Registered before starting the stream so a disconnect during setup is honored.
  // Without this, a `follow` stream would keep running for a client that left.
  ws.on('close', stopStream);
  ws.on('error', stopStream);

  try {
    handle = streamPodLogs(options, {
      onLine: (line) => send({ type: 'line', line }),
      onError: (message) => {
        send({ type: 'error', message });
        // A failed log request (missing container, deleted pod, no permission) is
        // terminal. Close instead of leaving the browser waiting on a dead stream.
        stopStream();
        if (ws.readyState === ws.OPEN) ws.close();
      },
      onEnd: () => {
        send({ type: 'end' });
        // A non-follow stream is finished; close so the client stops waiting.
        if (!options.follow && ws.readyState === ws.OPEN) ws.close();
      },
    });
    if (stopRequested) handle.stop();
    else send({ type: 'started', container: options.container });
  } catch (err) {
    send({ type: 'error', message: safeErrorMessage(err) });
    ws.close();
  }
}
