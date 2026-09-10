/** Contract shared with the backend (see backend/src/kube/types.ts). */

/** A context available in the user's kubeconfig. */
export interface ContextInfo {
  name: string;
  cluster: string;
  namespace?: string;
}

/** A query target: one (cluster, namespace) pair. */
export interface Target {
  cluster: string;
  namespace: string;
}

/** A pod normalized for the unified view, annotated with its origin. */
export interface NormalizedPod {
  cluster: string;
  namespace: string;
  name: string;
  status: string;
  ready: string;
  restarts: number;
  node: string;
  ageSeconds: number;
  containers: string[];
}

/** An error for a single target that failed during fan-out. */
export interface TargetError {
  target: Target;
  message: string;
}

/** Aggregated pods response. */
export interface PodsResponse {
  pods: NormalizedPod[];
  errors: TargetError[];
}

/** How the unified table groups its rows. */
export type GroupingMode = 'namespace' | 'cluster' | 'flat';

/** Stable key for a target, used for dedupe and React keys. */
export function targetKey(target: Target): string {
  return `${target.cluster}/${target.namespace}`;
}
