import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Search, Trash2, X } from 'lucide-react';
import { podLogsUrl } from '../api';
import { highlightSegments } from '../textHighlight';
import { ErrorState } from './Feedback';
import type { PodRef } from '../types';

/** Keeps memory bounded on chatty containers. */
const MAX_LINES = 5000;
const TAIL_LINES = 500;

type ConnectionState = 'connecting' | 'streaming' | 'ended' | 'error';

interface InboundMessage {
  type: 'line' | 'error' | 'end' | 'started';
  line?: string;
  message?: string;
  container?: string;
}

/**
 * Live log viewer for one container, streamed over a WebSocket.
 *
 * Pausing keeps the socket open but stops appending, so the stream can be
 * resumed without losing the connection.
 */
export function LogViewer({ pod }: { pod: PodRef }) {
  const [container, setContainer] = useState(pod.containers[0] ?? '');
  const [lines, setLines] = useState<string[]>([]);
  const [state, setState] = useState<ConnectionState>('connecting');
  const [error, setError] = useState<string>();
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('');

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const autoScrollRef = useRef(autoScroll);
  autoScrollRef.current = autoScroll;
  const scrollRef = useRef<HTMLDivElement>(null);

  // One socket per (pod, container). Re-subscribing resets the buffer.
  useEffect(() => {
    if (!container) return;

    setLines([]);
    setError(undefined);
    setState('connecting');

    /**
     * Guards against a superseded socket writing state.
     *
     * Closing a socket that is still CONNECTING makes the browser fire `error`.
     * That happens on every teardown — React's StrictMode double-invokes effects
     * in development, and switching containers closes the previous socket — so
     * without this flag a stale socket would raise a phantom "could not connect"
     * banner while the current socket streams fine.
     */
    let active = true;

    const socket = new WebSocket(
      podLogsUrl(pod.cluster, pod.namespace, pod.name, {
        container,
        follow: true,
        tailLines: TAIL_LINES,
      }),
    );

    socket.onmessage = (event: MessageEvent<string>) => {
      if (!active) return;

      let message: InboundMessage;
      try {
        message = JSON.parse(event.data) as InboundMessage;
      } catch {
        return;
      }

      if (message.type === 'started') {
        setState('streaming');
        return;
      }
      if (message.type === 'line') {
        // While paused we intentionally drop incoming lines rather than buffering
        // them forever; the socket stays open so resuming is instant.
        if (pausedRef.current) return;
        setLines((current) => {
          const next = [...current, message.line ?? ''];
          return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
        });
        return;
      }
      if (message.type === 'error') {
        setError(message.message ?? 'Log stream error.');
        setState('error');
        return;
      }
      if (message.type === 'end') {
        setState('ended');
      }
    };

    socket.onerror = () => {
      if (!active) return;
      setError('Could not connect to the log stream.');
      setState('error');
    };

    socket.onclose = () => {
      if (!active) return;
      setState((current) => (current === 'error' ? current : 'ended'));
    };

    return () => {
      active = false;
      socket.close();
    };
  }, [container, pod.cluster, pod.namespace, pod.name]);

  const visibleLines = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return lines;
    return lines.filter((line) => line.toLowerCase().includes(needle));
  }, [filter, lines]);

  // Scroll the log container itself rather than calling scrollIntoView, which
  // would also scroll ancestor containers and could shift the whole layout.
  useLayoutEffect(() => {
    if (!autoScroll || paused) return;
    const el = scrollRef.current;
    if (!el) return;

    el.scrollTop = el.scrollHeight;
    const frame = window.requestAnimationFrame(() => {
      const current = scrollRef.current;
      if (current && autoScrollRef.current && !pausedRef.current) {
        current.scrollTop = current.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [visibleLines, autoScroll, paused]);

  /** Turns auto-scroll off when the user scrolls up to read history. */
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  return (
    <div className="log-viewer">
      <div className="log-toolbar">
        {pod.containers.length > 1 && (
          <label className="log-container-select">
            <span className="visually-hidden">Container</span>
            <select value={container} onChange={(e) => setContainer(e.target.value)} aria-label="Container">
              {pod.containers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}

        <span className={`log-state log-state-${state}`}>
          <span className="status-dot" />
          {state === 'connecting' && 'connecting'}
          {state === 'streaming' && (paused ? 'paused' : 'live')}
          {state === 'ended' && 'ended'}
          {state === 'error' && 'error'}
        </span>

        <label className="log-filter">
          <Search size={13} />
          <span className="visually-hidden">Filter lines</span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter lines..."
            aria-label="Filter log lines"
          />
          {filter && (
            <button type="button" className="filter-clear" onClick={() => setFilter('')} aria-label="Clear filter">
              <X size={11} />
            </button>
          )}
        </label>

        <div className="log-actions">
          <button
            type="button"
            className="icon-button subtle"
            onClick={() => setPaused((p) => !p)}
            title={paused ? 'Resume' : 'Pause'}
            aria-label={paused ? 'Resume stream' : 'Pause stream'}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            type="button"
            className="icon-button subtle"
            onClick={() => setLines([])}
            title="Clear"
            aria-label="Clear lines"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} />}

      <div className="log-output" ref={scrollRef} onScroll={onScroll} tabIndex={0} aria-label="Log output">
        {visibleLines.length === 0 ? (
          <p className="log-empty">
            {state === 'connecting'
              ? 'Connecting to container...'
              : filter
                ? 'No line matches the filter.'
                : 'No lines received yet.'}
          </p>
        ) : (
          visibleLines.map((line, i) => <LogLine key={i} line={line} query={filter} />)
        )}
      </div>

      <div className="log-footer">
        <span>
          {filter ? `${visibleLines.length} of ${lines.length}` : `${lines.length}`} lines
          {lines.length >= MAX_LINES && ' (limit reached, keeping the most recent)'}
        </span>
        {!autoScroll && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setAutoScroll(true);
              const el = scrollRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            Jump to end
          </button>
        )}
      </div>
    </div>
  );
}

/** A single log line, with the active filter term highlighted. */
function LogLine({ line, query }: { line: string; query: string }) {
  const segments = highlightSegments(line, query);

  return (
    <div className="log-line">
      {line === '' && '\u00a0'}
      {segments.map((segment, i) =>
        segment.match ? (
          <mark className="log-mark" key={i}>
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </div>
  );
}
