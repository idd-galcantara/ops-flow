import type { V1Pod } from '@kubernetes/client-node';
import type { ApplicationIdentity } from './types.js';

const APPLICATION_LABELS = [
  'app.kubernetes.io/name',
  'app',
  'k8s-app',
] as const;

function keyPart(value: string): string {
  return encodeURIComponent(value);
}

/** Derives display/grouping metadata without querying or traversing owners. */
export function applicationIdentity(pod: V1Pod): ApplicationIdentity {
  const labels = pod.metadata?.labels ?? {};
  for (const labelKey of APPLICATION_LABELS) {
    const value = labels[labelKey]?.trim();
    if (value) {
      return {
        key: `label:${keyPart(labelKey)}:${keyPart(value)}`,
        name: value,
        source: 'label',
        labelKey,
      };
    }
  }

  const owner = (pod.metadata?.ownerReferences ?? []).find(
    (reference) => reference.controller === true && reference.name?.trim() && reference.kind?.trim(),
  );
  if (owner) {
    const ownerName = owner.name.trim();
    const ownerKind = owner.kind.trim();
    return {
      key: `ownerReference:${keyPart(ownerKind)}:${keyPart(ownerName)}`,
      name: ownerName,
      source: 'ownerReference',
      ownerKind,
      ownerName,
    };
  }

  const podName = pod.metadata?.name?.trim() || '(unnamed)';
  return {
    key: `pod:${keyPart(podName)}`,
    name: podName,
    source: 'pod',
  };
}