import { Layers, RefreshCw, Rows3, Search, Server, X } from 'lucide-react';
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
}

/** Grouping switch + text filter for the unified view. */
export function ViewToolbar({
  grouping,
  onGroupingChange,
  filter,
  onFilterChange,
  visibleCount,
  totalCount,
  onRefresh,
  loading,
}: ViewToolbarProps) {
  const filtering = filter.trim().length > 0;

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
        <button
          type="button"
          className="icon-button subtle"
          onClick={onRefresh}
          disabled={loading}
          title="Atualizar"
          aria-label="Atualizar pods"
        >
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
        </button>
      </div>
    </div>
  );
}
