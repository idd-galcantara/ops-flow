import type { LogPeriod, LogRange } from './types';

export const LOG_PERIODS: Array<{ value: LogPeriod; label: string }> = [
  { value: 'all', label: 'All available' },
  { value: '5m', label: 'Last 5 minutes' },
  { value: '15m', label: 'Last 15 minutes' },
  { value: '1h', label: 'Last hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: 'custom', label: 'Custom range' },
];

const PERIOD_MILLISECONDS: Partial<Record<Exclude<LogPeriod, 'all' | 'custom'>, number>> = {
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
};

export interface LogRangeResult {
  range?: LogRange;
  error?: string;
}

/** Converts a datetime-local value to an explicit UTC ISO timestamp. */
export function datetimeLocalToUtc(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Validates the half-open interval before a socket can be opened. */
export function validateLogRange(range: LogRange): string | undefined {
  if (range.from && Number.isNaN(Date.parse(range.from))) return 'The start time is not a valid date.';
  if (range.to && Number.isNaN(Date.parse(range.to))) return 'The end time is not a valid date.';
  if (range.from && range.to && range.from >= range.to) return 'Start time must be earlier than end time.';
  return undefined;
}

/** Resolves a UI period at subscription time, always serializing UTC values. */
export function resolveLogRange(
  period: LogPeriod,
  now = new Date(),
  custom: { from: string; to: string } = { from: '', to: '' },
): LogRangeResult {
  if (period === 'all') return { range: {} };
  if (period === 'custom') {
    const from = datetimeLocalToUtc(custom.from);
    const to = datetimeLocalToUtc(custom.to);
    if (custom.from && !from) return { error: 'Choose a valid UTC start date.' };
    if (custom.to && !to) return { error: 'Choose a valid UTC end date.' };
    const range = { ...(from ? { from } : {}), ...(to ? { to } : {}) };
    return validateLogRange(range) ? { error: validateLogRange(range) } : { range };
  }

  const duration = PERIOD_MILLISECONDS[period];
  if (!duration || Number.isNaN(now.getTime())) return { error: 'Choose a valid log period.' };
  return { range: { from: new Date(now.getTime() - duration).toISOString() } };
}
