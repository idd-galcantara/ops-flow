import { resolveLogRange } from './logsRange';
import type { LogMode, LogPeriod, LogRange, LogSource } from './types';
import type { LogRecordFilters } from './logsSession';

export interface LogSearchValues {
  mode: LogMode;
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

export type LogSearchOperationKind = LogMode | 'local';

export interface LogSearchOperationSnapshot {
  requestId: number;
  values: LogSearchValues;
  range: LogRange;
  sources: LogSource[];
}

export type LogSearchActivationResult =
  | { accepted: false; reason: 'busy' | 'no-sources' | 'invalid-range'; error?: string }
  | {
      accepted: true;
      kind: LogSearchOperationKind;
      startsTransport: boolean;
      snapshot: LogSearchOperationSnapshot;
      nextState: LogSearchState;
    };

export type TransportSearchValues = Pick<LogSearchValues, 'mode' | 'period' | 'customFrom' | 'customTo' | 'follow'>;
export type LocalFilterSearchValues = LogRecordFilters;

export const EMPTY_LOG_FILTERS: LogRecordFilters = {
  pod: '',
  container: '',
  cluster: '',
  namespace: '',
  text: '',
};

export const DEFAULT_LOG_SEARCH_VALUES: LogSearchValues = {
  mode: 'live',
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
  const { mode, period, customFrom, customTo, follow } = values;
  return { mode, period, customFrom, customTo, follow };
}

export function localFilterSearchValues(values: LogSearchValues): LocalFilterSearchValues {
  return { ...values.filters };
}

export function searchValuesEqual(left: LogSearchValues, right: LogSearchValues): boolean {
  return (
    left.mode === right.mode &&
    left.period === right.period &&
    left.customFrom === right.customFrom &&
    left.customTo === right.customTo &&
    left.follow === right.follow &&
    filterValuesEqual(left.filters, right.filters)
  );
}

export function transportSearchValuesEqual(left: LogSearchValues, right: LogSearchValues): boolean {
  return (
    left.mode === right.mode &&
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

export function searchOperationKind(state: LogSearchState): LogSearchOperationKind {
  if (!transportSearchValuesEqual(state.applied, state.draft)) return state.draft.mode;
  return searchValuesEqual(state.applied, state.draft) ? state.applied.mode : 'local';
}

export function canAcceptSearchActivation(isBusy: boolean, sourceCount: number): boolean {
  return !isBusy && sourceCount > 0;
}

export function createLogSearchActivation(
  state: LogSearchState,
  options: { isBusy: boolean; sources: LogSource[]; now?: Date; requestId: number },
): LogSearchActivationResult {
  if (options.isBusy) return { accepted: false, reason: 'busy' };
  if (options.sources.length === 0) return { accepted: false, reason: 'no-sources' };
  const candidateRange = resolveLogRange(state.draft.period, options.now, { from: state.draft.customFrom, to: state.draft.customTo });
  if (candidateRange.error) return { accepted: false, reason: 'invalid-range', error: candidateRange.error };
  const kind = searchOperationKind(state);
  return {
    accepted: true,
    kind,
    startsTransport: kind !== 'local',
    snapshot: createLogSearchOperationSnapshot(state.draft, candidateRange.range ?? {}, options.sources, options.requestId),
    nextState: commitLogSearch(state),
  };
}

export function historySearchOperationComplete(terminalSeen: boolean, queryReadySeen: boolean): boolean {
  return terminalSeen && queryReadySeen;
}

export function logSearchOperationComplete(kind: LogSearchOperationKind, terminalSeen: boolean, queryReadySeen: boolean): boolean {
  return kind !== 'history' || historySearchOperationComplete(terminalSeen, queryReadySeen);
}

export function createLogSearchOperationSnapshot(
  values: LogSearchValues,
  range: LogRange,
  sources: LogSource[],
  requestId: number,
): LogSearchOperationSnapshot {
  return {
    requestId,
    values: cloneLogSearchValues(values),
    range: { ...range },
    sources: sources.map((source) => ({
      ...source,
      application: source.application ? { ...source.application } : undefined,
    })),
  };
}

export function commitLogSearch(state: LogSearchState): LogSearchState {
  return { draft: cloneLogSearchValues(state.draft), applied: cloneLogSearchValues(state.draft) };
}