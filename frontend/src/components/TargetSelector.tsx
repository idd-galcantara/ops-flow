import { useEffect, useMemo, useState } from 'react';
import { Layers, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useOpsFlowStore } from '../store';
import { targetKey } from '../types';

/**
 * Builds the list of (cluster, namespace) targets to query.
 *
 * Supports the core ops-flow use case — the same namespace across several
 * clusters — and also multiple namespaces on the same cluster, since each
 * target is an independent pair.
 */
export function TargetSelector() {
  const contexts = useOpsFlowStore((s) => s.contexts);
  const contextsLoading = useOpsFlowStore((s) => s.contextsLoading);
  const contextsError = useOpsFlowStore((s) => s.contextsError);
  const loadContexts = useOpsFlowStore((s) => s.loadContexts);
  const targets = useOpsFlowStore((s) => s.targets);
  const addTarget = useOpsFlowStore((s) => s.addTarget);
  const removeTarget = useOpsFlowStore((s) => s.removeTarget);
  const clearTargets = useOpsFlowStore((s) => s.clearTargets);
  const loadPods = useOpsFlowStore((s) => s.loadPods);
  const podsLoading = useOpsFlowStore((s) => s.podsLoading);

  const [namespace, setNamespace] = useState('');
  const [selectedClusters, setSelectedClusters] = useState<string[]>([]);
  const [contextFilter, setContextFilter] = useState('');

  useEffect(() => {
    void loadContexts();
  }, [loadContexts]);

  const visibleContexts = useMemo(() => {
    const needle = contextFilter.trim().toLowerCase();
    if (!needle) return contexts;
    return contexts.filter((c) => c.name.toLowerCase().includes(needle));
  }, [contextFilter, contexts]);

  const toggleCluster = (name: string) => {
    setSelectedClusters((current) =>
      current.includes(name) ? current.filter((c) => c !== name) : [...current, name],
    );
  };

  const canAdd = selectedClusters.length > 0 && namespace.trim().length > 0;

  /** Adds one target per selected cluster, all sharing the typed namespace. */
  const addSelection = () => {
    if (!canAdd) return;
    const ns = namespace.trim();
    selectedClusters.forEach((cluster) => addTarget({ cluster, namespace: ns }));
    // Keep the cluster selection so another namespace can be added quickly.
    setNamespace('');
  };

  const submitOnEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSelection();
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">Alvos</span>
          <h1>Clusters & namespaces</h1>
        </div>
        <button
          type="button"
          className="icon-button subtle"
          title="Recarregar contexts do kubeconfig"
          aria-label="Recarregar contexts do kubeconfig"
          onClick={() => void loadContexts()}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <label className="sidebar-search">
        <Search size={14} />
        <span className="visually-hidden">Filtrar contexts</span>
        <input
          value={contextFilter}
          onChange={(e) => setContextFilter(e.target.value)}
          placeholder="Filtrar contexts..."
          aria-label="Filtrar contexts"
        />
      </label>

      <div className="sidebar-section-label">
        <span>
          Contexts <b>{contexts.length}</b>
        </span>
        {selectedClusters.length > 0 && <span>{selectedClusters.length} sel.</span>}
      </div>

      {contextsError && (
        <p className="sidebar-error" role="alert">
          {contextsError}
        </p>
      )}

      {contextsLoading && <p className="sidebar-hint">Carregando contexts...</p>}

      <div className="context-list" role="group" aria-label="Contexts disponíveis">
        {visibleContexts.map((ctx) => {
          const active = selectedClusters.includes(ctx.name);
          return (
            <button
              type="button"
              key={ctx.name}
              className={`context-item ${active ? 'is-active' : ''}`}
              onClick={() => toggleCluster(ctx.name)}
              aria-pressed={active}
            >
              <span className="context-check" aria-hidden="true">
                {active ? <Layers size={12} /> : null}
              </span>
              <span className="context-name">{ctx.name}</span>
            </button>
          );
        })}
        {!contextsLoading && visibleContexts.length === 0 && (
          <p className="sidebar-hint">Nenhum context corresponde ao filtro.</p>
        )}
      </div>

      <div className="namespace-row">
        <label className="inspector-field">
          <span>Namespace</span>
          <input
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            onKeyDown={submitOnEnter}
            placeholder="ex.: bank-overdraft"
            aria-label="Namespace"
          />
        </label>
        <button
          type="button"
          className="primary-button add-target-button"
          onClick={addSelection}
          disabled={!canAdd}
          title={
            canAdd
              ? 'Adicionar um alvo por cluster selecionado'
              : 'Selecione ao menos um context e informe o namespace'
          }
        >
          <Plus size={15} /> Adicionar
        </button>
      </div>

      <div className="sidebar-section-label">
        <span>
          Alvos selecionados <b>{targets.length}</b>
        </span>
        {targets.length > 0 && (
          <button type="button" className="text-button" onClick={clearTargets}>
            Limpar
          </button>
        )}
      </div>

      <div className="target-list">
        {targets.map((t) => (
          <div className="target-chip" key={targetKey(t)}>
            <span className="target-chip-text">
              <strong>{t.cluster}</strong>
              <small>{t.namespace}</small>
            </span>
            <button
              type="button"
              className="icon-button subtle danger"
              title={`Remover ${targetKey(t)}`}
              aria-label={`Remover alvo ${targetKey(t)}`}
              onClick={() => removeTarget(t)}
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {targets.length === 0 && (
          <p className="sidebar-hint">
            Selecione contexts, informe um namespace e adicione para montar a visão unificada.
          </p>
        )}
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="primary-button query-button"
          onClick={() => void loadPods()}
          disabled={targets.length === 0 || podsLoading}
        >
          {podsLoading ? (
            <>
              <RefreshCw size={15} className="spinning" /> Consultando...
            </>
          ) : (
            <>
              <Layers size={15} /> Buscar pods
            </>
          )}
        </button>
        {targets.length > 1 && (
          <p className="sidebar-hint centered">
            {targets.length} alvos serão consultados em paralelo
          </p>
        )}
      </div>
    </aside>
  );
}
