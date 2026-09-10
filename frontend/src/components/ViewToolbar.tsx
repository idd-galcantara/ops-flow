import { useEffect, useState } from 'react';
import { Layers, RefreshCw, Rows3, Search, Server, X } from 'lucide-react';
import { REFRESH_INTERVALS } from '../store';
import type { GroupingMode } from '../types';

const GROUPING_OPTIONS: { mode: GroupingMode; label: string; icon: React.ReactNode; hint: string }[] = [
  {
    mode: 'namespace',
    label: 'Namespace',
    icon: <Layers size={13} />,
    hint: 'Agrupa por namespace, comparando clusters lado a lado',
  },
  {
    mode: 'cluster',
    label: 'Cluster',
    icon: <Server size={13} />,
    hint: 'Agrupa por cluster',
  },
  { mode: 'flat', label: 'Flat', icon: <Rows3 size={13} />, hint: 'Lista única, sem agrupamento' },
];

interface ViewToolbarProps {
  grouping: GroupingMode;
  onGroupingChange: (grouping: GroupingMode) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  visibleCount: number;
  totalCount: number;
  onRefresh: () => void;
  loading: boolean;
  /** True during a silent auto-refresh (table stays visible). */
  refreshing: boolean;
  refreshSeconds: number;
  onRefreshSecondsChange: (seconds: number) => void;
  lastUpdatedAt?: number;
}

/** Grouping switch, text filter and refresh controls for the unified view. */
export function ViewToolbar({
  grouping,
  onGroupingChange,
  filter,
  onFilterChange,
  visibleCount,
  totalCount,
  onRefresh,
  loading,
  refreshing,
  refreshSeconds,
  onRefreshSecondsChange,
  lastUpdatedAt,
}: ViewToolbarProps) {
  const filtering = filter.trim().length > 0;
  // The "last updated" label is relative, so it needs its own tick to stay honest.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!lastUpdatedAt) return;
    const timer = setInterval(() => forceTick((n) => n + 1), 10_000);
    return () => clearInterval(timer);
  }, [lastUpdatedAt]);

  return (
    <div className="view-toolbar">
      <div className="grouping-control" role="group" aria-label="Agrupamento da visão">
        <span className="toolbar-label">Agrupar por</span>
        {GROUPING_OPTIONS.map((option) => (
          <button
            type="button"
            key={option.mode}
            className={grouping === option.mode ? 'active' : ''}
            onClick={() => onGroupingChange(option.mode)}
            aria-pressed={grouping === option.mode}
            title={option.hint}
          >
            {option.icon} {option.label}
          </button>
        ))}
      </div>

      <label className="filter-bar">
        <Search size={14} />
        <span className="visually-hidden">Filtrar pods</span>
        <input
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filtrar por pod, status, node, container..."
          aria-label="Filtrar pods"
        />
        {filtering && (
          <button
            type="button"
            className="filter-clear"
            onClick={() => onFilterChange('')}
            title="Limpar filtro"
            aria-label="Limpar filtro"
          >
            <X size={12} />
          </button>
        )}
      </label>

      <div className="toolbar-meta">
        <span aria-live="polite">
          {filtering ? `${visibleCount} de ${totalCount}` : `${totalCount}`} pods
        </span>

        <label className="refresh-control">
          <span className="visually-hidden">Atualização automática</span>
          <select
            value={refreshSeconds}
            onChange={(e) => onRefreshSecondsChange(Number(e.target.value))}
            aria-label="Intervalo de atualização automática"
            title="Atualização automática"
          >
            {REFRESH_INTERVALS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds === 0 ? 'manual' : `${seconds}s`}
              </option>
            ))}
          </select>
        </label>

        {lastUpdatedAt && <span className="last-updated">{formatRelative(lastUpdatedAt)}</span>}

        <button
          type="button"
          className="icon-button subtle"
          onClick={onRefresh}
          disabled={loading}
          title="Atualizar agora"
          aria-label="Atualizar pods"
        >
          <RefreshCw size={14} className={loading || refreshing ? 'spinning' : ''} />
        </button>
      </div>
    </div>
  );
}

/** "agora", "há 12s", "há 3min" — keeps the freshness of the data visible. */
function formatRelative(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 5) return 'agora';
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  return `há ${Math.round(minutes / 60)}h`;
}
