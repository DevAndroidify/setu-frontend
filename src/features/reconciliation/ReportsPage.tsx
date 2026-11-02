import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Badge, Button, EmptyState, PageHeader } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import ui from '../../ui/ui.module.css';
import { listRuns } from '../runs/api';
import { MODE, STATUS } from '../runs/status';
import { formatDateTime, formatNumber } from '../sources/format';

/** For auditors: every run that reached the end and so has a reconciliation report. */
export function ReportsPage() {
  const runs = useInfiniteQuery({
    queryKey: ['runs', 'reports'],
    queryFn: ({ pageParam }) => listRuns({ statuses: ['completed', 'rolled_back'] }, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = runs.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <section aria-labelledby="reports-title">
      <PageHeader title="Reconciliation reports" />
      <p className={ui.muted}>
        Each completed run proves it accounted for every row; production runs also prove each loaded
        column arrived unchanged.
      </p>
      {runs.isPending && <Spinner label="Loading reports" />}
      {runs.isError && <ProblemMessage error={runs.error} title="Could not load reports" />}
      {runs.isSuccess && rows.length === 0 && <EmptyState>No run has completed yet.</EmptyState>}
      {rows.length > 0 && (
        <table className={ui.table}>
          <thead>
            <tr>
              <th scope="col">Report</th>
              <th scope="col">Source and file</th>
              <th scope="col">Mode</th>
              <th scope="col">Rows</th>
              <th scope="col">Finished</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/runs/${r.id}/reconciliation`}>Run {r.id.slice(0, 8)}</Link>{' '}
                  {r.status === 'rolled_back' && <Badge>{STATUS.rolled_back.label}</Badge>}
                </td>
                <td>
                  {r.source.name}
                  <div className={ui.muted}>
                    {r.file.filename} · mapping v{r.mappingVersion}
                  </div>
                </td>
                <td>{MODE[r.mode]}</td>
                <td>{r.counts.total !== undefined ? formatNumber(r.counts.total) : '—'}</td>
                <td>{r.finishedAt ? formatDateTime(r.finishedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {runs.hasNextPage && (
        <p>
          <Button
            variant="secondary"
            onClick={() => runs.fetchNextPage()}
            disabled={runs.isFetchingNextPage}
          >
            Show more
          </Button>
        </p>
      )}
    </section>
  );
}
