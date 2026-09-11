import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createApp } from './app.js';
import { resetKubeConfigCache, reloadKubeConfig } from './kube/kubeconfig.js';

function kubeConfigYaml(): string {
  return `apiVersion: v1
kind: Config
clusters:
  - name: status-cluster
    cluster:
      server: https://status-cluster.example.test
users:
  - name: status-user
    user:
      token: route-token-that-must-not-appear
contexts:
  - name: status-context
    context:
      cluster: status-cluster
      user: status-user
current-context: status-context
`;
}

async function requestJson(baseUrl: string, route: string): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const response = await fetch(`${baseUrl}${route}`);
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

test('kubeconfig status route reports source safely and sanitizes unavailable configs', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ops-flow-status-route-'));
  const validFile = path.join(directory, 'valid-config');
  const invalidFile = path.join(directory, 'invalid-config');
  const missingFile = path.join(directory, 'missing-config');
  const previousEnvironment = process.env.KUBECONFIG;
  const previousHome = process.env.HOME;
  const server = createServer(createApp());

  writeFileSync(validFile, kubeConfigYaml(), 'utf8');
  writeFileSync(invalidFile, 'clusters: [route-invalid-secret-marker', 'utf8');

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    resetKubeConfigCache();
    delete process.env.KUBECONFIG;
    reloadKubeConfig(validFile);
    const selected = await requestJson(baseUrl, '/api/kubeconfig/status');
    assert.equal(selected.status, 200);
    assert.deepEqual(selected.body, {
      available: true,
      source: 'selected',
      contextCount: 1,
    });
    assert.equal(JSON.stringify(selected.body).includes(validFile), false);
    assert.equal(JSON.stringify(selected.body).includes('route-token-that-must-not-appear'), false);

    resetKubeConfigCache();
    process.env.KUBECONFIG = missingFile;
    const missingStatus = await requestJson(baseUrl, '/api/kubeconfig/status');
    assert.deepEqual(missingStatus.body, { available: false, source: 'environment' });
    const missingContexts = await requestJson(baseUrl, '/api/contexts');
    assert.equal(missingContexts.status, 500);
    assert.deepEqual(missingContexts.body, { error: 'Could not read the kubeconfig.' });
    assert.equal(JSON.stringify(missingContexts.body).includes(missingFile), false);

    resetKubeConfigCache();
    process.env.KUBECONFIG = invalidFile;
    const invalidStatus = await requestJson(baseUrl, '/api/kubeconfig/status');
    assert.deepEqual(invalidStatus.body, { available: false, source: 'environment' });
    const invalidContexts = await requestJson(baseUrl, '/api/contexts');
    assert.equal(invalidContexts.status, 500);
    assert.deepEqual(invalidContexts.body, { error: 'Could not read the kubeconfig.' });
    assert.equal(JSON.stringify(invalidContexts.body).includes('route-invalid-secret-marker'), false);

    resetKubeConfigCache();
    process.env.KUBECONFIG = '';
    process.env.HOME = directory;
    const defaultStatus = await requestJson(baseUrl, '/api/kubeconfig/status');
    assert.deepEqual(defaultStatus.body, { available: false, source: 'default' });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    if (previousEnvironment === undefined) delete process.env.KUBECONFIG;
    else process.env.KUBECONFIG = previousEnvironment;
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    resetKubeConfigCache();
    rmSync(directory, { recursive: true, force: true });
  }
});