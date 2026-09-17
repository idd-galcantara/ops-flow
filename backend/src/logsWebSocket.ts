import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { normalizeTailLines, streamPodLogs } from './kube/logsService.js';
import { startLogSubscription, type RunningLogSubscription } from './logsSubscription.js';
import type { AggregateLogEvent, LegacyLogEvent } from './logsTypes.js';
import { validateHistoryCancel, validateHistoryStart, validateHistoryWindow, validateSubscription } from './logsProtocol.js';
import { safeErrorMessage } from './kube/podsService.js';
import { HistorySessionManager } from './historySession.js';

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
export function attachLogsWebSocket(server: Server, options: { historyManager?: HistorySessionManager } = {}): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const historyManager = options.historyManager ?? new HistorySessionManager();
  server.once('close', () => historyManager.close());

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '', 'http://localhost');
    if (url.pathname === AGGREGATE_LOGS_PATH) {
      wss.handleUpgrade(request, socket, head, (ws) => handleAggregateLogSocket(ws, historyManager));
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

function handleAggregateLogSocket(ws: WebSocket, historyManager: HistorySessionManager): void {
  let receivedMessage = false;
  let subscription: RunningLogSubscription | undefined;
  let historySessionId: string | undefined;
  let historyGeneration: number | undefined;
  const maxFrameBytes = historyManager.limits.maxFrameBytes;

  const send = (event: AggregateLogEvent) => {
    if (ws.readyState !== ws.OPEN) return;
    const payload = JSON.stringify(event);
    if (Buffer.byteLength(payload, 'utf8') > maxFrameBytes) {
      ws.send(JSON.stringify({ type: 'error', message: 'The history response exceeds the transport limit.' }));
      return;
    }
    ws.send(payload);
  };

  const failProtocol = (message: string) => {
    send({ type: 'error', message });
    if (ws.readyState === ws.OPEN) ws.close();
  };

  const cancelOwnedSession = () => {
    subscription?.cancel();
    if (historySessionId !== undefined && historyGeneration !== undefined) historyManager.cancel(historySessionId, historyGeneration);
  };
  ws.on('close', cancelOwnedSession);
  ws.on('error', cancelOwnedSession);
  ws.on('message', (data) => {
    if (Buffer.byteLength(data.toString(), 'utf8') > maxFrameBytes) {
      failProtocol('The protocol message is too large.');
      return;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(data.toString());
    } catch {
      failProtocol('The subscribe message must be valid JSON.');
      return;
    }
    if (raw && typeof raw === 'object' && (raw as { type?: unknown }).type === 'history.start') {
      if (receivedMessage) { failProtocol('Only one initial log session is allowed.'); return; }
      receivedMessage = true;
      const validated = validateHistoryStart(raw);
      if ('error' in validated) { failProtocol(validated.error); return; }
      const started = historyManager.start(validated.request, send);
      if (started.error || !started.session) { failProtocol(started.error ?? 'Could not start history.'); return; }
      historySessionId = started.session.sessionId;
      historyGeneration = started.session.generation;
      send({ type: 'history.accepted', requestId: validated.request.requestId, sessionId: started.session.sessionId, snapshotId: started.session.snapshotId, generation: started.session.generation, policy: validated.request.policy, sourceCount: validated.request.sources.length });
      started.session.start();
      return;
    }

    if (raw && typeof raw === 'object' && (raw as { type?: unknown }).type === 'history.window') {
      const validated = validateHistoryWindow(raw);
      if ('error' in validated) { send({ type: 'error', message: validated.error }); return; }
      if (!historySessionId || validated.request.sessionId !== historySessionId || validated.request.generation !== historyGeneration) { send({ type: 'error', message: 'History generation is stale.' }); return; }
      const session = historyManager.get(validated.request.sessionId, validated.request.generation);
      if ('error' in session) { send({ type: 'error', message: session.error }); return; }
      const window = session.readWindow(validated.request.cursor, validated.request.direction, validated.request.limit);
      if ('error' in window) { send({ type: 'error', message: window.error }); return; }
      send({ type: 'history.window', sessionId: session.sessionId, snapshotId: session.snapshotId, generation: session.generation, ...window });
      return;
    }

    if (raw && typeof raw === 'object' && (raw as { type?: unknown }).type === 'history.cancel') {
      const validated = validateHistoryCancel(raw);
      if ('error' in validated) { send({ type: 'error', message: validated.error }); return; }
      const error = historyManager.cancel(validated.request.sessionId, validated.request.generation);
      if (error) send({ type: 'error', message: error });
      return;
    }

    if (receivedMessage) { failProtocol('Only one subscribe message is allowed.'); return; }
    receivedMessage = true;
    const validated = validateSubscription(raw);
    if ('error' in validated) { failProtocol(validated.error); return; }
    const effective = validated.subscription;
    send({ type: 'accepted', from: effective.from ?? null, to: effective.to ?? null, follow: effective.follow, limits: effective.limits, sourceCount: effective.sources.length });
    subscription = startLogSubscription(effective, send);
    void subscription.completion.then(() => { if (ws.readyState === ws.OPEN) ws.close(); });
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
