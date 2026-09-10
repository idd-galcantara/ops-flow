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

/** A container's resource picture inside the describe payload. */
export interface ContainerDetail {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: string;
  reason?: string;
  requests?: Record<string, string>;
  limits?: Record<string, string>;
  /** True for native sidecars (init containers with restartPolicy: Always). */
  sidecar: boolean;
}

export interface PodEvent {
  type: string;
  reason: string;
  message: string;
  count: number;
  lastSeen?: string;
}

export interface PodDescribe {
  cluster: string;
  namespace: string;
  name: string;
  status: string;
  node: string;
  podIP?: string;
  serviceAccount?: string;
  qosClass?: string;
  createdAt?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  conditions: { type: string; status: string; reason?: string; message?: string }[];
  containers: ContainerDetail[];
  events: PodEvent[];
  eventsError?: string;
}

/** `available: false` means the cluster has no metrics-server (expected case). */
export interface PodMetricsResult {
  available: boolean;
  containers?: { name: string; cpu: string; memory: string }[];
  window?: string;
  timestamp?: string;
  reason?: string;
}

/** Identifies the pod currently opened in the details panel. */
export interface PodRef {
  cluster: string;
  namespace: string;
  name: string;
  containers: string[];
}

/** A namespace and the clusters (within the current selection) that have it. */
export interface NamespaceInfo {
  name: string;
  clusters: string[];
}

/** An error for a single cluster during a namespace listing. */
export interface ClusterError {
  cluster: string;
  message: string;
}

export interface NamespacesResponse {
  namespaces: NamespaceInfo[];
  errors: ClusterError[];
}
