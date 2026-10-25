import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../../auth/context';
import { Badge, Button, EmptyState, PageHeader } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import ui from '../../ui/ui.module.css';
import { formatDateTime, formatNumber } from '../sources/format';
import { ACTIVE, FINISHED, listRuns, type RunStatus } from './api';
import styles from './runs.module.css';
import { MODE, STATUS } from './status';

const FILTERS: { id: string; label: string; statuses?: RunStatus[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'In progress', statuses: ACTIVE },
  { id: 'approval', label: 'Awaiting approval', statuses: ['awaiting_approval', 'approved'] },
  { id: 'draft', label: 'Drafts', statuses: ['draft'] },
  { id: 'finished', label: 'Finished', statuses: FINISHED },
];

export function RunsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS.find((f) => f.id === params.get('filter')) ?? FILTERS[0]!;
  const runs = useInfiniteQuery({
    queryKey: ['runs', filter.id],
    queryFn: ({ pageParam }) => listRuns({ statuses: filter.statuses }, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 10_000,
  });
  const rows = runs.data?.pages.flatMap((p) => p.data) ?? [];
  const canCreate = user?.role === 'operator' || user?.role === 'admin';

  return (
    <section aria-labelledby="runs-title">
      <PageHeader
        title="Runs"
        actions={
          canCreate && (
            <Link to="/runs/new" className={`${ui.button} ${ui.primary}`}>
              New run
            </Link>
          )
        }
      />
      <div className={styles.filters} role="group" aria-label="Show runs">
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            variant={f.id === filter.id ? 'primary' : 'secondary'}
            aria-pressed={f.id === filter.id}
            onClick={() => setParams(f.id === 'all' ? {} : { filter: f.id })}
          >
            {f.label}
          </Button>
        ))}
      </div>
      {runs.isPending && <Spinner label="Loading runs" />}
      {runs.isError && <ProblemMessage error={runs.error} title="Could not load runs" />}
      {runs.isSuccess && rows.length === 0 && <EmptyState>No runs here.</EmptyState>}
      {rows.length > 0 && (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Source and file</th>
                <th scope="col">Mode</th>
                <th scope="col">Status</th>
                <th scope="col">Rows</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link to={`/runs/${r.id}`} className={styles.runId}>
                      {r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>
                    {r.source.name}
                    <div className={ui.muted}>
                      {r.file.filename} · mapping v{r.mappingVersion}
                    </div>
                  </td>
                  <td>{MODE[r.mode]}</td>
                  <td>
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  </td>
                  <td>
                    {r.counts.total === undefined ? (
                      '—'
                    ) : (
                      <>
                        {formatNumber(r.counts.total)}
                        {r.status === 'completed' && (
                          <div className={ui.muted}>
                            {r.mode === 'production'
                              ? `${formatNumber(r.counts.loaded ?? 0)} loaded`
                              : `${formatNumber(r.counts.valid ?? 0)} valid`}
                            , {formatNumber(r.counts.quarantined ?? 0)} quarantined
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td>{formatDateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {runs.hasNextPage && (
        <p>
          <Button
            variant="secondary"
            onClick={() => runs.fetchNextPage()}
            disabled={runs.isFetchingNextPage}
          >
            {runs.isFetchingNextPage ? 'Loading…' : 'Show more'}
          </Button>
        </p>
      )}
    </section>
  );
}
