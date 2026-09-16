import type { EffectiveLogSubscription, LogLimits, LogSource, SubscribeMessage } from './logsTypes.js';

export const DEFAULT_LOG_LIMITS: LogLimits = {
  maxLinesPerSource: 2_000,
  maxBytesPerSource: 2 * 1024 * 1024,
  maxLinesTotal: 10_000,
  maxBytesTotal: 10 * 1024 * 1024,
};

export const MAX_LOG_LIMITS: LogLimits = {
  maxLinesPerSource: 10_000,
  maxBytesPerSource: 10 * 1024 * 1024,
  maxLinesTotal: 50_000,
  maxBytesTotal: 50 * 1024 * 1024,
};

export const MAX_LOG_SOURCES = 50;

export type SubscriptionValidation = { subscription: EffectiveLogSubscription } | { error: string };

function requiredText(value: unknown, field: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return `${field} must be a non-empty string.`;
  return undefined;
}

function normalizeLimit(value: unknown, field: keyof LogLimits): number | string {
  if (value === undefined) return DEFAULT_LOG_LIMITS[field];
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    return `${field} must be a finite positive integer.`;
  }
  return Math.min(value, MAX_LOG_LIMITS[field]);
}

function normalizeDate(value: unknown, field: 'from' | 'to'): string | undefined | string {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return `${field} must be an ISO timestamp.`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `${field} must be an ISO timestamp.`;
  return date.toISOString();
}

function sourceKey(source: LogSource): string {
  return [source.cluster, source.namespace, source.pod, source.container].join('\u0000');
}

export function validateSubscription(raw: unknown): SubscriptionValidation {
  if (!raw || typeof raw !== 'object' || (raw as { type?: unknown }).type !== 'subscribe') {
    return { error: 'The first message must be a subscribe message.' };
  }
  const message = raw as Partial<SubscribeMessage>;
  if (!Array.isArray(message.sources) || message.sources.length === 0) {
    return { error: 'Provide at least one log source.' };
  }
  const from = normalizeDate(message.from, 'from');
  const to = normalizeDate(message.to, 'to');
  if (typeof from === 'string' && from.includes(' must be ')) return { error: from };
  if (typeof to === 'string' && to.includes(' must be ')) return { error: to };
  if (from && to && from >= to) return { error: 'from must be earlier than to.' };
  if (message.follow !== undefined && typeof message.follow !== 'boolean') {
    return { error: 'follow must be a boolean.' };
  }

  const normalizedSources: LogSource[] = [];
  const seen = new Set<string>();
  for (const rawSource of message.sources) {
    if (!rawSource || typeof rawSource !== 'object') return { error: 'Each source must be an object.' };
    const source = rawSource as LogSource;
    for (const field of ['sourceId', 'cluster', 'namespace', 'pod', 'container'] as const) {
      const error = requiredText(source[field], `source.${field}`);
      if (error) return { error };
    }
    const normalized: LogSource = {
      sourceId: source.sourceId.trim(),
      cluster: source.cluster.trim(),
      namespace: source.namespace.trim(),
      pod: source.pod.trim(),
      container: source.container.trim(),
      ...(source.application ? { application: source.application } : {}),
    };
    const key = sourceKey(normalized);
    if (!seen.has(key)) {
      seen.add(key);
      normalizedSources.push(normalized);
    }
  }
  if (normalizedSources.length > MAX_LOG_SOURCES) {
    return { error: `A subscription may contain at most ${MAX_LOG_SOURCES} sources.` };
  }

  const requested = message.limits === undefined ? {} : message.limits;
  if (!requested || typeof requested !== 'object' || Array.isArray(requested)) {
    return { error: 'limits must be an object.' };
  }
  const limits = {} as LogLimits;
  for (const field of Object.keys(DEFAULT_LOG_LIMITS) as Array<keyof LogLimits>) {
    const value = normalizeLimit(requested[field], field);
    if (typeof value === 'string') return { error: value };
    limits[field] = value;
  }

  return {
    subscription: {
      from: from as string | undefined,
      to: to as string | undefined,
      follow: message.follow !== false,
      limits,
      sources: normalizedSources,
    },
  };
}