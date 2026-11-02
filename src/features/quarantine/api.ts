import { api } from '../../auth/session';
import type { FieldIssue } from '../mappings/api';
import type { Page } from '../sources/api';

export type QuarantineStage = 'transform' | 'validate' | 'load';

export type QuarantineEntry = {
  id: string;
  runId: string;
  rowNo: number;
  stage: QuarantineStage;
  reasons: FieldIssue[];
  /** Exactly what the legacy file held. */
  raw: Record<string, string>;
  normalized: Record<string, string | null>;
  /** The operator's fix of some legacy columns, if any. */
  corrected: Record<string, string> | null;
  correctedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type CorrectionResult = {
  id: string;
  rowNo: number;
  corrected: Record<string, string>;
  result: {
    status: 'valid' | 'quarantined';
    values: Record<string, string | null>;
    warnings: FieldIssue[];
    errors: FieldIssue[];
  };
};

export type RetryResult = {
  retried: number;
  passed: number;
  stillFailing: number;
  reopened: boolean;
};

export const listQuarantine = (
  filter: { runId?: string; stage?: QuarantineStage },
  cursor?: string,
) => {
  const q = new URLSearchParams({ limit: '50' });
  if (filter.runId) q.set('runId', filter.runId);
  if (filter.stage) q.set('stage', filter.stage);
  if (cursor) q.set('cursor', cursor);
  return api<Page<QuarantineEntry>>(`/quarantine?${q}`);
};

export const getEntry = (id: string) => api<QuarantineEntry>(`/quarantine/${id}`);

export const correctEntry = (id: string, values: Record<string, string>) =>
  api<CorrectionResult>(`/quarantine/${id}`, { method: 'PATCH', body: JSON.stringify({ values }) });

export const retryRows = (runId: string, ids?: string[]) =>
  api<RetryResult>('/quarantine/retry', { method: 'POST', body: JSON.stringify({ runId, ids }) });

export const STAGE_LABELS: Record<QuarantineStage, string> = {
  transform: 'Could not be converted',
  validate: 'Failed a check',
  load: 'Refused when loading',
};

/** "2 rows fixed and placed; 1 still fails." */
export function retrySummary(r: RetryResult): string {
  if (r.retried === 0) return 'There were no corrected rows to retry.';
  const parts = [];
  if (r.passed)
    parts.push(`${r.passed} ${r.passed === 1 ? 'row passes' : 'rows pass'} and will be placed`);
  if (r.stillFailing)
    parts.push(`${r.stillFailing} still ${r.stillFailing === 1 ? 'fails' : 'fail'}`);
  return `${parts.join('; ')}.${r.reopened ? ' The run is reopened to place them.' : ''}`;
}
