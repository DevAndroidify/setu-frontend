import { api } from '../../auth/session';
import type { Run } from '../runs/api';

export type Approval = {
  id: string;
  runId: string;
  requestedBy: string;
  decidedBy: string | null;
  decision: 'approved' | 'rejected' | null;
  reason: string | null;
  expiresAt: string;
  createdAt: string;
  decidedAt: string | null;
};

export const listApprovals = (runId: string) => api<Approval[]>(`/runs/${runId}/approvals`);

export const decide = (runId: string, decision: 'approved' | 'rejected', reason: string) =>
  api<Run>(`/runs/${runId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason }),
  });

export const rollback = (runId: string) => api<Run>(`/runs/${runId}/rollback`, { method: 'POST' });

/** The newest approval matching `test` (approvals come oldest first). */
export const latest = (
  approvals: Approval[],
  test: (a: Approval) => boolean,
): Approval | undefined => [...approvals].reverse().find(test);

/** The request still waiting for a decision, if any. */
export const pendingOf = (approvals: Approval[]): Approval | undefined =>
  latest(approvals, (a) => a.decision === null);

/**
 * Why this user may not decide, or null if they may. The maker (whoever created or submitted
 * the run) is never the checker; the backend refuses it too.
 */
export function cannotDecide(
  run: Pick<Run, 'createdBy'>,
  pending: Approval | undefined,
  userId: string,
): string | null {
  if (run.createdBy === userId) return 'You created this run, so someone else must approve it.';
  if (pending?.requestedBy === userId)
    return 'You submitted this run, so someone else must approve it.';
  return null;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "in 23 hours", "in 40 minutes", "2 hours ago". */
export function fromNow(iso: string, now = Date.now()): string {
  const minutes = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (Math.abs(minutes) < 90) return relative.format(minutes, 'minute');
  return relative.format(Math.round(minutes / 60), 'hour');
}
