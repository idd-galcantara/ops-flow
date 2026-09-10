import { create } from 'zustand';
import { fetchContexts, fetchPods } from './api';
import { createPreset, loadPresets, savePresets, type Preset } from './presets';
import {
  targetKey,
  type ContextInfo,
  type GroupingMode,
  type NormalizedPod,
  type Target,
  type TargetError,
} from './types';

/** Auto-refresh intervals offered in the UI, in seconds. 0 means off. */
export const REFRESH_INTERVALS = [0, 10, 30, 60] as const;

interface OpsFlowState {
  /** Contexts available in the kubeconfig. */
  contexts: ContextInfo[];
  contextsError?: string;
  contextsLoading: boolean;

  /** The (cluster, namespace) pairs currently selected. */
  targets: Target[];

  /** Aggregated result of the last query. */
  pods: NormalizedPod[];
  targetErrors: TargetError[];
  podsLoading: boolean;
  podsError?: string;
  /** Whether a query has completed at least once (to distinguish "empty" from "not asked"). */
  hasQueried: boolean;
  /** When the last successful query completed. */
  lastUpdatedAt?: number;
  /** True while an auto-refresh is refetching, so the table isn't blanked. */
  refreshing: boolean;

  /** View controls. */
  grouping: GroupingMode;
  filter: string;
  /** Auto-refresh period in seconds; 0 disables it. */
  refreshSeconds: number;

  /** Saved target combinations. */
  presets: Preset[];

  loadContexts: () => Promise<void>;
  addTarget: (target: Target) => void;
  removeTarget: (target: Target) => void;
  clearTargets: () => void;
  loadPods: (options?: { silent?: boolean }) => Promise<void>;
  setGrouping: (grouping: GroupingMode) => void;
  setFilter: (filter: string) => void;
  setRefreshSeconds: (seconds: number) => void;
  savePreset: (name: string) => void;
  applyPreset: (id: string) => void;
  deletePreset: (id: string) => void;
}

export const useOpsFlowStore = create<OpsFlowState>((set, get) => ({
  contexts: [],
  contextsLoading: false,
  targets: [],
  pods: [],
  targetErrors: [],
  podsLoading: false,
  hasQueried: false,
  refreshing: false,
  grouping: 'namespace',
  filter: '',
  refreshSeconds: 0,
  presets: loadPresets(),

  loadContexts: async () => {
    set({ contextsLoading: true, contextsError: undefined });
    try {
      const contexts = await fetchContexts();
      set({ contexts, contextsLoading: false });
    } catch (err) {
      set({
        contextsLoading: false,
        contextsError: err instanceof Error ? err.message : 'Falha ao carregar contexts.',
      });
    }
  },

  addTarget: (target) => {
    const cluster = target.cluster.trim();
    const namespace = target.namespace.trim();
    if (!cluster || !namespace) return;
    const next = { cluster, namespace };
    const exists = get().targets.some((t) => targetKey(t) === targetKey(next));
    if (exists) return;
    set({ targets: [...get().targets, next] });
  },

  removeTarget: (target) => {
    set({ targets: get().targets.filter((t) => targetKey(t) !== targetKey(target)) });
  },

  clearTargets: () =>
    set({
      targets: [],
      pods: [],
      targetErrors: [],
      hasQueried: false,
      podsError: undefined,
      lastUpdatedAt: undefined,
    }),

  /**
   * Fetches pods for the selected targets.
   * `silent` is used by auto-refresh so the current table stays visible instead
   * of flashing a loading state on every tick.
   */
  loadPods: async ({ silent = false } = {}) => {
    const { targets } = get();
    if (targets.length === 0) return;
    set(silent ? { refreshing: true, podsError: undefined } : { podsLoading: true, podsError: undefined });
    try {
      const { pods, errors } = await fetchPods(targets);
      set({
        pods,
        targetErrors: errors,
        podsLoading: false,
        refreshing: false,
        hasQueried: true,
        lastUpdatedAt: Date.now(),
      });
    } catch (err) {
      set({
        podsLoading: false,
        refreshing: false,
        podsError: err instanceof Error ? err.message : 'Falha ao consultar pods.',
      });
    }
  },

  setGrouping: (grouping) => set({ grouping }),
  setFilter: (filter) => set({ filter }),
  setRefreshSeconds: (refreshSeconds) => set({ refreshSeconds }),

  savePreset: (name) => {
    const trimmed = name.trim();
    const { targets, presets } = get();
    if (!trimmed || targets.length === 0) return;
    const next = [...presets, createPreset(trimmed, targets)];
    savePresets(next);
    set({ presets: next });
  },

  applyPreset: (id) => {
    const preset = get().presets.find((p) => p.id === id);
    if (!preset) return;
    set({
      targets: preset.targets.map((t) => ({ ...t })),
      pods: [],
      targetErrors: [],
      hasQueried: false,
      podsError: undefined,
      lastUpdatedAt: undefined,
    });
  },

  deletePreset: (id) => {
    const next = get().presets.filter((p) => p.id !== id);
    savePresets(next);
    set({ presets: next });
  },
}));
