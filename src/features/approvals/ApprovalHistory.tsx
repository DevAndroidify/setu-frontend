import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../ui/controls';
import ui from '../../ui/ui.module.css';
import { formatDateTime } from '../sources/format';
import { listApprovals } from './api';
import styles from './approvals.module.css';

/** Every request and decision on a production run, oldest first, with each reason. */
export function ApprovalHistory({ runId }: { runId: string }) {
  const approvals = useQuery({
    queryKey: ['approvals', runId],
    queryFn: () => listApprovals(runId),
  });
  if (!approvals.data?.length) return null;
  return (
    <section aria-labelledby="history-title">
      <h2 id="history-title">Approval history</h2>
      <ol className={styles.history}>
        {approvals.data.map((a) => (
          <li key={a.id}>
            Submitted {formatDateTime(a.createdAt)}.{' '}
            {a.decision === null ? (
              <Badge tone="warning">waiting</Badge>
            ) : (
              <>
                <Badge tone={a.decision === 'approved' ? 'success' : 'danger'}>{a.decision}</Badge>
                {a.decidedAt && ` ${formatDateTime(a.decidedAt)}`}: <q>{a.reason}</q>
              </>
            )}
            <span className={ui.muted}>
              {' '}
              · {a.decision === 'approved' ? 'valid until' : 'expires'}{' '}
              {formatDateTime(a.expiresAt)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
