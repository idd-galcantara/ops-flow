import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, Pause, Play, Search, Trash2, X } from 'lucide-react';
import { podLogsUrl } from '../api';
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // One socket per (pod, container). Re-subscribing resets the buffer.
  useEffect(() => {
    if (!container) return;

    setLines([]);
    setError(undefined);
    setState('connecting');

    const socket = new WebSocket(
      podLogsUrl(pod.cluster, pod.namespace, pod.name, {
        container,
        follow: true,
        tailLines: TAIL_LINES,
      }),
    );

    socket.onmessage = (event: MessageEvent<string>) => {
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
        setError(message.message ?? 'Erro no stream de logs.');
        setState('error');
        return;
      }
      if (message.type === 'end') {
        setState('ended');
      }
    };

    socket.onerror = () => {
      setError('Não foi possível conectar ao stream de logs.');
      setState('error');
    };

    socket.onclose = () => {
      setState((current) => (current === 'error' ? current : 'ended'));
    };

    return () => {
      socket.close();
    };
  }, [container, pod.cluster, pod.namespace, pod.name]);

  const visibleLines = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return lines;
    return lines.filter((line) => line.toLowerCase().includes(needle));
  }, [filter, lines]);

  useEffect(() => {
    if (autoScroll && !paused) bottomRef.current?.scrollIntoView({ block: 'end' });
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
          {state === 'connecting' && 'conectando'}
          {state === 'streaming' && (paused ? 'pausado' : 'ao vivo')}
          {state === 'ended' && 'encerrado'}
          {state === 'error' && 'erro'}
        </span>

        <label className="log-filter">
          <Search size={13} />
          <span className="visually-hidden">Filtrar linhas</span>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar linhas..."
            aria-label="Filtrar linhas de log"
          />
          {filter && (
            <button type="button" className="filter-clear" onClick={() => setFilter('')} aria-label="Limpar filtro">
              <X size={11} />
            </button>
          )}
        </label>

        <div className="log-actions">
          <button
            type="button"
            className="icon-button subtle"
            onClick={() => setPaused((p) => !p)}
            title={paused ? 'Retomar' : 'Pausar'}
            aria-label={paused ? 'Retomar stream' : 'Pausar stream'}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            type="button"
            className="icon-button subtle"
            onClick={() => setLines([])}
            title="Limpar"
            aria-label="Limpar linhas"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {error && (
        <p className="panel-error" role="alert">
          <CircleAlert size={14} /> {error}
        </p>
      )}

      <div className="log-output" ref={scrollRef} onScroll={onScroll} tabIndex={0} aria-label="Saída de logs">
        {visibleLines.length === 0 ? (
          <p className="log-empty">
            {state === 'connecting'
              ? 'Conectando ao container...'
              : filter
                ? 'Nenhuma linha corresponde ao filtro.'
                : 'Nenhuma linha recebida ainda.'}
          </p>
        ) : (
          visibleLines.map((line, i) => (
            <div className="log-line" key={i}>
              {line || '\u00a0'}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="log-footer">
        <span>
          {filter ? `${visibleLines.length} de ${lines.length}` : `${lines.length}`} linhas
          {lines.length >= MAX_LINES && ' (limite atingido, mantendo as mais recentes)'}
        </span>
        {!autoScroll && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setAutoScroll(true);
              bottomRef.current?.scrollIntoView({ block: 'end' });
            }}
          >
            Ir para o fim
          </button>
        )}
      </div>
    </div>
  );
}
