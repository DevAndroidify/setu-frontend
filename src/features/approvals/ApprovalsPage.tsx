import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Badge, EmptyState, PageHeader } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import ui from '../../ui/ui.module.css';
import { formatDateTime, formatNumber } from '../sources/format';
import { listRuns, type Run } from '../runs/api';
import { fromNow, latest, listApprovals, pendingOf } from './api';
import styles from './approvals.module.css';
import { DecisionControls } from './DecisionControls';

/**
 * The evidence for a decision: the latest completed dry run of the same file with the same
 * mapping version, which shows what this production run will load.
 */
function DryRunEvidence({ run }: { run: Run }) {
  const dryRuns = useQuery({
    queryKey: ['runs', 'evidence', run.source.id],
    queryFn: () => listRuns({ statuses: ['completed'], sourceId: run.source.id }),
  });
  if (dryRuns.isPending) return <Spinner label="Looking for its dry run" />;
  const match = dryRuns.data?.data.find(
    (r) =>
      r.mode === 'dry_run' && r.sourceFileId === run.sourceFileId && r.mappingId === run.mappingId,
  );
  if (!match) {
    return (
      <p className={styles.warning}>
        <Badge tone="warning">No dry run</Badge> This file has not been dry-run with this mapping
        version.
      </p>
    );
  }
  const c = match.counts;
  const rate = c.total ? Math.round(((c.quarantined ?? 0) / c.total) * 100) : 0;
  return (
    <p>
      <Link to={`/runs/${match.id}`}>Dry run</Link> of {formatNumber(c.total ?? 0)} rows:{' '}
      <strong>{formatNumber(c.valid ?? 0)} valid</strong>, {formatNumber(c.quarantined ?? 0)}{' '}
      quarantined ({rate}%).
    </p>
  );
}

function ApprovalCard({ run }: { run: Run }) {
  const approvals = useQuery({
    queryKey: ['approvals', run.id],
    queryFn: () => listApprovals(run.id),
  });
  const pending = approvals.data ? pendingOf(approvals.data) : undefined;
  const approved = approvals.data && latest(approvals.data, (a) => a.decision === 'approved');
  return (
    <article className={styles.card} aria-labelledby={`run-${run.id}`}>
      <header className={styles.cardHead}>
        <h2 id={`run-${run.id}`}>
          <Link to={`/runs/${run.id}`}>{run.source.name}</Link>
        </h2>
        <Badge tone={run.status === 'approved' ? 'success' : 'warning'}>
          {run.status === 'approved' ? 'Approved, not started' : 'Awaiting approval'}
        </Badge>
      </header>
      <p className={ui.muted}>
        {run.file.filename}
        {run.file.rowCount !== null && ` · ${formatNumber(run.file.rowCount)} rows`} · mapping
        version {run.mappingVersion} · created {formatDateTime(run.createdAt)}
      </p>
      <DryRunEvidence run={run} />
      {run.status === 'awaiting_approval' && pending && (
        <p className={ui.muted}>
          Submitted {fromNow(pending.createdAt)}; the request expires {fromNow(pending.expiresAt)}.
        </p>
      )}
      {run.status === 'approved' && approved && (
        <p className={ui.muted}>
          Approved {approved.decidedAt ? fromNow(approved.decidedAt) : ''}: “{approved.reason}”.
          Must start {fromNow(approved.expiresAt)}.
        </p>
      )}
      {run.status === 'awaiting_approval' && approvals.data && (
        <DecisionControls run={run} pending={pending} />
      )}
    </article>
  );
}

/** The approver's queue: production runs waiting for a decision, then approved ones not started. */
export function ApprovalsPage() {
  const runs = useQuery({
    queryKey: ['runs', 'approvals'],
    queryFn: () => listRuns({ statuses: ['awaiting_approval', 'approved'] }),
    refetchInterval: 15_000,
  });
  const waiting = runs.data?.data.filter((r) => r.status === 'awaiting_approval') ?? [];
  const approved = runs.data?.data.filter((r) => r.status === 'approved') ?? [];

  return (
    <section aria-labelledby="approvals-title">
      <PageHeader title="Approvals" />
      <p className={ui.muted}>
        A production run loads records into the register, so a second person approves it first.
        Check its dry run, then approve or reject with a reason. Requests and approvals expire after
        24 hours.
      </p>
      {runs.isPending && <Spinner label="Loading runs waiting for approval" />}
      {runs.isError && <ProblemMessage error={runs.error} title="Could not load the queue" />}
      {runs.isSuccess && (
        <>
          <h2 className={styles.group}>Waiting for a decision ({waiting.length})</h2>
          {waiting.length === 0 && <EmptyState>Nothing is waiting for approval.</EmptyState>}
          {waiting.map((r) => (
            <ApprovalCard key={r.id} run={r} />
          ))}
          {approved.length > 0 && (
            <>
              <h2 className={styles.group}>Approved, not started yet ({approved.length})</h2>
              {approved.map((r) => (
                <ApprovalCard key={r.id} run={r} />
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}
