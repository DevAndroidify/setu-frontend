import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useAuth } from '../../auth/context';
import { listApprovals, pendingOf } from '../approvals/api';
import { ApprovalHistory } from '../approvals/ApprovalHistory';
import { DecisionControls } from '../approvals/DecisionControls';
import { RollbackControl } from '../approvals/RollbackControl';
import { Alert, Badge, Button, PageHeader } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import { useToast } from '../../ui/toast-context';
import { formatDateTime, formatNumber } from '../sources/format';
import { type RunAction, runAction, type RunDetail } from './api';
import styles from './runs.module.css';
import ui from '../../ui/ui.module.css';
import {
  ACTION_LABELS,
  availableActions,
  completion,
  MODE,
  STAGE_LABELS,
  STAGES,
  STATUS,
} from './status';
import { useLiveRun } from './useLiveRun';

function Stages({ run }: { run: RunDetail }) {
  const batches = run.progress.batches;
  return (
    <ol className={styles.stages} aria-label="Batches by stage">
      {STAGES.filter((s) => s !== 'match' || run.mode === 'production').map((stage) => (
        <li key={stage} className={batches[stage] ? styles.stageBusy : undefined}>
          <span className={styles.stageCount}>{batches[stage] ?? 0}</span>
          <span>{STAGE_LABELS[stage]}</span>
        </li>
      ))}
    </ol>
  );
}

function Outcomes({ run }: { run: RunDetail }) {
  const p = run.progress;
  const items =
    run.mode === 'production'
      ? [
          { label: 'Loaded as new records', value: p.loaded, tone: 'success' as const },
          { label: 'Linked to an existing record', value: p.linked, tone: 'success' as const },
          {
            label: 'Held for duplicate review',
            value: p.duplicate_review,
            tone: 'warning' as const,
          },
          { label: 'Quarantined', value: p.quarantined, tone: 'danger' as const },
          { label: 'Valid, not loaded yet', value: p.valid, tone: 'neutral' as const },
        ]
      : [
          { label: 'Valid', value: p.valid, tone: 'success' as const },
          { label: 'Quarantined', value: p.quarantined, tone: 'danger' as const },
        ];
  return (
    <dl className={styles.outcomes}>
      {items.map((i) => (
        <div key={i.label} className={styles[`outcome-${i.tone}`]}>
          <dt>{i.label}</dt>
          <dd>{formatNumber(i.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RunPage() {
  const { runId = '' } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const notify = useToast();
  const run = useLiveRun(runId);
  const approvals = useQuery({
    queryKey: ['approvals', runId],
    queryFn: () => listApprovals(runId),
    enabled: run.data?.mode === 'production',
  });
  const act = useMutation({
    mutationFn: (action: RunAction) => runAction(runId, action),
    onSuccess: async (_r, action) => {
      notify('success', `${ACTION_LABELS[action]}: done.`);
      await queryClient.invalidateQueries({ queryKey: ['run', runId] });
      await queryClient.invalidateQueries({ queryKey: ['runs'] });
    },
  });

  if (run.isPending) return <Spinner label="Loading the run" />;
  if (run.isError) return <ProblemMessage error={run.error} title="Could not load the run" />;
  const r = run.data;
  const done = completion(r);
  const actions = user ? availableActions(r, user.role) : [];
  const role = user?.role;
  const canRollBack =
    role === 'approver' &&
    r.mode === 'production' &&
    ['completed', 'cancelled', 'failed'].includes(r.status);
  const hasReport = role === 'auditor' && (r.status === 'completed' || r.status === 'rolled_back');

  return (
    <section aria-labelledby="run-title">
      <p className={styles.crumbs}>
        <Link to="/runs">Runs</Link> /
      </p>
      <PageHeader
        title={`${MODE[r.mode]} of ${r.file.filename}`}
        actions={
          <span className={styles.actions}>
            {hasReport && (
              <Link className={`${ui.button} ${ui.primary}`} to={`/runs/${r.id}/reconciliation`}>
                Reconciliation report
              </Link>
            )}
            {canRollBack && <RollbackControl run={r} />}
            {actions.map((a) => (
              <Button
                key={a}
                variant={a === 'cancel' ? 'secondary' : 'primary'}
                disabled={act.isPending}
                onClick={() => act.mutate(a)}
              >
                {ACTION_LABELS[a]}
              </Button>
            ))}
          </span>
        }
      />
      <p className={styles.statusLine}>
        <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
        {run.live && <span className={styles.live}>● Live</span>}
      </p>
      {act.isError && <ProblemMessage error={act.error} title="That did not work" />}
      {r.status === 'awaiting_approval' && role !== 'approver' && (
        <Alert kind="info">
          <p>Waiting for an approver. It cannot be approved by whoever created or submitted it.</p>
        </Alert>
      )}
      {r.status === 'awaiting_approval' && role === 'approver' && approvals.data && (
        <section aria-label="Decision" className={styles.decision}>
          <p>This production run is waiting for your decision.</p>
          <DecisionControls run={r} pending={pendingOf(approvals.data)} />
        </section>
      )}
      {r.status === 'rolled_back' && (
        <Alert kind="info">
          <p>Rolled back: the records it loaded were removed. Its report and audit trail remain.</p>
        </Alert>
      )}
      {r.status === 'approved' && (
        <Alert kind="success">
          <p>Approved. Start it within 24 hours, or the approval expires.</p>
        </Alert>
      )}
      {r.status === 'failed' && (
        <Alert kind="error">
          <p>
            The run failed. Its audit trail has the reason; rows already loaded stay until the run
            is rolled back.
          </p>
        </Alert>
      )}

      <dl className={styles.facts}>
        <div>
          <dt>Source</dt>
          <dd>
            <Link to={`/sources/${r.source.id}`}>{r.source.name}</Link>
          </dd>
        </div>
        <div>
          <dt>Mapping</dt>
          <dd>
            <Link to={`/sources/${r.source.id}/mappings/${r.mappingId}`}>
              Version {r.mappingVersion}
            </Link>
          </dd>
        </div>
        <div>
          <dt>Rows in the file</dt>
          <dd>
            {r.counts.total !== undefined
              ? formatNumber(r.counts.total)
              : r.file.rowCount !== null
                ? formatNumber(r.file.rowCount)
                : '—'}
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(r.createdAt)}</dd>
        </div>
        {r.startedAt && (
          <div>
            <dt>Started</dt>
            <dd>{formatDateTime(r.startedAt)}</dd>
          </div>
        )}
        {r.finishedAt && (
          <div>
            <dt>Finished</dt>
            <dd>{formatDateTime(r.finishedAt)}</dd>
          </div>
        )}
      </dl>

      <section aria-labelledby="progress-title">
        <h2 id="progress-title">Progress</h2>
        {done !== null && (
          <div className={styles.bar}>
            <progress value={done} max={1} aria-label="Batches done" />
            <span>{Math.round(done * 100)}% of batches done</span>
          </div>
        )}
        <Stages run={r} />
        <Outcomes run={r} />
      </section>
      {r.mode === 'production' && <ApprovalHistory runId={r.id} />}
    </section>
  );
}
