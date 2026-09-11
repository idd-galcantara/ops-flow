import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Layers, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { hasExactNamespaceMatch } from '../namespaceSuggestions';
import { describePreset } from '../presets';
import { useOpsFlowStore } from '../store';
import { targetKey } from '../types';
import { ErrorState, LoadingState } from './Feedback';
import { NamespaceInput } from './NamespaceInput';

interface TargetSelectorProps {
  sidebarWidth: number;
  sidebarMin: number;
  sidebarMax: number;
  resizing: boolean;
  onResizeStart: (event: React.MouseEvent | React.TouchEvent) => void;
  onResizeNudge: (delta: number) => void;
}

const KEYBOARD_STEP = 24;

/**
 * Builds the list of (cluster, namespace) targets to query.
 *
 * Supports the core ops-flow use case — the same namespace across several
 * clusters — and also multiple namespaces on the same cluster, since each
 * target is an independent pair.
 */
export function TargetSelector({
  sidebarWidth,
  sidebarMin,
  sidebarMax,
  resizing,
  onResizeStart,
  onResizeNudge,
}: TargetSelectorProps) {
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
  const namespaces = useOpsFlowStore((s) => s.namespaces);
  const namespacesFor = useOpsFlowStore((s) => s.namespacesFor);
  const namespacesLoading = useOpsFlowStore((s) => s.namespacesLoading);

  const [namespace, setNamespace] = useState('');
  const [selectedNamespaces, setSelectedNamespaces] = useState<string[]>([]);
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
    setSelectedNamespaces([]);
    setNamespace('');
    setSelectedClusters((current) =>
      current.includes(name) ? current.filter((c) => c !== name) : [...current, name],
    );
  };

  const namespacesReady =
    selectedClusters.length > 0 &&
    !namespacesLoading &&
    [...selectedClusters].sort().join('|') === namespacesFor.join('|');
  const hasExactMatch =
    namespacesReady && hasExactNamespaceMatch(namespaces, namespace);
  const namespacesToAdd = [
    ...selectedNamespaces,
    ...(hasExactMatch && namespace.trim() && !selectedNamespaces.includes(namespace.trim())
      ? [namespace.trim()]
      : []),
  ];
  const canAdd =
    selectedClusters.length > 0 &&
    namespacesReady &&
    namespacesToAdd.length > 0;

  const selectNamespace = (name: string) => {
    const next = name.trim();
    if (!hasExactNamespaceMatch(namespaces, next)) return;
    setSelectedNamespaces((current) => (current.includes(next) ? current : [...current, next]));
    setNamespace('');
  };

  const removeNamespace = (name: string) => {
    setSelectedNamespaces((current) => current.filter((item) => item !== name));
  };

  /**
   * Adds one target for every selected cluster and namespace, then resets the
   * form so the next addition starts from a clean slate.
   */
  const addSelection = () => {
    if (!canAdd) return;
    selectedClusters.forEach((cluster) => {
      namespacesToAdd.forEach((ns) => addTarget({ cluster, namespace: ns }));
    });
    setSelectedClusters([]);
    setSelectedNamespaces([]);
    setNamespace('');
  };

  return (
    <aside className="sidebar">
      <div
        className={`sidebar-resize-handle ${resizing ? 'is-resizing' : ''}`}
        onMouseDown={onResizeStart}
        onTouchStart={onResizeStart}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onResizeNudge(-KEYBOARD_STEP);
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            onResizeNudge(KEYBOARD_STEP);
          }
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize targets panel"
        aria-valuemin={sidebarMin}
        aria-valuemax={sidebarMax}
        aria-valuenow={Math.round(sidebarWidth)}
        tabIndex={0}
      />
      <div className="sidebar-heading">
        <div>
          <span className="eyebrow">Targets</span>
          <h1>Clusters & namespaces</h1>
        </div>
        <button
          type="button"
          className="icon-button subtle"
          title="Reload contexts from kubeconfig"
          aria-label="Reload contexts from kubeconfig"
          onClick={() => void loadContexts()}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <label className="sidebar-search">
        <Search size={14} />
        <span className="visually-hidden">Filter contexts</span>
        <input
          value={contextFilter}
          onChange={(e) => setContextFilter(e.target.value)}
          placeholder="Filter contexts..."
          aria-label="Filter contexts"
        />
      </label>

      <div className="sidebar-section-label">
        <span>
          Contexts <b>{contexts.length}</b>
        </span>
        {selectedClusters.length > 0 && <span>{selectedClusters.length} sel.</span>}
      </div>

      {contextsError && (
        <div className="sidebar-feedback">
          <ErrorState message={contextsError} onRetry={() => void loadContexts()} />
        </div>
      )}

      {contextsLoading && (
        <div className="sidebar-feedback">
          <LoadingState message="Loading contexts..." />
        </div>
      )}

      <div className="context-list" role="group" aria-label="Available contexts">
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
          <p className="sidebar-hint">No context matches the filter.</p>
        )}
      </div>

      <div className="namespace-row">
        <NamespaceInput
          value={namespace}
          onChange={setNamespace}
          selectedClusters={selectedClusters}
          selectedNamespaces={selectedNamespaces}
          onSelectNamespace={selectNamespace}
          onRemoveNamespace={removeNamespace}
        />
        <button
          type="button"
          className="primary-button add-target-button"
          onClick={addSelection}
          disabled={!canAdd}
          title={
            canAdd
              ? 'Add one target per selected cluster and namespace'
              : 'Select at least one namespace from the suggestions'
          }
        >
          <Plus size={15} /> Add
        </button>
      </div>

      <div className="sidebar-section-label">
        <span>
          Selected targets <b>{targets.length}</b>
        </span>
        {targets.length > 0 && (
          <button type="button" className="text-button" onClick={clearTargets}>
            Clear
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
              title={`Remove ${targetKey(t)}`}
              aria-label={`Remove target ${targetKey(t)}`}
              onClick={() => removeTarget(t)}
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {targets.length === 0 && (
          <p className="sidebar-hint">
            Pick contexts, type a namespace and add them to build the unified view.
          </p>
        )}
      </div>

      <PresetSection />

      <div className="sidebar-footer">
        <button
          type="button"
          className="primary-button query-button"
          onClick={() => void loadPods()}
          disabled={targets.length === 0 || podsLoading}
        >
          {podsLoading ? (
            <>
              <RefreshCw size={15} className="spinning" /> Querying...
            </>
          ) : (
            <>
              <Layers size={15} /> Fetch pods
            </>
          )}
        </button>
        {targets.length > 1 && (
          <p className="sidebar-hint centered">
            {targets.length} targets will be queried in parallel
          </p>
        )}
      </div>
    </aside>
  );
}

/**
 * Saved target combinations, so a recurring investigation (e.g. "QA overdraft =
 * tb + gt") can be restored in one click instead of rebuilt every time.
 */
function PresetSection() {
  const presets = useOpsFlowStore((s) => s.presets);
  const targets = useOpsFlowStore((s) => s.targets);
  const savePreset = useOpsFlowStore((s) => s.savePreset);
  const applyPreset = useOpsFlowStore((s) => s.applyPreset);
  const deletePreset = useOpsFlowStore((s) => s.deletePreset);

  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const confirmSave = () => {
    if (!name.trim()) return;
    savePreset(name);
    setName('');
    setNaming(false);
  };

  return (
    <>
      <div className="sidebar-section-label">
        <span>
          Presets <b>{presets.length}</b>
        </span>
        {targets.length > 0 && !naming && (
          <button type="button" className="text-button" onClick={() => setNaming(true)}>
            Save current
          </button>
        )}
      </div>

      {naming && (
        <div className="preset-form">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmSave();
              }
              if (e.key === 'Escape') {
                setNaming(false);
                setName('');
              }
            }}
            placeholder="Preset name"
            aria-label="Preset name"
          />
          <button type="button" className="primary-button" onClick={confirmSave} disabled={!name.trim()}>
            <Save size={13} />
          </button>
          <button
            type="button"
            className="icon-button subtle"
            onClick={() => {
              setNaming(false);
              setName('');
            }}
            aria-label="Cancel"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="preset-list">
        {presets.map((preset) => (
          <div className="preset-item" key={preset.id}>
            <button
              type="button"
              className="preset-apply"
              onClick={() => applyPreset(preset.id)}
              title={preset.targets.map(targetKey).join('\n')}
            >
              <Bookmark size={12} />
              <span className="preset-text">
                <strong>{preset.name}</strong>
                <small>{describePreset(preset)}</small>
              </span>
            </button>
            <button
              type="button"
              className="icon-button subtle danger"
              onClick={() => deletePreset(preset.id)}
              title={`Remove preset ${preset.name}`}
              aria-label={`Remove preset ${preset.name}`}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {presets.length === 0 && !naming && (
          <p className="sidebar-hint">
            Save target combinations you use often.
          </p>
        )}
      </div>
    </>
  );
}
