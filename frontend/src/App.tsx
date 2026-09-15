import { useEffect, useMemo, useState } from 'react';
import { Layers, Moon, Search, Sun, Workflow } from 'lucide-react';
import { EmptyState, ErrorState } from './components/Feedback';
import { PodDetailsPanel } from './components/PodDetailsPanel';
import { PodTable, podRowKey } from './components/PodTable';
import { TargetErrorBanner } from './components/TargetErrorBanner';
import { TargetSelector } from './components/TargetSelector';
import { ViewToolbar } from './components/ViewToolbar';
import { matchesFilter } from './podPresentation';
import { useOpsFlowStore } from './store';
import { useResizablePanel } from './useResizablePanel';
import type { NormalizedPod, PodRef } from './types';

type HealthState = 'loading' | 'ok' | 'error';

const DETAILS_MIN = 320;
const DETAILS_MAX = 900;
const DETAILS_DEFAULT = 420;
const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 520;
const SIDEBAR_DEFAULT = 292;
const THEME_STORAGE_KEY = 'ops-flow.theme.v1';

type Theme = 'light' | 'dark';

function readStoredTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export default function App() {
  const [health, setHealth] = useState<HealthState>('loading');
  const [selected, setSelected] = useState<PodRef | null>(null);
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable in restricted browser profiles.
    }
  }, [theme]);

  const sidebar = useResizablePanel({
    storageKey: 'ops-flow.sidebarWidth.v1',
    defaultWidth: SIDEBAR_DEFAULT,
    min: SIDEBAR_MIN,
    max: SIDEBAR_MAX,
    direction: 'left',
  });

  const details = useResizablePanel({
    storageKey: 'ops-flow.detailsWidth.v1',
    defaultWidth: DETAILS_DEFAULT,
    min: DETAILS_MIN,
    max: DETAILS_MAX,
  });

  const openPod = (pod: NormalizedPod) => {
    setSelected({
      cluster: pod.cluster,
      namespace: pod.namespace,
      name: pod.name,
      containers: pod.containers,
    });
  };

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
  const refreshing = useOpsFlowStore((s) => s.refreshing);
  const refreshSeconds = useOpsFlowStore((s) => s.refreshSeconds);
  const setRefreshSeconds = useOpsFlowStore((s) => s.setRefreshSeconds);
  const lastUpdatedAt = useOpsFlowStore((s) => s.lastUpdatedAt);
  const hydratePresets = useOpsFlowStore((s) => s.hydratePresets);

  useEffect(() => {
    void hydratePresets();
  }, [hydratePresets]);

  // Auto-refresh: silent so the table keeps its content between ticks. Only runs
  // while there are targets, and is torn down on interval change or unmount.
  useEffect(() => {
    if (refreshSeconds <= 0 || targets.length === 0) return;
    const timer = setInterval(() => {
      void loadPods({ silent: true });
    }, refreshSeconds * 1000);
    return () => clearInterval(timer);
  }, [refreshSeconds, targets.length, loadPods]);

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
    <div className="app-shell" data-theme={theme}>
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
        <div className="topbar-actions">
          <button
            type="button"
            className={`theme-toggle ${theme === 'dark' ? 'is-dark' : ''}`}
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={theme === 'dark'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="theme-toggle-icon" aria-hidden="true">
              {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
            </span>
            <span className="theme-toggle-track" aria-hidden="true">
              <span className="theme-toggle-thumb" />
            </span>
          </button>
          <div
            className={`topbar-status ${
              health === 'ok' ? 'status-ok' : health === 'error' ? 'status-error' : 'status-loading'
            }`}
          >
            <span className="status-dot" />
            {health === 'ok' ? 'Read-only' : health === 'error' ? 'Backend offline' : 'Connecting...'}
          </div>
        </div>
      </header>

      <div
        className={`app-body ${selected ? 'has-details' : ''}`}
        /*
         * The width travels as a custom property rather than an inline
         * grid-template-columns: inline styles outrank media queries, which would
         * keep the three-column layout on narrow screens where it must collapse.
         */
        style={{
          ['--sidebar-width' as string]: `${sidebar.width}px`,
          ['--details-width' as string]: `${details.width}px`,
        }}
      >
        <TargetSelector
          sidebarWidth={sidebar.width}
          sidebarMin={SIDEBAR_MIN}
          sidebarMax={SIDEBAR_MAX}
          resizing={sidebar.resizing}
          onResizeStart={sidebar.startResize}
          onResizeNudge={sidebar.nudge}
        />

        <section className="main-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Unified view</span>
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
              refreshing={refreshing}
              refreshSeconds={refreshSeconds}
              onRefreshSecondsChange={setRefreshSeconds}
              lastUpdatedAt={lastUpdatedAt}
            />
          )}

          <div className="panel-content">
            {podsError && <ErrorState message={podsError} onRetry={() => void loadPods()} />}

            <TargetErrorBanner errors={targetErrors} />

            {pods.length > 0 && visiblePods.length > 0 && (
              <PodTable
                pods={visiblePods}
                grouping={grouping}
                selectedPod={selected ? podRowKey(selected) : undefined}
                onSelectPod={openPod}
              />
            )}

            {pods.length > 0 && visiblePods.length === 0 && (
              <EmptyState
                icon={<Search size={21} />}
                title="No pod matches the filter"
                description="Adjust or clear the filter to see results."
              />
            )}

            {pods.length === 0 && !podsLoading && (
              <EmptyState
                icon={<Layers size={21} />}
                title={
                  targets.length === 0
                    ? 'Build your unified view'
                    : hasQueried
                      ? 'No pods found'
                      : 'Ready to query'
                }
                description={
                  targets.length === 0
                    ? 'Pick one or more contexts, type a namespace and add the targets. You can combine several clusters and several namespaces in the same view.'
                    : hasQueried
                      ? 'The queried targets returned no pods. Check the namespace you entered.'
                      : 'Click "Fetch pods" to query the selected targets.'
                }
              />
            )}

            {podsLoading && pods.length === 0 && (
              <EmptyState
                icon={<Layers size={21} />}
                title="Querying targets..."
                description={`Fetching pods from ${targets.length} target(s) in parallel.`}
              />
            )}
          </div>
        </section>

        {selected && (
          <PodDetailsPanel
            pod={selected}
            onClose={() => setSelected(null)}
            resizing={details.resizing}
            onResizeStart={details.startResize}
            onResizeNudge={details.nudge}
          />
        )}
      </div>
    </div>
  );
}
