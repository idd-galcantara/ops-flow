import { create } from 'zustand';
import { fetchContexts, fetchPods } from './api';
import { targetKey, type ContextInfo, type GroupingMode, type NormalizedPod, type Target, type TargetError } from './types';

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

  /** View controls. */
  grouping: GroupingMode;
  filter: string;

  loadContexts: () => Promise<void>;
  addTarget: (target: Target) => void;
  removeTarget: (target: Target) => void;
  clearTargets: () => void;
  loadPods: () => Promise<void>;
  setGrouping: (grouping: GroupingMode) => void;
  setFilter: (filter: string) => void;
}

export const useOpsFlowStore = create<OpsFlowState>((set, get) => ({
  contexts: [],
  contextsLoading: false,
  targets: [],
  pods: [],
  targetErrors: [],
  podsLoading: false,
  hasQueried: false,
  grouping: 'namespace',
  filter: '',

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

  clearTargets: () => set({ targets: [], pods: [], targetErrors: [], hasQueried: false }),

  loadPods: async () => {
    const { targets } = get();
    if (targets.length === 0) return;
    set({ podsLoading: true, podsError: undefined });
    try {
      const { pods, errors } = await fetchPods(targets);
      set({ pods, targetErrors: errors, podsLoading: false, hasQueried: true });
    } catch (err) {
      set({
        podsLoading: false,
        podsError: err instanceof Error ? err.message : 'Falha ao consultar pods.',
      });
    }
  },

  setGrouping: (grouping) => set({ grouping }),
  setFilter: (filter) => set({ filter }),
}));
