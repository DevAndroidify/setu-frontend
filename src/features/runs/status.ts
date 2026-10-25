import type { Role } from '../../auth/session';
import type { RunAction, RunDetail, RunMode, RunStatus } from './api';

export const STATUS: Record<
  RunStatus,
  { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  awaiting_approval: { label: 'Awaiting approval', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'warning' },
  paused: { label: 'Paused', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  rolled_back: { label: 'Rolled back', tone: 'neutral' },
};

export const MODE: Record<RunMode, string> = { dry_run: 'Dry run', production: 'Production' };

export const ACTION_LABELS: Record<RunAction, string> = {
  start: 'Start',
  submit: 'Submit for approval',
  pause: 'Pause',
  resume: 'Resume',
  cancel: 'Cancel run',
};

/**
 * What this user can do with the run now, matching the backend's state machine and role
 * guards: a production run needs approval before it starts; only operators submit.
 */
export function availableActions(run: Pick<RunDetail, 'status' | 'mode'>, role: Role): RunAction[] {
  const operates = role === 'operator' || role === 'admin';
  if (!operates) return [];
  const actions: RunAction[] = [];
  if (run.status === 'draft' && run.mode === 'dry_run') actions.push('start');
  if (run.status === 'draft' && run.mode === 'production' && role === 'operator')
    actions.push('submit');
  if (run.status === 'approved') actions.push('start');
  if (run.status === 'queued' || run.status === 'running') actions.push('pause');
  if (run.status === 'paused') actions.push('resume');
  if (
    ['draft', 'awaiting_approval', 'approved', 'queued', 'running', 'paused'].includes(run.status)
  ) {
    actions.push('cancel');
  }
  return actions;
}

export const STAGES = ['extract', 'transform', 'validate', 'match', 'load', 'done'] as const;
export const STAGE_LABELS: Record<(typeof STAGES)[number], string> = {
  extract: 'Reading',
  transform: 'Transforming',
  validate: 'Validating',
  match: 'Matching',
  load: 'Loading',
  done: 'Done',
};

/** Rows that have reached a final place (or, in a dry run, passed validation). */
export function rowsSettled(run: RunDetail): number {
  const p = run.progress;
  const base = p.quarantined + p.duplicate_review + p.loaded + p.linked;
  return run.mode === 'dry_run' ? base + p.valid : base;
}

/** Share of the work done, 0..1, or null while the total is not known yet. */
export function completion(run: RunDetail): number | null {
  if (run.status === 'completed') return 1;
  const batches = Object.values(run.progress.batches).reduce((a, b) => a + (b ?? 0), 0);
  if (batches === 0) return run.counts.total === undefined ? null : 0;
  return (run.progress.batches.done ?? 0) / batches;
}
