import { inventoryHasSources, selectionFromKeys } from './logSourceInventory';
import type { ApplicationLogInventory, NormalizedPod } from './types';

export function applicationKeys(pods: readonly Pick<NormalizedPod, 'application'>[]): Set<string> {
  return new Set(pods.map((pod) => pod.application.key));
}

export function hasSingleApplicationKey(pods: readonly Pick<NormalizedPod, 'application'>[]): boolean {
  return applicationKeys(pods).size <= 1;
}

export function modalSelectionCount(inventory: ApplicationLogInventory | undefined, selectedKeys: ReadonlySet<string>): number {
  return inventory ? selectionFromKeys(inventory, selectedKeys).length : 0;
}

export function canConfirmLogSelection(
  inventory: ApplicationLogInventory | undefined,
  selectedKeys: ReadonlySet<string>,
  state: { loading: boolean; stale: boolean },
): boolean {
  return Boolean(inventory && inventoryHasSources(inventory) && modalSelectionCount(inventory, selectedKeys) > 0 && !state.loading && !state.stale);
}