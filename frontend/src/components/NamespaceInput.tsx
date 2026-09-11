import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader, X } from 'lucide-react';
import {
  describeNamespaceReach,
  hasExactNamespaceMatch,
  suggestNamespaces,
} from '../namespaceSuggestions';
import { useOpsFlowStore } from '../store';

interface NamespaceInputProps {
  value: string;
  onChange: (value: string) => void;
  selectedClusters: string[];
  selectedNamespaces: string[];
  onSelectNamespace: (name: string) => void;
  onRemoveNamespace: (name: string) => void;
}

/**
 * Namespace field with autocomplete over the namespaces that actually exist in
 * the selected clusters.
 *
 * Typing the namespace by hand is error-prone: these clusters hold roughly two
 * thousand namespaces, so the list is fetched once per cluster selection,
 * filtered as you type, and capped for rendering.
 */
export function NamespaceInput({
  value,
  onChange,
  selectedClusters,
  selectedNamespaces,
  onSelectNamespace,
  onRemoveNamespace,
}: NamespaceInputProps) {
  const namespaces = useOpsFlowStore((s) => s.namespaces);
  const namespacesFor = useOpsFlowStore((s) => s.namespacesFor);
  const namespacesLoading = useOpsFlowStore((s) => s.namespacesLoading);
  const namespacesError = useOpsFlowStore((s) => s.namespacesError);
  const loadNamespaces = useOpsFlowStore((s) => s.loadNamespaces);
  const configurationRevision = useOpsFlowStore((s) => s.configurationRevision);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<number | undefined>(undefined);

  const clusterKey = selectedClusters.join('|');
  const loadedClusterKey = namespacesFor.join('|');
  const namespacesReady =
    selectedClusters.length > 0 &&
    !namespacesLoading &&
    [...selectedClusters].sort().join('|') === loadedClusterKey;

  // Fetch whenever the cluster selection changes; the store skips repeat work.
  useEffect(() => {
    void loadNamespaces(selectedClusters);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by clusterKey on purpose
  }, [clusterKey, configurationRevision, loadNamespaces]);

  const suggestions = useMemo(
    () =>
      suggestNamespaces(namespacesReady ? namespaces : [], value, selectedClusters.length).filter(
        (suggestion) => !selectedNamespaces.includes(suggestion.name),
      ),
    [namespaces, namespacesReady, selectedClusters.length, selectedNamespaces, value],
  );

  // Keep the highlighted row valid as the list shrinks while typing.
  useEffect(() => {
    setActiveIndex((current) => (current >= suggestions.length ? -1 : current));
  }, [suggestions.length]);

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  const choose = (name: string) => {
    onSelectNamespace(name);
    onChange('');
    setOpen(true);
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
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      // Enter picks the highlighted suggestion, or confirms an exact known value.
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        choose(suggestions[activeIndex].name);
      } else if (hasExactMatch) {
        choose(value.trim());
      }
    }
  };

  const showPanel = open && selectedClusters.length > 0;
  const hasExactMatch = namespacesReady && hasExactNamespaceMatch(namespaces, value);

  return (
    <div className="namespace-input">
      <label className="inspector-field">
        <span>
          Namespace
          {namespacesLoading && <Loader size={10} className="spinning inline-loader" />}
          {!namespacesLoading && namespaces.length > 0 && (
            <b className="namespace-count">{namespaces.length} available</b>
          )}
        </span>
        <div className="namespace-multi-control">
          {selectedNamespaces.length > 0 && (
            <div className="namespace-selected-list" aria-label="Selected namespaces">
              {selectedNamespaces.map((name) => (
                <span className="namespace-selected-chip" key={name}>
                  <span>{name}</span>
                  <button
                    type="button"
                    className="namespace-selected-remove"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onRemoveNamespace(name)}
                    aria-label={`Remove namespace ${name}`}
                    title={`Remove namespace ${name}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // Delay so a click on a suggestion lands before the panel closes.
              blurTimer.current = window.setTimeout(() => setOpen(false), 140);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedClusters.length === 0 ? 'select a context first' : 'e.g. bank-overdraft'
            }
            aria-label="Namespace"
            role="combobox"
            aria-expanded={showPanel}
            aria-autocomplete="list"
            aria-controls="namespace-suggestions"
          />
        </div>
      </label>

      {value.trim() && hasExactMatch && (
        <span className="namespace-valid" title="This namespace exists in the selected clusters">
          <Check size={11} /> exists
        </span>
      )}

      {namespacesError && <p className="namespace-note">{namespacesError}</p>}

      {showPanel && (
        <div className="namespace-suggestions" id="namespace-suggestions" role="listbox">
          {suggestions.map((suggestion, index) => {
            const reach = describeNamespaceReach(suggestion, selectedClusters.length);
            return (
              <button
                type="button"
                key={suggestion.name}
                role="option"
                aria-selected={index === activeIndex}
                className={`namespace-option ${index === activeIndex ? 'is-active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(suggestion.name)}
                title={suggestion.clusters.join('\n')}
              >
                <span className="namespace-option-name">{suggestion.name}</span>
                {reach && (
                  <span
                    className={`namespace-option-reach ${suggestion.inAllClusters ? 'is-all' : ''}`}
                  >
                    {reach}
                  </span>
                )}
              </button>
            );
          })}

          {suggestions.length === 0 && !namespacesLoading && (
            <p className="namespace-note">
              {namespaces.length === 0
                ? 'No namespaces loaded for the selected contexts.'
                : 'No namespace matches. Choose a namespace from the suggestions.'}
            </p>
          )}

          {namespacesLoading && <p className="namespace-note">Loading namespaces...</p>}
        </div>
      )}
    </div>
  );
}
