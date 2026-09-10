import { CoreV1Api, KubeConfig } from '@kubernetes/client-node';

/**
 * Loads the user's kubeconfig once and exposes read-only helpers over it.
 *
 * Security: this module only ever surfaces context/cluster/namespace *names*.
 * Tokens, client certificates and other credentials from the kubeconfig are
 * never returned, logged or persisted — ops-flow is a local, read-only tool.
 */

export interface ContextInfo {
  /** Context name, e.g. "kubernetes-qa-tb". This is what the UI selects. */
  name: string;
  /** Cluster name the context points to. */
  cluster: string;
  /** Default namespace declared in the context, if any. */
  namespace?: string;
}

let kubeConfig: KubeConfig | null = null;

/** Lazily loads (and caches) the default kubeconfig. */
function getKubeConfig(): KubeConfig {
  if (!kubeConfig) {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    kubeConfig = kc;
  }
  return kubeConfig;
}

/**
 * Returns the list of contexts available in the kubeconfig, names only.
 * Throws a sanitized error if the kubeconfig cannot be read.
 */
export function listContexts(): ContextInfo[] {
  let kc: KubeConfig;
  try {
    kc = getKubeConfig();
  } catch {
    // Never surface the underlying path/credentials in the error.
    throw new Error('Não foi possível ler o kubeconfig.');
  }

  return kc.getContexts().map((ctx) => ({
    name: ctx.name,
    cluster: ctx.cluster,
    namespace: ctx.namespace,
  }));
}

/** Per-context client cache so we don't rebuild an API client on every request. */
const clientCache = new Map<string, CoreV1Api>();

/**
 * Builds (and caches) a CoreV1Api scoped to a given context.
 * Only read operations are ever called against this client elsewhere in the app.
 */
export function coreClientForContext(context: string): CoreV1Api {
  const cached = clientCache.get(context);
  if (cached) return cached;

  const kc = getKubeConfig();
  const known = kc.getContexts().some((ctx) => ctx.name === context);
  if (!known) {
    throw new Error(`Context desconhecido: ${context}`);
  }

  // Scope a copy of the config to the requested context so concurrent fan-out
  // against different contexts never mutates a shared "current context".
  const scoped = new KubeConfig();
  scoped.loadFromDefault();
  scoped.setCurrentContext(context);
  const client = scoped.makeApiClient(CoreV1Api);
  clientCache.set(context, client);
  return client;
}

/** Test/utility hook to reset cached state. */
export function resetKubeConfigCache(): void {
  kubeConfig = null;
  clientCache.clear();
}
