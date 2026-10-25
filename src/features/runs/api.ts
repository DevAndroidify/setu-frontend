import { ApiError, apiPath } from '../../api/client';
import { api, currentToken } from '../../auth/session';
import type { Page, SourceKind } from '../sources/api';

export type RunStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'queued'
  | 'running'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export type RunMode = 'dry_run' | 'production';

export type RunCounts = {
  total?: number;
  loaded?: number;
  linked?: number;
  quarantined?: number;
  review?: number;
  valid?: number;
};

export type Run = {
  id: string;
  sourceFileId: string;
  mappingId: string;
  mode: RunMode;
  status: RunStatus;
  counts: RunCounts;
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  file: { id: string; filename: string; rowCount: number | null };
  source: { id: string; name: string; kind: SourceKind };
  mappingVersion: number;
};

export type BatchStage = 'extract' | 'transform' | 'validate' | 'match' | 'load' | 'done';

/** GET /runs/:id: the run and its live progress, read from staging. */
export type RunDetail = Run & {
  progress: {
    valid: number;
    quarantined: number;
    duplicate_review: number;
    loaded: number;
    linked: number;
    batches: Partial<Record<BatchStage, number>>;
  };
};

export const ACTIVE: RunStatus[] = ['queued', 'running', 'paused'];
export const FINISHED: RunStatus[] = ['completed', 'failed', 'cancelled', 'rolled_back'];

export const listRuns = (
  filter: { statuses?: RunStatus[]; sourceId?: string },
  cursor?: string,
) => {
  const q = new URLSearchParams({ limit: '25' });
  if (filter.statuses?.length) q.set('status', filter.statuses.join(','));
  if (filter.sourceId) q.set('sourceId', filter.sourceId);
  if (cursor) q.set('cursor', cursor);
  return api<Page<Run>>(`/runs?${q}`);
};

export const getRun = (id: string) => api<RunDetail>(`/runs/${id}`);

export const createRun = (input: { sourceFileId: string; mappingId: string; mode: RunMode }) =>
  api<Run>('/runs', { method: 'POST', body: JSON.stringify(input) });

export type RunAction = 'start' | 'submit' | 'pause' | 'resume' | 'cancel';

export const runAction = (id: string, action: RunAction) =>
  api<Run>(`/runs/${id}/${action}`, { method: 'POST' });

/**
 * Follows GET /runs/:id/events (Server-Sent Events) with fetch, because EventSource cannot send
 * the Authorization header. Calls `onStatus` with each status the server sends; resolves when
 * the server ends the stream (the run finished) or `signal` aborts.
 */
export async function followRun(
  id: string,
  onStatus: (run: RunDetail) => void,
  signal: AbortSignal,
): Promise<void> {
  const token = await currentToken();
  const res = await fetch(apiPath(`/runs/${id}/events`), {
    headers: {
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'same-origin',
    signal,
  });
  if (!res.ok || !res.body) {
    throw new ApiError(
      res.status,
      res.statusText || 'Error',
      'Live progress is not available',
      [],
      res.headers.get('x-request-id'),
    );
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    // Events are separated by a blank line; each has one or more "data:" lines.
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data) onStatus(JSON.parse(data) as RunDetail);
    }
  }
}
