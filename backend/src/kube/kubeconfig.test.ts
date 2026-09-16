import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  loadKubeConfig,
  resolveKubeConfigLocation,
} from './kubeconfigDiscovery.js';
import {
  coreClientForContext,
  getKubeConfigStatus,
  listContexts,
  reloadKubeConfig,
  resetKubeConfigCache,
} from './kubeconfig.js';

function envWithoutKubeConfig(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.KUBECONFIG;
  return env;
}

function kubeConfigYaml(context: string, cluster: string): string {
  return `apiVersion: v1
kind: Config
clusters:
  - name: ${cluster}
    cluster:
      server: https://${cluster}.example.test
users:
  - name: user-${cluster}
    user:
      token: token-that-must-not-appear
contexts:
  - name: ${context}
    context:
      cluster: ${cluster}
      user: user-${cluster}
current-context: ${context}
`;
}

function temporaryConfig(content: string): { directory: string; file: string } {
  const directory = mkdtempSync(path.join(tmpdir(), 'ops-union-kubeconfig-'));
  const file = path.join(directory, 'config');
  writeFileSync(file, content, 'utf8');
  return { directory, file };
}

test('resolveKubeConfigLocation prioritizes environment, selected, then default', () => {
  const environment = resolveKubeConfigLocation({
    env: { KUBECONFIG: '/env/one:/env/two', HOME: '/home/user' },
    platform: 'linux',
    selectedPath: '/selected/config',
  });
  assert.deepEqual(environment, {
    source: 'environment',
    paths: ['/env/one', '/env/two'],
  });

  const selected = resolveKubeConfigLocation({
    env: { HOME: '/home/user' },
    platform: 'linux',
    selectedPath: '/selected/config',
  });
  assert.deepEqual(selected, { source: 'selected', paths: ['/selected/config'] });

  const linuxDefault = resolveKubeConfigLocation({
    env: { HOME: '/home/user' },
    platform: 'linux',
  });
  assert.deepEqual(linuxDefault, {
    source: 'default',
    paths: ['/home/user/.kube/config'],
  });

  const windowsDefault = resolveKubeConfigLocation({
    env: { USERPROFILE: 'C:\\Users\\operator' },
    platform: 'win32',
  });
  assert.deepEqual(windowsDefault, {
    source: 'default',
    paths: ['C:\\Users\\operator\\.kube\\config'],
  });
});

test('loadKubeConfig reports a missing file without exposing its path', () => {
  const sensitivePath = path.join(tmpdir(), 'private-token-kubeconfig');

  assert.throws(
    () => loadKubeConfig({ env: envWithoutKubeConfig(), selectedPath: sensitivePath }),
    (error: unknown) => {
      assert.equal(error instanceof Error ? error.message : error, 'Could not read the kubeconfig.');
      assert.equal(error instanceof Error ? error.message.includes(sensitivePath) : false, false);
      return true;
    },
  );
});

test('loadKubeConfig reports invalid content without exposing file content', () => {
  const marker = 'invalid-kubeconfig-secret-marker';
  const fixture = temporaryConfig(`clusters: [${marker}`);

  try {
    assert.throws(
      () => loadKubeConfig({ env: envWithoutKubeConfig(), selectedPath: fixture.file }),
      (error: unknown) => {
        assert.equal(error instanceof Error ? error.message : error, 'Could not read the kubeconfig.');
        assert.equal(error instanceof Error ? error.message.includes(marker) : false, false);
        return true;
      },
    );
  } finally {
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('reloadKubeConfig preserves the previous config on failure and clears client caches on switch', () => {
  const first = temporaryConfig(kubeConfigYaml('first-context', 'first-cluster'));
  const second = temporaryConfig(kubeConfigYaml('second-context', 'second-cluster'));
  const previousEnvironment = process.env.KUBECONFIG;
  delete process.env.KUBECONFIG;

  try {
    resetKubeConfigCache();
    reloadKubeConfig(first.file);
    const firstClient = coreClientForContext('first-context');
    assert.deepEqual(listContexts(), [
      { name: 'first-context', cluster: 'first-cluster', namespace: undefined },
    ]);

    assert.throws(() => reloadKubeConfig(path.join(first.directory, 'missing')));
    assert.deepEqual(listContexts(), [
      { name: 'first-context', cluster: 'first-cluster', namespace: undefined },
    ]);
    assert.equal(coreClientForContext('first-context'), firstClient);

    reloadKubeConfig(second.file);
    const secondClient = coreClientForContext('second-context');
    assert.notEqual(secondClient, firstClient);
    assert.deepEqual(listContexts(), [
      { name: 'second-context', cluster: 'second-cluster', namespace: undefined },
    ]);
  } finally {
    if (previousEnvironment === undefined) delete process.env.KUBECONFIG;
    else process.env.KUBECONFIG = previousEnvironment;
    resetKubeConfigCache();
    rmSync(first.directory, { recursive: true, force: true });
    rmSync(second.directory, { recursive: true, force: true });
  }
});

test('persisted selected config takes precedence over KUBECONFIG on startup', () => {
  const environment = temporaryConfig(kubeConfigYaml('environment-context', 'environment-cluster'));
  const selected = temporaryConfig(kubeConfigYaml('selected-context', 'selected-cluster'));
  const previousEnvironment = process.env.KUBECONFIG;
  const previousSelected = process.env.OPS_FLOW_SELECTED_KUBECONFIG;
  process.env.KUBECONFIG = environment.file;
  process.env.OPS_FLOW_SELECTED_KUBECONFIG = selected.file;

  try {
    resetKubeConfigCache();
    assert.deepEqual(listContexts(), [
      { name: 'selected-context', cluster: 'selected-cluster', namespace: undefined },
    ]);
    assert.equal(getKubeConfigStatus().source, 'selected');
  } finally {
    if (previousEnvironment === undefined) delete process.env.KUBECONFIG;
    else process.env.KUBECONFIG = previousEnvironment;
    if (previousSelected === undefined) delete process.env.OPS_FLOW_SELECTED_KUBECONFIG;
    else process.env.OPS_FLOW_SELECTED_KUBECONFIG = previousSelected;
    resetKubeConfigCache();
    rmSync(environment.directory, { recursive: true, force: true });
    rmSync(selected.directory, { recursive: true, force: true });
  }
});

test('getKubeConfigStatus reports safe metadata for the selected config', () => {
  const fixture = temporaryConfig(kubeConfigYaml('status-context', 'status-cluster'));
  const previousEnvironment = process.env.KUBECONFIG;
  delete process.env.KUBECONFIG;

  try {
    resetKubeConfigCache();
    reloadKubeConfig(fixture.file);

    const status = getKubeConfigStatus();
    assert.deepEqual(status, {
      available: true,
      source: 'selected',
      contextCount: 1,
    });
    assert.equal(JSON.stringify(status).includes(fixture.file), false);
    assert.equal(JSON.stringify(status).includes('token-that-must-not-appear'), false);
  } finally {
    if (previousEnvironment === undefined) delete process.env.KUBECONFIG;
    else process.env.KUBECONFIG = previousEnvironment;
    resetKubeConfigCache();
    rmSync(fixture.directory, { recursive: true, force: true });
  }
});