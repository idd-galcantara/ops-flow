/**
 * Formatters for the raw resource units the Kubernetes metrics API returns
 * (e.g. cpu "17071271n", memory "101696Ki"), matching how `kubectl top` reads.
 */

/** CPU suffixes expressed as a fraction of one core. */
const CPU_SCALE: Record<string, number> = {
  n: 1e-9, // nanocores
  u: 1e-6, // microcores
  m: 1e-3, // millicores
  '': 1, // whole cores
};

/**
 * Parses a Kubernetes CPU quantity into cores.
 * Returns null when the value cannot be understood.
 */
export function parseCpuToCores(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)([numk]?)$/.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const scale = CPU_SCALE[match[2] === 'k' ? '' : match[2]];
  if (!Number.isFinite(amount) || scale === undefined) return null;
  return amount * scale;
}

/** Formats a CPU quantity the way kubectl does: millicores, or cores when large. */
export function formatCpu(value: string): string {
  const cores = parseCpuToCores(value);
  if (cores === null) return value;
  if (cores === 0) return '0';
  const millis = cores * 1000;
  if (millis < 1) return `${millis.toFixed(2)}m`;
  if (millis < 1000) return `${Math.round(millis)}m`;
  return `${cores.toFixed(2)} cores`;
}

/** Binary suffixes used by Kubernetes memory quantities. */
const MEMORY_SCALE: Record<string, number> = {
  '': 1,
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  K: 1000,
  M: 1000 ** 2,
  G: 1000 ** 3,
  T: 1000 ** 4,
};

/** Parses a Kubernetes memory quantity into bytes, or null when unparseable. */
export function parseMemoryToBytes(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|K|M|G|T)?$/.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const scale = MEMORY_SCALE[match[2] ?? ''];
  if (!Number.isFinite(amount) || scale === undefined) return null;
  return amount * scale;
}

/** Formats a memory quantity in the nearest binary unit, e.g. "99Mi". */
export function formatMemory(value: string): string {
  const bytes = parseMemoryToBytes(value);
  if (bytes === null) return value;
  if (bytes === 0) return '0';

  const units: [number, string][] = [
    [1024 ** 4, 'Ti'],
    [1024 ** 3, 'Gi'],
    [1024 ** 2, 'Mi'],
    [1024, 'Ki'],
  ];
  for (const [scale, suffix] of units) {
    if (bytes >= scale) {
      const scaled = bytes / scale;
      return `${scaled >= 100 ? Math.round(scaled) : scaled.toFixed(1)}${suffix}`;
    }
  }
  return `${bytes}B`;
}

/**
 * Usage as a percentage of a limit, when both are parseable.
 * Lets the UI show how close a container is to being throttled or OOM-killed.
 */
export function usageRatio(
  usage: string,
  limit: string | undefined,
  kind: 'cpu' | 'memory',
): number | null {
  if (!limit) return null;
  const parse = kind === 'cpu' ? parseCpuToCores : parseMemoryToBytes;
  const used = parse(usage);
  const max = parse(limit);
  if (used === null || max === null || max === 0) return null;
  return used / max;
}

/** Formats an ISO timestamp as a short local date/time, or '—'. */
export function formatTimestamp(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
