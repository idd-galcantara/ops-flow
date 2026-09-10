import { useEffect, useState } from 'react';
import { Activity, FileText, Info, ScrollText, X } from 'lucide-react';
import { fetchPodDescribe, fetchPodMetrics } from '../api';
import { formatCpu, formatMemory, formatTimestamp, usageRatio } from '../k8sUnits';
import { ErrorState, LoadingState } from './Feedback';
import { LogViewer } from './LogViewer';
import type { ContainerDetail, PodDescribe, PodMetricsResult, PodRef } from '../types';

type Tab = 'describe' | 'metrics' | 'logs';

/**
 * Drill-down for a single pod: describe, metrics and live logs.
 * Read-only — no action is ever offered here.
 */
export function PodDetailsPanel({ pod, onClose }: { pod: PodRef; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('describe');
  const [describe, setDescribe] = useState<PodDescribe | null>(null);
  const [describeError, setDescribeError] = useState<string>();
  const [metrics, setMetrics] = useState<PodMetricsResult | null>(null);
  const [metricsError, setMetricsError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const podId = `${pod.cluster}/${pod.namespace}/${pod.name}`;

  // Refetch whenever a different pod is opened.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setDescribe(null);
    setMetrics(null);
    setDescribeError(undefined);
    setMetricsError(undefined);

    void Promise.allSettled([
      fetchPodDescribe(pod.cluster, pod.namespace, pod.name),
      fetchPodMetrics(pod.cluster, pod.namespace, pod.name),
    ]).then(([describeResult, metricsResult]) => {
      if (!active) return;
      if (describeResult.status === 'fulfilled') setDescribe(describeResult.value);
      else setDescribeError(messageOf(describeResult.reason));
      if (metricsResult.status === 'fulfilled') setMetrics(metricsResult.value);
      else setMetricsError(messageOf(metricsResult.reason));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [pod.cluster, pod.namespace, pod.name]);

  return (
    <section className="details-panel" aria-label={`Detalhes do pod ${pod.name}`}>
      <header className="details-header">
        <div className="details-heading">
          <span className="details-icon">
            <Info size={15} />
          </span>
          <div>
            <span className="eyebrow">{pod.cluster} · {pod.namespace}</span>
            <h3 title={pod.name}>{pod.name}</h3>
          </div>
        </div>
        <button
          type="button"
          className="icon-button subtle"
          onClick={onClose}
          title="Fechar detalhes"
          aria-label="Fechar detalhes"
        >
          <X size={17} />
        </button>
      </header>

      <div className="details-tabs" role="tablist" aria-label="Seções do pod">
        <TabButton active={tab === 'describe'} onClick={() => setTab('describe')} icon={<FileText size={13} />}>
          Describe
        </TabButton>
        <TabButton active={tab === 'metrics'} onClick={() => setTab('metrics')} icon={<Activity size={13} />}>
          Métricas
        </TabButton>
        <TabButton active={tab === 'logs'} onClick={() => setTab('logs')} icon={<ScrollText size={13} />}>
          Logs
        </TabButton>
      </div>

      <div className="details-content" role="tabpanel">
        {tab === 'describe' && (
          <DescribeTab loading={loading} describe={describe} error={describeError} />
        )}
        {tab === 'metrics' && (
          <MetricsTab
            loading={loading}
            metrics={metrics}
            error={metricsError}
            containers={describe?.containers ?? []}
          />
        )}
        {tab === 'logs' && <LogViewer key={podId} pod={pod} />}
      </div>
    </section>
  );
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Falha ao carregar.';
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button type="button" role="tab" aria-selected={active} className={active ? 'active' : ''} onClick={onClick}>
      {icon} {children}
    </button>
  );
}

function DescribeTab({
  loading,
  describe,
  error,
}: {
  loading: boolean;
  describe: PodDescribe | null;
  error?: string;
}) {
  if (loading) return <LoadingState message="Carregando detalhes..." />;
  if (error) return <ErrorState message={error} />;
  if (!describe) return null;

  return (
    <div className="describe-body">
      <dl className="detail-grid">
        <Detail label="Status" value={describe.status} />
        <Detail label="Node" value={describe.node || '—'} mono />
        <Detail label="Pod IP" value={describe.podIP ?? '—'} mono />
        <Detail label="QoS" value={describe.qosClass ?? '—'} />
        <Detail label="Service account" value={describe.serviceAccount ?? '—'} mono />
        <Detail label="Criado em" value={formatTimestamp(describe.createdAt)} />
      </dl>

      <DetailSection title={`Containers (${describe.containers.length})`}>
        <div className="container-cards">
          {describe.containers.map((c) => (
            <ContainerCard key={c.name} container={c} />
          ))}
        </div>
      </DetailSection>

      <DetailSection title={`Conditions (${describe.conditions.length})`}>
        <ul className="condition-list">
          {describe.conditions.map((c) => (
            <li key={c.type}>
              <span className={`condition-dot ${c.status === 'True' ? 'is-true' : 'is-false'}`} />
              <span className="condition-type">{c.type}</span>
              <span className="condition-status">{c.status}</span>
              {c.reason && <span className="condition-reason">{c.reason}</span>}
            </li>
          ))}
        </ul>
      </DetailSection>

      <DetailSection title={`Events (${describe.events.length})`}>
        {describe.eventsError && (
          <p className="details-note">Não foi possível ler os events: {describe.eventsError}</p>
        )}
        {describe.events.length === 0 && !describe.eventsError && (
          <p className="details-note">Nenhum event recente para este pod.</p>
        )}
        <ul className="event-list">
          {describe.events.map((e, i) => (
            <li key={`${e.reason}-${i}`} className={e.type === 'Warning' ? 'is-warning' : ''}>
              <div className="event-top">
                <span className="event-reason">{e.reason}</span>
                <span className="event-type">{e.type}</span>
                {e.count > 1 && <span className="event-count">×{e.count}</span>}
                <span className="event-time">{formatTimestamp(e.lastSeen)}</span>
              </div>
              <p className="event-message">{e.message}</p>
            </li>
          ))}
        </ul>
      </DetailSection>

      <DetailSection title={`Labels (${Object.keys(describe.labels).length})`}>
        <KeyValueList entries={describe.labels} />
      </DetailSection>
    </div>
  );
}

function ContainerCard({ container }: { container: ContainerDetail }) {
  return (
    <article className="container-card">
      <div className="container-card-top">
        <strong>{container.name}</strong>
        {container.sidecar && <span className="sidecar-tag">sidecar</span>}
        <span className={`status-badge ${container.ready ? 'severity-ok' : 'severity-warn'}`}>
          {container.ready ? 'ready' : container.state}
        </span>
      </div>
      <p className="container-image" title={container.image}>
        {container.image}
      </p>
      <div className="container-meta">
        <span>restarts: {container.restartCount}</span>
        {container.reason && <span>motivo: {container.reason}</span>}
        {container.requests && (
          <span>
            requests: {container.requests.cpu ?? '—'} / {container.requests.memory ?? '—'}
          </span>
        )}
        {container.limits && (
          <span>
            limits: {container.limits.cpu ?? '—'} / {container.limits.memory ?? '—'}
          </span>
        )}
      </div>
    </article>
  );
}

function MetricsTab({
  loading,
  metrics,
  error,
  containers,
}: {
  loading: boolean;
  metrics: PodMetricsResult | null;
  error?: string;
  containers: ContainerDetail[];
}) {
  if (loading) return <LoadingState message="Carregando métricas..." />;
  if (error) return <ErrorState message={error} />;
  if (!metrics) return null;

  // A cluster without metrics-server is expected, not an error.
  if (!metrics.available) {
    return (
      <div className="metrics-unavailable">
        <div className="empty-icon">
          <Activity size={21} />
        </div>
        <h4>Métricas indisponíveis</h4>
        <p>{metrics.reason ?? 'Este cluster não expõe a API de métricas.'}</p>
        <p className="details-note">
          O describe e os logs continuam disponíveis normalmente.
        </p>
      </div>
    );
  }

  const limitFor = (name: string) => containers.find((c) => c.name === name)?.limits;

  return (
    <div className="metrics-body">
      <p className="details-note">
        Janela de coleta: {metrics.window ?? '—'} · {formatTimestamp(metrics.timestamp)}
      </p>
      <div className="metric-cards">
        {(metrics.containers ?? []).map((c) => {
          const limits = limitFor(c.name);
          return (
            <article className="metric-card" key={c.name}>
              <strong>{c.name}</strong>
              <MetricRow
                label="CPU"
                value={formatCpu(c.cpu)}
                ratio={usageRatio(c.cpu, limits?.cpu, 'cpu')}
                limit={limits?.cpu}
              />
              <MetricRow
                label="Memória"
                value={formatMemory(c.memory)}
                ratio={usageRatio(c.memory, limits?.memory, 'memory')}
                limit={limits?.memory}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  ratio,
  limit,
}: {
  label: string;
  value: string;
  ratio: number | null;
  limit?: string;
}) {
  const percent = ratio === null ? null : Math.min(100, Math.round(ratio * 100));
  const severity = percent === null ? '' : percent >= 90 ? 'is-high' : percent >= 70 ? 'is-mid' : 'is-low';

  return (
    <div className="metric-row">
      <div className="metric-row-top">
        <span className="metric-label">{label}</span>
        <span className="metric-value">{value}</span>
        {limit && <span className="metric-limit">/ {limit}</span>}
        {percent !== null && <span className={`metric-percent ${severity}`}>{percent}%</span>}
      </div>
      {percent !== null && (
        <div className="metric-bar" role="presentation">
          <div className={`metric-bar-fill ${severity}`} style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="detail-item">
      <dt>{label}</dt>
      <dd className={mono ? 'mono-cell' : undefined}>{value}</dd>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="detail-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function KeyValueList({ entries }: { entries: Record<string, string> }) {
  const keys = Object.keys(entries).sort();
  if (keys.length === 0) return <p className="details-note">Nenhum.</p>;
  return (
    <ul className="kv-list">
      {keys.map((key) => (
        <li key={key}>
          <span className="kv-key">{key}</span>
          <span className="kv-value">{entries[key]}</span>
        </li>
      ))}
    </ul>
  );
}
