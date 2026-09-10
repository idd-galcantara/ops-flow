import { readFileSync } from 'node:fs';

/**
 * Well-known locations of the OS trust store (Debian/Ubuntu, RHEL/Fedora).
 * Read-only: ops-flow never writes to or modifies the system trust store.
 */
const SYSTEM_CA_BUNDLES = [
  '/etc/ssl/certs/ca-certificates.crt',
  '/etc/pki/tls/certs/ca-bundle.crt',
];

let cachedSystemRoots: string | null | undefined;

/**
 * Reads the OS CA bundle (first one found), cached. Returns null when none is
 * readable, in which case the kubeconfig CA is used as-is.
 */
export function readSystemRoots(bundlePaths: string[] = SYSTEM_CA_BUNDLES): string | null {
  if (cachedSystemRoots !== undefined) return cachedSystemRoots;

  for (const path of bundlePaths) {
    try {
      const pem = readFileSync(path, 'utf8');
      if (pem.includes('BEGIN CERTIFICATE')) {
        cachedSystemRoots = pem;
        return cachedSystemRoots;
      }
    } catch {
      // Not readable on this machine; try the next candidate.
    }
  }

  cachedSystemRoots = null;
  return cachedSystemRoots;
}

/**
 * Builds a complete CA chain by appending the OS trust store to the CA embedded
 * in the kubeconfig.
 *
 * Why this is needed: clusters here present only their leaf certificate, and the
 * kubeconfig's `certificate-authority-data` holds just the *intermediate* CA
 * (e.g. "kubernetes-qa-tb CA"). The issuers above it ("SSL Kubernetes CA v1" ->
 * "PagPKI Root CA v1") live in the OS trust store. `@kubernetes/client-node`
 * builds its HTTPS agent from `caData` alone, so the chain cannot be verified
 * and TLS fails with UNABLE_TO_GET_ISSUER_CERT.
 *
 * Combining both sources lets verification succeed with TLS checks fully ENABLED
 * (no skipTLSVerify, no NODE_TLS_REJECT_UNAUTHORIZED, no system changes).
 */
export function buildFullCaChain(kubeconfigCaPem: string, systemRoots = readSystemRoots()): string {
  if (!systemRoots) return kubeconfigCaPem;
  return `${kubeconfigCaPem.trimEnd()}\n${systemRoots}`;
}

/** Test hook: clears the cached system roots. */
export function resetSystemRootsCache(): void {
  cachedSystemRoots = undefined;
}
