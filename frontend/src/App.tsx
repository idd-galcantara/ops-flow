import { useEffect, useState } from 'react';
import { Layers, Workflow } from 'lucide-react';

type HealthState =
  | { kind: 'loading' }
  | { kind: 'ok'; service: string }
  | { kind: 'error'; message: string };

/**
 * Fase 0: shell visual do ops-flow com a linha do our-flow (topbar, brand-mark,
 * paleta terracota) e uma checagem de conectividade com o backend via /api/health.
 * As telas de seleção de alvos e a tabela unificada de pods chegam na Fase 3.
 */
export default function App() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { service?: string }) => {
        if (active) setHealth({ kind: 'ok', service: data.service ?? 'backend' });
      })
      .catch((err: unknown) => {
        if (active) setHealth({ kind: 'error', message: err instanceof Error ? err.message : 'unknown' });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Workflow size={17} strokeWidth={2.5} />
          </div>
          <div>
            <strong>ops-flow</strong>
            <span>Kubernetes unified view</span>
          </div>
        </div>
        <div className={`topbar-status ${statusClass(health)}`}>
          <span className="status-dot" />
          {statusLabel(health)}
        </div>
      </header>

      <main className="content">
        <section className="welcome-card">
          <div className="welcome-icon">
            <Layers size={22} />
          </div>
          <span className="eyebrow">Fase 0 · Fundação</span>
          <h1>ops-flow</h1>
          <p>
            Visualização unificada e read-only de recursos Kubernetes de múltiplos clusters e
            namespaces ao mesmo tempo. A seleção de alvos e a tabela unificada de pods entram nas
            próximas fases.
          </p>
          <div className={`topbar-status ${statusClass(health)}`}>
            <span className="status-dot" />
            {statusLabel(health)}
          </div>
        </section>
      </main>
    </div>
  );
}

function statusClass(health: HealthState): string {
  if (health.kind === 'ok') return 'status-ok';
  if (health.kind === 'error') return 'status-error';
  return 'status-loading';
}

function statusLabel(health: HealthState): string {
  if (health.kind === 'ok') return `Backend online · ${health.service}`;
  if (health.kind === 'error') return `Backend offline · ${health.message}`;
  return 'Conectando ao backend...';
}
