import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatAge, groupPods, isDegraded, matchesFilter, statusSeverity } from './podPresentation';
import type { NormalizedPod } from './types';

function pod(overrides: Partial<NormalizedPod> = {}): NormalizedPod {
  return {
    cluster: 'cluster-a',
    namespace: 'namespace-a',
    name: 'pod-service-1',
    status: 'Running',
    ready: '2/2',
    restarts: 0,
    node: 'node-1',
    ageSeconds: 3600,
    containers: ['app', 'istio-proxy'],
    application: { key: 'label:application-b', name: 'application-b', source: 'label', labelKey: 'app' },
    ...overrides,
  };
}

test('formatAge uses the two most significant units, like kubectl', () => {
  assert.equal(formatAge(45), '45s');
  assert.equal(formatAge(90), '1m30s');
  assert.equal(formatAge(3600), '1h');
  assert.equal(formatAge(14280), '3h58m');
  assert.equal(formatAge(188748), '2d4h');
  assert.equal(formatAge(0), '0s');
});

test('statusSeverity maps known statuses to buckets', () => {
  assert.equal(statusSeverity('Running'), 'ok');
  assert.equal(statusSeverity('Completed'), 'ok');
  assert.equal(statusSeverity('Pending'), 'warn');
  assert.equal(statusSeverity('Terminating'), 'warn');
  assert.equal(statusSeverity('CrashLoopBackOff'), 'error');
  assert.equal(statusSeverity('ImagePullBackOff'), 'error');
});

test('statusSeverity treats unknown failure-looking reasons as errors', () => {
  assert.equal(statusSeverity('SomethingBackOff'), 'error');
  assert.equal(statusSeverity('WeirdError'), 'error');
});

test('isDegraded detects containers that are not all ready', () => {
  assert.equal(isDegraded(pod({ ready: '2/2' })), false);
  assert.equal(isDegraded(pod({ ready: '1/2' })), true);
});

test('matchesFilter searches across name, cluster, namespace, status, node and containers', () => {
  const p = pod();
  assert.equal(matchesFilter(p, ''), true, 'filtro vazio inclui tudo');
  assert.equal(matchesFilter(p, 'pod-service'), true);
  assert.equal(matchesFilter(p, 'cluster-a'), true);
  assert.equal(matchesFilter(p, 'RUNNING'), true, 'case-insensitive');
  assert.equal(matchesFilter(p, 'istio'), true, 'busca em containers');
  assert.equal(matchesFilter(p, 'node-1'), true);
  assert.equal(matchesFilter(p, 'inexistente'), false);
  assert.equal(matchesFilter(p, 'application-b'), true);
});

test('groupPods groups by namespace across clusters', () => {
  const pods = [
    pod({ cluster: 'cluster-a', namespace: 'namespace-a', name: 'a' }),
    pod({ cluster: 'cluster-b', namespace: 'namespace-a', name: 'b' }),
    pod({ cluster: 'cluster-b', namespace: 'namespace-b', name: 'c' }),
  ];
  const groups = groupPods(pods, 'namespace');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].key, 'namespace-a');
  assert.equal(groups[0].pods.length, 2, 'reúne os dois clusters no mesmo namespace');
  assert.equal(groups[1].key, 'namespace-b');
  assert.equal(groups[1].pods.length, 1);
});

test('groupPods groups by cluster', () => {
  const pods = [
    pod({ cluster: 'cluster-a', name: 'a' }),
    pod({ cluster: 'cluster-b', name: 'b' }),
    pod({ cluster: 'cluster-b', name: 'c' }),
  ];
  const groups = groupPods(pods, 'cluster');
  assert.deepEqual(
    groups.map((g) => [g.key, g.pods.length]),
    [
      ['cluster-a', 1],
      ['cluster-b', 2],
    ],
  );
});

test('groupPods groups by application without merging context in each pod', () => {
  const pods = [
    pod({ cluster: 'cluster-a', name: 'application-b-a', application: { key: 'label:application-b', name: 'application-b', source: 'label' } }),
    pod({ cluster: 'cluster-b', name: 'application-b-b', application: { key: 'label:application-b', name: 'application-b', source: 'label' } }),
    pod({ cluster: 'cluster-a', name: 'application-c', application: { key: 'label:application-c', name: 'application-c', source: 'label' } }),
  ];
  const groups = groupPods(pods, 'application');
  assert.deepEqual(groups.map((group) => [group.key, group.pods.map((item) => item.cluster)]), [
    ['label:application-b', ['cluster-a', 'cluster-b']],
    ['label:application-c', ['cluster-a']],
  ]);
});

test('groupPods flat mode returns a single unkeyed group', () => {
  const pods = [pod({ name: 'a' }), pod({ name: 'b' })];
  const groups = groupPods(pods, 'flat');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, '');
  assert.equal(groups[0].pods.length, 2);
});

test('groupPods sorting is stable and deterministic', () => {
  const pods = [
    pod({ namespace: 'ns-b', cluster: 'c2', name: 'z' }),
    pod({ namespace: 'ns-a', cluster: 'c1', name: 'y' }),
    pod({ namespace: 'ns-a', cluster: 'c1', name: 'x' }),
  ];
  const first = groupPods(pods, 'flat')[0].pods.map((p) => p.name);
  const second = groupPods([...pods].reverse(), 'flat')[0].pods.map((p) => p.name);
  assert.deepEqual(first, second, 'mesma ordem independente da entrada');
  assert.deepEqual(first, ['x', 'y', 'z']);
});

test('groupPods handles large namespaces without losing pods', () => {
  // namespace-system style volume: grouping must stay correct at scale, since the
  // table paginates rendering rather than dropping rows.
  const many = Array.from({ length: 1339 }, (_, i) =>
    pod({ namespace: 'namespace-system', name: `system-pod-${i}` }),
  );
  const mixed = [...many, pod({ namespace: 'namespace-a', name: 'app-1' })];
  const groups = groupPods(mixed, 'namespace');
  assert.equal(groups.length, 2);
  const total = groups.reduce((sum, g) => sum + g.pods.length, 0);
  assert.equal(total, 1340, 'nenhum pod é perdido no agrupamento');
  assert.equal(groups.find((g) => g.key === 'namespace-system')?.pods.length, 1339);
});
