import type { ContextInfo, PodsResponse, Target } from './types';

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
