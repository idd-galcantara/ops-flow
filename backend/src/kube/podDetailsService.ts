import type { CoreV1Event, V1Pod } from '@kubernetes/client-node';
import { coreClientForContext, metricsForContext } from './kubeconfig.js';
import { safeErrorMessage } from './podsService.js';

/** A single container's resource picture, mirroring `kubectl describe`. */
export interface ContainerDetail {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  /** Current state keyword: running | waiting | terminated. */
  state: string;
  /** Reason attached to the state, when the cluster provides one. */
  reason?: string;
  requests?: Record<string, string>;
  limits?: Record<string, string>;
  /** True for native sidecars (init containers with restartPolicy: Always). */
  sidecar: boolean;
}

/** Normalized event, ordered newest first. */
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
  /** Set when events could not be read; the rest of the describe still returns. */
  eventsError?: string;
}

/** Per-container usage. `available: false` means the cluster has no metrics-server. */
export interface PodMetricsResult {
  available: boolean;
  /** Present only when available. */
  containers?: { name: string; cpu: string; memory: string }[];
  window?: string;
  timestamp?: string;
  /** Human-readable explanation when unavailable. */
  reason?: string;
}

/** Native sidecars are init containers that keep running (restartPolicy: Always). */
function sidecarNames(pod: V1Pod): Set<string> {
  return new Set(
    (pod.spec?.initContainers ?? [])
      .filter((c) => c.restartPolicy === 'Always')
      .map((c) => c.name),
  );
}

function describeState(status?: {
  state?: { running?: unknown; waiting?: { reason?: string }; terminated?: { reason?: string } };
}): { state: string; reason?: string } {
  if (status?.state?.waiting) return { state: 'waiting', reason: status.state.waiting.reason };
  if (status?.state?.terminated) {
    return { state: 'terminated', reason: status.state.terminated.reason };
  }
  if (status?.state?.running) return { state: 'running' };
  return { state: 'unknown' };
}

/** Builds the container list, including native sidecars, with requests/limits. */
function buildContainers(pod: V1Pod): ContainerDetail[] {
  const sidecars = sidecarNames(pod);
  const statusByName = new Map(
    [...(pod.status?.initContainerStatuses ?? []), ...(pod.status?.containerStatuses ?? [])].map(
      (cs) => [cs.name, cs],
    ),
  );

  const specs = [
    ...(pod.spec?.containers ?? []),
    ...(pod.spec?.initContainers ?? []).filter((c) => sidecars.has(c.name)),
  ];

  return specs.map((spec) => {
    const status = statusByName.get(spec.name);
    const { state, reason } = describeState(status);
    return {
      name: spec.name,
      image: spec.image ?? '',
      ready: status?.ready ?? false,
      restartCount: status?.restartCount ?? 0,
      state,
      reason,
      requests: spec.resources?.requests as Record<string, string> | undefined,
      limits: spec.resources?.limits as Record<string, string> | undefined,
      sidecar: sidecars.has(spec.name),
    };
  });
}

function buildEvents(events: CoreV1Event[]): PodEvent[] {
  return events
    .map((e) => ({
      type: e.type ?? '',
      reason: e.reason ?? '',
      message: e.message ?? '',
      count: e.count ?? 1,
      lastSeen: (e.lastTimestamp ?? e.eventTime ?? e.firstTimestamp)?.toString(),
    }))
    .sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));
}

/**
 * Reads a pod and its events, producing a describe-equivalent payload.
 * Read-only: uses only `read`/`list` operations.
 */
export async function getPodDescribe(
  cluster: string,
  namespace: string,
  podName: string,
): Promise<PodDescribe> {
  const client = coreClientForContext(cluster);
  const pod = await client.readNamespacedPod({ name: podName, namespace });

  let events: PodEvent[] = [];
  let eventsError: string | undefined;
  try {
    // Events live in the namespace and are filtered to this pod.
    const eventList = await client.listNamespacedEvent({
      namespace,
      fieldSelector: `involvedObject.name=${podName}`,
    });
    events = buildEvents(eventList.items ?? []);
  } catch (err) {
    // Missing permission on events must not hide the rest of the describe.
    eventsError = safeErrorMessage(err);
  }

  return {
    cluster,
    namespace,
    name: pod.metadata?.name ?? podName,
    status: pod.status?.phase ?? 'Unknown',
    node: pod.spec?.nodeName ?? '',
    podIP: pod.status?.podIP,
    serviceAccount: pod.spec?.serviceAccountName,
    qosClass: pod.status?.qosClass,
    createdAt: pod.metadata?.creationTimestamp?.toString(),
    labels: pod.metadata?.labels ?? {},
    annotations: pod.metadata?.annotations ?? {},
    conditions: (pod.status?.conditions ?? []).map((c) => ({
      type: c.type,
      status: c.status,
      reason: c.reason,
      message: c.message,
    })),
    containers: buildContainers(pod),
    events,
    eventsError,
  };
}

/**
 * Recognizes "the metrics API simply isn't installed here" from a real failure.
 * Exported so the degradation path can be unit-tested without a cluster that
 * lacks metrics-server.
 */
export function looksLikeMissingMetricsServer(err: unknown): boolean {
  const status = (err as { statusCode?: number; code?: number })?.statusCode
    ?? (err as { code?: number })?.code;
  if (status === 404 || status === 503) return true;
  const message = safeErrorMessage(err).toLowerCase();
  return (
    message.includes('metrics.k8s.io') ||
    message.includes('not found') ||
    message.includes('could not find the requested resource') ||
    message.includes('serviceunavailable')
  );
}

/**
 * Reads CPU/memory for a pod from metrics.k8s.io.
 *
 * Clusters without metrics-server are a normal, expected case: they return
 * `{ available: false }` with a reason instead of an error, so the details panel
 * degrades gracefully rather than breaking.
 */
export async function getPodMetrics(
  cluster: string,
  namespace: string,
  podName: string,
): Promise<PodMetricsResult> {
  try {
    const metrics = metricsForContext(cluster);
    const list = await metrics.getPodMetrics(namespace);
    const found = list.items.find((item) => item.metadata.name === podName);

    if (!found) {
      return {
        available: false,
        reason: 'Metrics are not available for this pod yet.',
      };
    }

    return {
      available: true,
      window: found.window,
      timestamp: found.timestamp,
      containers: found.containers.map((c) => ({
        name: c.name,
        cpu: c.usage.cpu,
        memory: c.usage.memory,
      })),
    };
  } catch (err) {
    if (looksLikeMissingMetricsServer(err)) {
      return {
        available: false,
        reason: 'This cluster does not expose the metrics API (metrics-server missing).',
      };
    }
    return { available: false, reason: safeErrorMessage(err) };
  }
}
