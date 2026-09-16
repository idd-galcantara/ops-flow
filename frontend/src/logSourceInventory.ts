import type {
  ApplicationIdentity,
  ApplicationLogInventory,
  ContainerRole,
  InventoryContainer,
  InventoryContext,
  InventoryIssue,
  InventoryPod,
  LogSource,
  LogSourceSelection,
  NormalizedPod,
  Target,
} from './types';

export const KNOWN_SIDECAR_INDICATORS = [
  'istio-proxy',
  'envoy',
  'linkerd-proxy',
  'fluent-bit',
  'fluentd',
  'filebeat',
  'vector',
  'otel-collector',
  'datadog-agent',
  'jaeger-agent',
] as const;

const sidecarNames = new Set<string>(KNOWN_SIDECAR_INDICATORS);

export function classifyContainer(
  name: string,
  explicitRole?: ContainerRole,
): { role: ContainerRole; roleReason?: string } {
  if (explicitRole) return { role: explicitRole, roleReason: 'pod metadata' };
  const normalized = name.trim().toLowerCase();
  if (sidecarNames.has(normalized) || /(^|[-_.])(proxy|sidecar|agent|collector)([-_.]|$)/.test(normalized)) {
    return { role: 'sidecar', roleReason: 'known infrastructure indicator' };
  }
  return { role: 'unknown', roleReason: 'no role metadata' };
}

export function inventoryContextKey(value: Pick<Target, 'cluster' | 'namespace'>): string {
  return `${value.cluster}\u0000${value.namespace}`;
}

export function inventorySourceKey(
  value: Pick<LogSourceSelection, 'cluster' | 'namespace' | 'pod' | 'container'>,
): string {
  return [value.cluster, value.namespace, value.pod, value.container].join('\u0000');
}

function inventoryContainerFor(name: string): InventoryContainer {
  return { container: name, ...classifyContainer(name) };
}

export function buildApplicationLogInventory(
  pods: NormalizedPod[],
  application: ApplicationIdentity,
  issues: InventoryIssue[] = [],
  snapshotAt?: number,
): ApplicationLogInventory {
  const contexts = new Map<string, InventoryContext>();
  for (const pod of pods) {
    if (pod.application.key !== application.key) continue;
    const key = inventoryContextKey(pod);
    const current = contexts.get(key) ?? {
      cluster: pod.cluster,
      namespace: pod.namespace,
      pods: [],
      sidecarOnlyPods: [],
    };
    const inventoryPod: InventoryPod = {
      pod: pod.name,
      containers: pod.containers.map(inventoryContainerFor),
      status: pod.status,
    };
    if (inventoryPod.containers.length > 0 && inventoryPod.containers.every((container) => container.role === 'sidecar')) {
      current.sidecarOnlyPods.push(inventoryPod.pod);
    }
    current.pods.push(inventoryPod);
    contexts.set(key, current);
  }

  return {
    application,
    contexts: [...contexts.values()]
      .map((context) => ({
        ...context,
        pods: [...context.pods].sort((a, b) => a.pod.localeCompare(b.pod)),
        sidecarOnlyPods: [...context.sidecarOnlyPods].sort(),
      }))
      .sort((a, b) => inventoryContextKey(a).localeCompare(inventoryContextKey(b))),
    issues,
    snapshotAt,
  };
}

export function defaultSelectionKeys(
  inventory: ApplicationLogInventory,
  originatingContext: Pick<Target, 'cluster' | 'namespace'>,
): Set<string> {
  const selected = new Set<string>();
  const context = inventory.contexts.find((item) => inventoryContextKey(item) === inventoryContextKey(originatingContext));
  if (!context) return selected;
  for (const pod of context.pods) {
    const actionable = pod.containers.filter((container) => container.role !== 'sidecar');
    const containers = actionable.length > 0 ? actionable : pod.containers;
    for (const container of containers) {
      selected.add(inventorySourceKey({ cluster: context.cluster, namespace: context.namespace, pod: pod.pod, container: container.container }));
    }
  }
  return selected;
}

export function selectionFromKeys(
  inventory: ApplicationLogInventory,
  selectedKeys: ReadonlySet<string>,
): LogSourceSelection[] {
  const result: LogSourceSelection[] = [];
  const seen = new Set<string>();
  for (const context of inventory.contexts) {
    for (const pod of context.pods) {
      for (const container of pod.containers) {
        const selection: LogSourceSelection = {
          cluster: context.cluster,
          namespace: context.namespace,
          pod: pod.pod,
          container: container.container,
          application: inventory.application,
          containerRole: container.role,
        };
        const key = inventorySourceKey(selection);
        if (selectedKeys.has(key) && !seen.has(key)) {
          seen.add(key);
          result.push(selection);
        }
      }
    }
  }
  return result;
}

export function reconcileSelectionKeys(
  inventory: ApplicationLogInventory,
  selectedKeys: ReadonlySet<string>,
): Set<string> {
  return new Set(selectionFromKeys(inventory, selectedKeys).map(inventorySourceKey));
}

export function selectionToSourceId(selection: Pick<LogSourceSelection, 'cluster' | 'namespace' | 'pod' | 'container'>): string {
  return [selection.cluster, selection.namespace, selection.pod, selection.container]
    .map((part) => encodeURIComponent(part))
    .join('/');
}

export function selectionToLogSources(selections: LogSourceSelection[]): LogSource[] {
  const result: LogSource[] = [];
  const seen = new Set<string>();
  for (const selection of selections) {
    const key = inventorySourceKey(selection);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      sourceId: selectionToSourceId(selection),
      cluster: selection.cluster,
      namespace: selection.namespace,
      pod: selection.pod,
      container: selection.container,
      application: selection.application,
      containerRole: selection.containerRole,
    });
  }
  return result;
}

export function contextSelectionCount(inventory: ApplicationLogInventory, selectedKeys: ReadonlySet<string>, context: InventoryContext): number {
  return selectionFromKeys({ ...inventory, contexts: [context] }, selectedKeys).length;
}

export function inventoryHasSources(inventory: ApplicationLogInventory): boolean {
  return inventory.contexts.some((context) => context.pods.some((pod) => pod.containers.length > 0));
}

export function scopedIssueText(issue: InventoryIssue): string {
  const scope = [issue.cluster, issue.namespace, issue.pod].filter(Boolean).join(' / ');
  return scope ? `${scope}: ${issue.message}` : issue.message;
}