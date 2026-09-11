import { homedir } from 'node:os';
import path from 'node:path';
import { KubeConfig } from '@kubernetes/client-node';

export type KubeConfigSource = 'environment' | 'selected' | 'default';

export interface KubeConfigLocation {
  source: KubeConfigSource;
  paths: string[];
}

export interface KubeConfigDiscoveryOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  selectedPath?: string | null;
  ignoreEnvironment?: boolean;
}

function environmentPaths(value: string, platform: NodeJS.Platform): string[] {
  const delimiter = platform === 'win32' ? ';' : ':';
  return value
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function defaultKubeConfigPath(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string {
  const pathModule = platform === 'win32' ? path.win32 : path.posix;
  const home = platform === 'win32'
    ? env.USERPROFILE ?? env.HOME ?? (env.HOMEDRIVE && env.HOMEPATH
      ? pathModule.join(env.HOMEDRIVE, env.HOMEPATH)
      : homedir())
    : env.HOME ?? homedir();

  return pathModule.join(home, '.kube', 'config');
}

export function resolveKubeConfigLocation(
  options: KubeConfigDiscoveryOptions = {},
): KubeConfigLocation {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const configuredPaths = env.KUBECONFIG?.trim();

  if (configuredPaths && !options.ignoreEnvironment) {
    return {
      source: 'environment',
      paths: environmentPaths(configuredPaths, platform),
    };
  }

  const selectedPath = options.selectedPath?.trim();
  if (selectedPath) {
    return { source: 'selected', paths: [selectedPath] };
  }

  return {
    source: 'default',
    paths: [defaultKubeConfigPath(env, platform)],
  };
}

function loadFromPaths(paths: string[]): KubeConfig {
  const kubeConfig = new KubeConfig();
  kubeConfig.loadFromFile(paths[0]);

  for (const file of paths.slice(1)) {
    const additionalConfig = new KubeConfig();
    additionalConfig.loadFromFile(file);
    kubeConfig.mergeConfig(additionalConfig);
  }

  return kubeConfig;
}

export function loadKubeConfig(options: KubeConfigDiscoveryOptions = {}): KubeConfig {
  const location = resolveKubeConfigLocation(options);

  try {
    return loadFromPaths(location.paths);
  } catch {
    throw new Error('Could not read the kubeconfig.');
  }
}