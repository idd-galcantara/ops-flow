import type { LogEventRecord } from './types';

export type LogGrouping = 'application' | 'source';

export interface LogDisplayState {
  grouping: LogGrouping;
  wrapLines: boolean;
}

export const DEFAULT_LOG_DISPLAY_STATE: LogDisplayState = {
  grouping: 'application',
  wrapLines: true,
};

export function setWrapLines(state: LogDisplayState, wrapLines: boolean): LogDisplayState {
  return state.wrapLines === wrapLines ? state : { ...state, wrapLines };
}

export function logRecordKey(record: LogEventRecord): string {
  return `${record.event.sourceId}:${record.event.sequence}`;
}