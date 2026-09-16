import type { LogPeriod } from './types';
import type { LogRecordFilters } from './logsSession';

export interface LogSearchValues {
  period: LogPeriod;
  customFrom: string;
  customTo: string;
  follow: boolean;
  filters: LogRecordFilters;
}

export interface LogSearchState {
  draft: LogSearchValues;
  applied: LogSearchValues;
}

export type TransportSearchValues = Pick<LogSearchValues, 'period' | 'customFrom' | 'customTo' | 'follow'>;
export type LocalFilterSearchValues = LogRecordFilters;

export const EMPTY_LOG_FILTERS: LogRecordFilters = {
  pod: '',
  container: '',
  cluster: '',
  namespace: '',
  text: '',
};

export const DEFAULT_LOG_SEARCH_VALUES: LogSearchValues = {
  period: 'all',
  customFrom: '',
  customTo: '',
  follow: true,
  filters: EMPTY_LOG_FILTERS,
};

export function cloneLogSearchValues(values: LogSearchValues): LogSearchValues {
  return { ...values, filters: { ...values.filters } };
}

export function transportSearchValues(values: LogSearchValues): TransportSearchValues {
  const { period, customFrom, customTo, follow } = values;
  return { period, customFrom, customTo, follow };
}

export function localFilterSearchValues(values: LogSearchValues): LocalFilterSearchValues {
  return { ...values.filters };
}

export function searchValuesEqual(left: LogSearchValues, right: LogSearchValues): boolean {
  return (
    left.period === right.period &&
    left.customFrom === right.customFrom &&
    left.customTo === right.customTo &&
    left.follow === right.follow &&
    filterValuesEqual(left.filters, right.filters)
  );
}

export function transportSearchValuesEqual(left: LogSearchValues, right: LogSearchValues): boolean {
  return (
    left.period === right.period &&
    left.customFrom === right.customFrom &&
    left.customTo === right.customTo &&
    left.follow === right.follow
  );
}

export function filterValuesEqual(left: LogRecordFilters, right: LogRecordFilters): boolean {
  return left.pod === right.pod && left.container === right.container && left.cluster === right.cluster && left.namespace === right.namespace && left.text === right.text;
}

export function searchHasPendingChanges(state: LogSearchState): boolean {
  return !searchValuesEqual(state.draft, state.applied);
}

export function commitLogSearch(state: LogSearchState): LogSearchState {
  return { draft: cloneLogSearchValues(state.draft), applied: cloneLogSearchValues(state.draft) };
}