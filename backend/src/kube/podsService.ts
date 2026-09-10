import type { V1Pod } from '@kubernetes/client-node';
import { coreClientForContext } from './kubeconfig.js';
import { normalizePod } from './normalizePod.js';
import type { NormalizedPod, PodsFanOutResult, Target, TargetError } from './types.js';

/**
 * Fetches raw pods for a single target. Injectable so the fan-out can be tested
 * without a live cluster.
 */
export type PodLister = (target: Target) => Promise<V1Pod[]>;

/** Default lister: read-only listNamespacedPod against the target's context. */
const defaultPodLister: PodLister = async (target) => {
  const client = coreClientForContext(target.cluster);
  const list = await client.listNamespacedPod({ namespace: target.namespace });
  return list.items ?? [];
};

/**
 * Turns any thrown value into a short, safe message. Kubernetes client errors
 * can carry response bodies; we keep only a concise reason and never echo
 * credentials or full payloads.
 */
export function safeErrorMessage(reason: unknown): string {
  if (reason && typeof reason === 'object') {
    const anyReason = reason as { code?: unknown; body?: { message?: unknown }; message?: unknown };
    if (anyReason.body && typeof anyReason.body === 'object' && typeof anyReason.body.message === 'string') {
      return anyReason.body.message;
    }
    if (typeof anyReason.code === 'string' && anyReason.code) {
      return `Falha de conexão (${anyReason.code}).`;
    }
    if (typeof anyReason.message === 'string' && anyReason.message) {
      return anyReason.message;
    }
  }
  return 'Falha ao consultar o alvo.';
}

/**
 * Fans out a pods query across all targets in parallel. A failing target is
 * isolated into `errors[]` and never aborts the aggregation of the others.
 */
export async function getPods(
  targets: Target[],
  lister: PodLister = defaultPodLister,
  now: number = Date.now(),
): Promise<PodsFanOutResult> {
  const settled = await Promise.allSettled(
    targets.map(async (target) => {
      const items = await lister(target);
      return items.map((pod) => normalizePod(pod, target, now));
    }),
  );

  const pods: NormalizedPod[] = [];
  const errors: TargetError[] = [];

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      pods.push(...result.value);
    } else {
      errors.push({ target: targets[index], message: safeErrorMessage(result.reason) });
    }
  });

  return { pods, errors };
}
