import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { hasExactNamespaceMatch } from '../namespaceSuggestions';
import { suggestNamespaces } from '../namespaceSuggestions';
import { describePreset } from '../presets';
import { useOpsFlowStore } from '../store';
import { targetKey, type NamespaceInfo } from '../types';
import { ErrorState, LoadingState } from './Feedback';
import { NamespaceInput } from './NamespaceInput';
import { KubeconfigSetup } from './KubeconfigSetup';

interface TargetSelectorProps {
  sidebarWidth: number;
  sidebarMin: number;
  sidebarMax: number;
  resizing: boolean;
  onResizeStart: (event: React.MouseEvent | React.TouchEvent) => void;
  onResizeNudge: (delta: number) => void;
}

const KEYBOARD_STEP = 24;
const PRESET_COLLAPSE_THRESHOLD = 6;

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
  const loadKubeconfigStatus = useOpsFlowStore((s) => s.loadKubeconfigStatus);
  const configurationRevision = useOpsFlowStore((s) => s.configurationRevision);
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

  useEffect(() => {
    void loadKubeconfigStatus();
  }, [loadKubeconfigStatus]);

  useEffect(() => {
    setSelectedClusters([]);
    setSelectedNamespaces([]);
    setNamespace('');
    setContextFilter('');
  }, [configurationRevision]);

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

      <KubeconfigSetup />

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
  const contexts = useOpsFlowStore((s) => s.contexts);
  const savePreset = useOpsFlowStore((s) => s.savePreset);
  const updatePreset = useOpsFlowStore((s) => s.updatePreset);
  const applyPreset = useOpsFlowStore((s) => s.applyPreset);
  const deletePreset = useOpsFlowStore((s) => s.deletePreset);

  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [expanded, setExpanded] = useState(() => presets.length <= PRESET_COLLAPSE_THRESHOLD);
  const [presetQuery, setPresetQuery] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const contextNames = useMemo(() => contexts.map((context) => context.name), [contexts]);

  const visiblePresets = useMemo(() => {
    const needle = presetQuery.trim().toLowerCase();
    if (!needle) return presets;

    return presets.filter((preset) => {
      const searchableText = [
        preset.name,
        describePreset(preset),
        ...preset.targets.flatMap((target) => [target.cluster, target.namespace]),
      ]
        .join(' ')
        .toLowerCase();
      return searchableText.includes(needle);
    });
  }, [presetQuery, presets]);

  const confirmSave = () => {
    if (!name.trim()) return;
    savePreset(name);
    setName('');
    setNaming(false);
  };

  const cancelSave = () => {
    setNaming(false);
    setName('');
  };

  return (
    <section className="preset-section" aria-label="Presets">
      <div className="sidebar-section-label preset-section-header">
        <button
          type="button"
          className="preset-toggle"
          aria-expanded={expanded}
          aria-controls="preset-panel"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span>
            Presets <b>{presets.length}</b>
          </span>
        </button>
        {targets.length > 0 && !naming && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setNaming(true);
              setExpanded(true);
            }}
          >
            Save current
          </button>
        )}
      </div>

      {expanded && (
        <div id="preset-panel" className="preset-panel">
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
                      cancelSave();
                  }
                }}
                placeholder="Preset name"
                aria-label="Preset name"
              />
              <button
                type="button"
                className="primary-button"
                onClick={confirmSave}
                disabled={!name.trim()}
                aria-label="Save preset"
                title="Save preset"
              >
                <Save size={13} />
              </button>
              <button
                type="button"
                className="icon-button subtle"
                onClick={() => {
                  cancelSave();
                }}
                aria-label="Cancel"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {presets.length > 0 && (
            <div className="preset-search">
              <Search size={13} />
              <label className="visually-hidden" htmlFor="preset-search-input">
                Search presets
              </label>
              <input
                id="preset-search-input"
                value={presetQuery}
                onChange={(e) => setPresetQuery(e.target.value)}
                placeholder="Search presets..."
              />
              {presetQuery && (
                <button
                  type="button"
                  className="preset-search-clear"
                  onClick={() => setPresetQuery('')}
                  aria-label="Clear preset search"
                  title="Clear preset search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          <div className="preset-list" role="group" aria-label="Saved presets">
            {visiblePresets.map((preset) => (
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
                  className="icon-button subtle"
                  onClick={() => setEditingPresetId(preset.id)}
                  title={`View and edit ${preset.name}`}
                  aria-label={`View and edit preset ${preset.name}`}
                >
                  <Pencil size={12} />
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
              <p className="sidebar-hint">Save target combinations you use often.</p>
            )}
            {presets.length > 0 && visiblePresets.length === 0 && (
              <p className="sidebar-hint preset-empty">No preset matches the search.</p>
            )}
          </div>
        </div>
      )}
      {editingPresetId && (
        <PresetEditor
          preset={presets.find((preset) => preset.id === editingPresetId) ?? null}
          contexts={contextNames}
          onClose={() => setEditingPresetId(null)}
          onSave={(preset) => {
            updatePreset(preset.id, preset.name, preset.description ?? '', preset.targets);
            setEditingPresetId(null);
          }}
        />
      )}
    </section>
  );
}

interface EditablePreset {
  id: string;
  name: string;
  description?: string;
  targets: { cluster: string; namespace: string }[];
}

interface PresetEditorProps {
  preset: EditablePreset | null;
  contexts: string[];
  onClose: () => void;
  onSave: (preset: EditablePreset) => void;
}

function PresetEditor({ preset, contexts, onClose, onSave }: PresetEditorProps) {
  const namespaces = useOpsFlowStore((s) => s.namespaces);
  const namespacesLoading = useOpsFlowStore((s) => s.namespacesLoading);
  const loadNamespaces = useOpsFlowStore((s) => s.loadNamespaces);
  const [name, setName] = useState(preset?.name ?? '');
  const [description, setDescription] = useState(preset?.description ?? '');
  const [targets, setTargets] = useState(() => preset?.targets.map((target) => ({ ...target })) ?? []);
  const [newCluster, setNewCluster] = useState(contexts[0] ?? '');
  const [newNamespace, setNewNamespace] = useState('');

  const clusterOptions = useMemo(
    () => [...new Set([...contexts, ...targets.map((target) => target.cluster)])],
    [contexts, targets],
  );
  const clusterKey = clusterOptions.join('|');

  useEffect(() => {
    void loadNamespaces(clusterOptions);
  }, [clusterKey, loadNamespaces]);

  useEffect(() => {
    if (!preset) return;
    setName(preset.name);
    setDescription(preset.description ?? '');
    setTargets(preset.targets.map((target) => ({ ...target })));
    setNewCluster(contexts[0] ?? preset.targets[0]?.cluster ?? '');
  }, [contexts, preset]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!preset) return null;

  const namespacesForCluster = (cluster: string) =>
    namespaces.filter((namespace) => namespace.clusters.includes(cluster));
  const isValidNamespace = (cluster: string, namespace: string) =>
    namespacesForCluster(cluster).some((item) => item.name === namespace.trim());
  const canAddTarget =
    newCluster.trim() !== '' && isValidNamespace(newCluster, newNamespace);
  const canSave = name.trim() !== '' && targets.length > 0 && targets.every(
    (target) => target.cluster.trim() !== '' && isValidNamespace(target.cluster, target.namespace),
  );

  const updateTarget = (index: number, field: 'cluster' | 'namespace', value: string) => {
    setTargets((current) =>
      current.map((target, targetIndex) =>
        targetIndex === index ? { ...target, [field]: value } : target,
      ),
    );
  };

  const addTarget = () => {
    if (!canAddTarget) return;
    const next = { cluster: newCluster.trim(), namespace: newNamespace.trim() };
    if (targets.some((target) => targetKey(target) === targetKey(next))) return;
    setTargets((current) => [...current, next]);
    setNewNamespace('');
  };

  return (
    <div className="preset-editor-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="preset-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-editor-title"
      >
        <div className="preset-editor-header">
          <div>
            <span className="eyebrow">Preset details</span>
            <h2 id="preset-editor-title">Edit preset</h2>
          </div>
          <button type="button" className="icon-button subtle" onClick={onClose} aria-label="Close preset editor">
            <X size={15} />
          </button>
        </div>

        <div className="preset-editor-fields">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </label>
          <label>
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this preset used for?"
              rows={2}
            />
          </label>
        </div>

        <div className="preset-editor-section-label">
          <span>Targets <b>{targets.length}</b></span>
          <span className="preset-editor-hint">cluster + namespace</span>
        </div>

        <div className="preset-target-editor-list">
          {targets.map((target, index) => (
            <div className="preset-target-editor-row" key={`${targetKey(target)}-${index}`}>
              <select
                value={target.cluster}
                onChange={(event) => updateTarget(index, 'cluster', event.target.value)}
                aria-label={`Cluster for target ${index + 1}`}
              >
                {!clusterOptions.includes(target.cluster) && <option value={target.cluster}>{target.cluster}</option>}
                {clusterOptions.map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}
              </select>
              <PresetNamespaceInput
                value={target.namespace}
                namespaces={namespacesForCluster(target.cluster)}
                loading={namespacesLoading}
                onChange={(value) => updateTarget(index, 'namespace', value)}
                ariaLabel={`Namespace for target ${index + 1}`}
              />
              <button
                type="button"
                className="icon-button subtle danger"
                onClick={() => setTargets((current) => current.filter((_, targetIndex) => targetIndex !== index))}
                aria-label={`Remove target ${targetKey(target)}`}
                title="Remove target"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="preset-target-add-row">
          <select value={newCluster} onChange={(event) => setNewCluster(event.target.value)} aria-label="New target cluster">
            <option value="">Cluster</option>
            {clusterOptions.map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}
          </select>
          <PresetNamespaceInput
            value={newNamespace}
            namespaces={namespacesForCluster(newCluster)}
            loading={namespacesLoading}
            onChange={setNewNamespace}
            ariaLabel="New target namespace"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addTarget();
              }
            }}
          />
          <button type="button" className="secondary-button" onClick={addTarget} disabled={!canAddTarget}>
            <Plus size={13} /> Add
          </button>
        </div>

        <div className="preset-editor-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="primary-button"
            onClick={() => onSave({ id: preset.id, name, description, targets })}
            disabled={!canSave}
          >
            <Save size={13} /> Save changes
          </button>
        </div>
      </section>
    </div>
  );
}

interface PresetNamespaceInputProps {
  value: string;
  namespaces: NamespaceInfo[];
  loading: boolean;
  onChange: (value: string) => void;
  ariaLabel: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

function PresetNamespaceInput({
  value,
  namespaces,
  loading,
  onChange,
  ariaLabel,
  onKeyDown,
}: PresetNamespaceInputProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<number | undefined>(undefined);
  const suggestions = useMemo(() => suggestNamespaces(namespaces, value, 1, 12), [namespaces, value]);
  const exactMatch = namespaces.some((namespace) => namespace.name === value.trim());

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  const choose = (namespace: string) => {
    onChange(namespace);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, -1));
      return;
    }
    if (event.key === 'Enter' && open && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault();
      choose(suggestions[activeIndex].name);
      return;
    }
    onKeyDown?.(event);
  };

  return (
    <div className="preset-namespace-input">
      <div className="preset-namespace-field">
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 140);
          }}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Loading...' : 'Namespace'}
          aria-label={ariaLabel}
          aria-invalid={value.trim() !== '' && !exactMatch}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {exactMatch && <Check size={12} className="preset-namespace-valid" aria-label="Valid namespace" />}
      </div>
      {open && (
        <div className="preset-namespace-suggestions" role="listbox">
          {suggestions.map((suggestion, index) => (
            <button
              type="button"
              key={suggestion.name}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? 'is-active' : ''}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(suggestion.name)}
            >
              {suggestion.name}
            </button>
          ))}
          {suggestions.length === 0 && !loading && (
            <span className="preset-namespace-no-match">No valid namespace</span>
          )}
        </div>
      )}
    </div>
  );
}
