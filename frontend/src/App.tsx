import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Layers, Search, Workflow } from 'lucide-react';
import { PodTable } from './components/PodTable';
import { TargetErrorBanner } from './components/TargetErrorBanner';
import { TargetSelector } from './components/TargetSelector';
import { ViewToolbar } from './components/ViewToolbar';
import { matchesFilter } from './podPresentation';
import { useOpsFlowStore } from './store';

type HealthState = 'loading' | 'ok' | 'error';

export default function App() {
  const [health, setHealth] = useState<HealthState>('loading');

  const targets = useOpsFlowStore((s) => s.targets);
  const pods = useOpsFlowStore((s) => s.pods);
  const targetErrors = useOpsFlowStore((s) => s.targetErrors);
  const podsLoading = useOpsFlowStore((s) => s.podsLoading);
  const podsError = useOpsFlowStore((s) => s.podsError);
  const hasQueried = useOpsFlowStore((s) => s.hasQueried);
  const grouping = useOpsFlowStore((s) => s.grouping);
  const setGrouping = useOpsFlowStore((s) => s.setGrouping);
  const filter = useOpsFlowStore((s) => s.filter);
  const setFilter = useOpsFlowStore((s) => s.setFilter);
  const loadPods = useOpsFlowStore((s) => s.loadPods);

  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error();
        if (active) setHealth('ok');
      })
      .catch(() => {
        if (active) setHealth('error');
      });
    return () => {
      active = false;
    };
  }, []);

  const visiblePods = useMemo(() => pods.filter((p) => matchesFilter(p, filter)), [filter, pods]);

  const clusterCount = useMemo(() => new Set(pods.map((p) => p.cluster)).size, [pods]);
  const namespaceCount = useMemo(() => new Set(pods.map((p) => p.namespace)).size, [pods]);

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
        <div className={`topbar-status ${health === 'ok' ? 'status-ok' : health === 'error' ? 'status-error' : 'status-loading'}`}>
          <span className="status-dot" />
          {health === 'ok' ? 'Read-only' : health === 'error' ? 'Backend offline' : 'Conectando...'}
        </div>
      </header>

      <div className="app-body">
        <TargetSelector />

        <section className="main-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Visão unificada</span>
              <h2>Pods</h2>
            </div>
            {pods.length > 0 && (
              <div className="panel-summary">
                <span>
                  <strong>{pods.length}</strong> pods
                </span>
                <span>
                  <strong>{clusterCount}</strong> cluster(s)
                </span>
                <span>
                  <strong>{namespaceCount}</strong> namespace(s)
                </span>
              </div>
            )}
          </div>

          {pods.length > 0 && (
            <ViewToolbar
              grouping={grouping}
              onGroupingChange={setGrouping}
              filter={filter}
              onFilterChange={setFilter}
              visibleCount={visiblePods.length}
              totalCount={pods.length}
              onRefresh={() => void loadPods()}
              loading={podsLoading}
            />
          )}

          <div className="panel-content">
            {podsError && (
              <p className="panel-error" role="alert">
                <CircleAlert size={14} /> {podsError}
              </p>
            )}

            <TargetErrorBanner errors={targetErrors} />

            {pods.length > 0 && visiblePods.length > 0 && (
              <PodTable pods={visiblePods} grouping={grouping} />
            )}

            {pods.length > 0 && visiblePods.length === 0 && (
              <EmptyState
                icon={<Search size={21} />}
                title="Nenhum pod corresponde ao filtro"
                description="Ajuste ou limpe o filtro para ver os resultados."
              />
            )}

            {pods.length === 0 && !podsLoading && (
              <EmptyState
                icon={<Layers size={21} />}
                title={
                  targets.length === 0
                    ? 'Monte sua visão unificada'
                    : hasQueried
                      ? 'Nenhum pod encontrado'
                      : 'Pronto para consultar'
                }
                description={
                  targets.length === 0
                    ? 'Selecione um ou mais contexts, informe o namespace e adicione os alvos. Você pode combinar vários clusters e vários namespaces na mesma visão.'
                    : hasQueried
                      ? 'Os alvos consultados não retornaram pods. Verifique o namespace informado.'
                      : 'Clique em "Buscar pods" para consultar os alvos selecionados.'
                }
              />
            )}

            {podsLoading && pods.length === 0 && (
              <EmptyState
                icon={<Layers size={21} />}
                title="Consultando alvos..."
                description={`Buscando pods em ${targets.length} alvo(s) em paralelo.`}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
