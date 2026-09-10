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

/** Pulls the `message` field out of a Kubernetes Status payload, if present. */
function kubernetesStatusMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string') {
    return (body as { message: string }).message;
  }
  if (typeof body === 'string' && body.includes('"message"')) {
    try {
      const parsed = JSON.parse(body) as { message?: unknown };
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {
      // Not JSON after all; fall through.
    }
  }
  return undefined;
}

/**
 * Turns any thrown value into a short, safe message.
 *
 * The Kubernetes client raises `ApiException`, whose `message` concatenates the
 * status code, the raw response body and every response header. Surfacing that
 * verbatim would be unreadable and could echo sensitive headers, so we extract
 * just the Kubernetes `Status.message` when available.
 */
export function safeErrorMessage(reason: unknown): string {
  if (reason && typeof reason === 'object') {
    const anyReason = reason as { code?: unknown; body?: unknown; message?: unknown };

    const statusMessage = kubernetesStatusMessage(anyReason.body);
    if (statusMessage) return statusMessage;

    // Node system errors (ECONNREFUSED, UNABLE_TO_GET_ISSUER_CERT, ...) use string codes.
    if (typeof anyReason.code === 'string' && anyReason.code) {
      return `Falha de conexão (${anyReason.code}).`;
    }

    if (typeof anyReason.message === 'string' && anyReason.message) {
      // Never leak the ApiException dump: its message embeds the raw body and
      // every response header. Keep the status and the short reason line only.
      const lines = anyReason.message.split('\n');
      const codeLine = /^HTTP-Code:\s*(\d+)/.exec(lines[0]);
      if (codeLine) {
        const status = codeLine[1];
        const reason = lines
          .find((line) => line.startsWith('Message:'))
          ?.replace(/^Message:\s*/, '')
          .trim();
        const useful = reason && reason !== 'Unknown API Status Code!' ? ` ${reason}` : '';
        return `A API do cluster respondeu ${status}.${useful}`;
      }
      return anyReason.message;
    }
  }
  return 'Falha ao consultar o alvo.';
}

/** HTTP status carried by a Kubernetes client error, when there is one. */
export function errorStatusCode(reason: unknown): number | undefined {
  const code = (reason as { code?: unknown })?.code;
  return typeof code === 'number' ? code : undefined;
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
