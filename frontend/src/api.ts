import type {
  ContextInfo,
  NamespacesResponse,
  PodDescribe,
  PodMetricsResult,
  PodsResponse,
  Target,
} from './types';

/** Extracts a readable message from a non-OK response. */
async function errorFrom(res: Response): Promise<Error> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return new Error(body.error);
  } catch {
    // Body was not JSON; fall through to the status text.
  }
  return new Error(`HTTP ${res.status}`);
}

/** Lists kubeconfig contexts available as targets. */
export async function fetchContexts(): Promise<ContextInfo[]> {
  const res = await fetch('/api/contexts');
  if (!res.ok) throw await errorFrom(res);
  const body = (await res.json()) as { contexts: ContextInfo[] };
  return body.contexts;
}

/**
 * Fans out a pods query across the given (cluster, namespace) targets.
 * Per-target failures come back in `errors` while successful targets still
 * return their pods.
 */
export async function fetchPods(targets: Target[]): Promise<PodsResponse> {
  const res = await fetch('/api/pods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targets }),
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as PodsResponse;
}

/**
 * Lists the namespaces available across the given clusters, each annotated with
 * where it exists. Read-only.
 */
export async function fetchNamespaces(clusters: string[]): Promise<NamespacesResponse> {
  const res = await fetch('/api/namespaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clusters }),
  });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as NamespacesResponse;
}

/** Path-safe encoding for the cluster/namespace/pod segments. */
function podPath(cluster: string, namespace: string, pod: string): string {
  return `/api/pods/${encodeURIComponent(cluster)}/${encodeURIComponent(namespace)}/${encodeURIComponent(pod)}`;
}

/** Reads describe-equivalent details for a pod. */
export async function fetchPodDescribe(
  cluster: string,
  namespace: string,
  pod: string,
): Promise<PodDescribe> {
  const res = await fetch(`${podPath(cluster, namespace, pod)}/describe`);
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as PodDescribe;
}

/**
 * Reads CPU/memory for a pod. Always resolves: clusters without metrics-server
 * report `available: false` rather than failing.
 */
export async function fetchPodMetrics(
  cluster: string,
  namespace: string,
  pod: string,
): Promise<PodMetricsResult> {
  const res = await fetch(`${podPath(cluster, namespace, pod)}/metrics`);
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as PodMetricsResult;
}

/** Builds the WebSocket URL for streaming a container's logs. */
export function podLogsUrl(
  cluster: string,
  namespace: string,
  pod: string,
  options: { container: string; follow: boolean; tailLines: number },
): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const params = new URLSearchParams({
    container: options.container,
    follow: String(options.follow),
    tailLines: String(options.tailLines),
  });
  return `${protocol}//${window.location.host}${podPath(cluster, namespace, pod)}/logs?${params}`;
}
