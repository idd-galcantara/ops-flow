import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader } from 'lucide-react';
import { describeNamespaceReach, suggestNamespaces } from '../namespaceSuggestions';
import { useOpsFlowStore } from '../store';

interface NamespaceInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when the user confirms the current value (Enter with no suggestion active). */
  onSubmit: () => void;
  selectedClusters: string[];
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
  onSubmit,
  selectedClusters,
}: NamespaceInputProps) {
  const namespaces = useOpsFlowStore((s) => s.namespaces);
  const namespacesLoading = useOpsFlowStore((s) => s.namespacesLoading);
  const namespacesError = useOpsFlowStore((s) => s.namespacesError);
  const loadNamespaces = useOpsFlowStore((s) => s.loadNamespaces);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<number | undefined>(undefined);

  const clusterKey = selectedClusters.join('|');

  // Fetch whenever the cluster selection changes; the store skips repeat work.
  useEffect(() => {
    void loadNamespaces(selectedClusters);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by clusterKey on purpose
  }, [clusterKey, loadNamespaces]);

  const suggestions = useMemo(
    () => suggestNamespaces(namespaces, value, selectedClusters.length),
    [namespaces, value, selectedClusters.length],
  );

  // Keep the highlighted row valid as the list shrinks while typing.
  useEffect(() => {
    setActiveIndex((current) => (current >= suggestions.length ? -1 : current));
  }, [suggestions.length]);

  useEffect(() => () => window.clearTimeout(blurTimer.current), []);

  const choose = (name: string) => {
    onChange(name);
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
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      // Enter picks the highlighted suggestion, or accepts what was typed.
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        choose(suggestions[activeIndex].name);
      } else {
        setOpen(false);
        onSubmit();
      }
    }
  };

  const showPanel = open && selectedClusters.length > 0;
  const hasExactMatch = namespaces.some((ns) => ns.name === value.trim());

  return (
    <div className="namespace-input">
      <label className="inspector-field">
        <span>
          Namespace
          {namespacesLoading && <Loader size={10} className="spinning inline-loader" />}
          {!namespacesLoading && namespaces.length > 0 && (
            <b className="namespace-count">{namespaces.length} disponíveis</b>
          )}
        </span>
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
            selectedClusters.length === 0 ? 'selecione um context primeiro' : 'ex.: bank-overdraft'
          }
          aria-label="Namespace"
          role="combobox"
          aria-expanded={showPanel}
          aria-autocomplete="list"
          aria-controls="namespace-suggestions"
        />
      </label>

      {value.trim() && hasExactMatch && (
        <span className="namespace-valid" title="Este namespace existe nos clusters selecionados">
          <Check size={11} /> existe
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
                ? 'Nenhum namespace carregado para os contexts selecionados.'
                : 'Nenhum namespace corresponde. Você ainda pode usar o valor digitado.'}
            </p>
          )}

          {namespacesLoading && <p className="namespace-note">Carregando namespaces...</p>}
        </div>
      )}
    </div>
  );
}
