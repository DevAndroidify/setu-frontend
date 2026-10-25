import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button, EmptyState, PageHeader } from '../../ui/controls';
import ui from '../../ui/ui.module.css';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import { KINDS, listSources } from './api';
import { formatDateTime } from './format';

export function SourcesPage() {
  const sources = useInfiniteQuery({
    queryKey: ['sources'],
    queryFn: ({ pageParam }) => listSources(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = sources.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <section aria-labelledby="sources-title">
      <PageHeader
        title="Sources"
        actions={
          <Link to="/sources/new" className={`${ui.button} ${ui.primary}`}>
            New source
          </Link>
        }
      />
      <p className={ui.muted}>
        A source is one legacy system, for example a ward office's household register. Each can have
        several files uploaded over time.
      </p>
      {sources.isPending && <Spinner label="Loading sources" />}
      {sources.isError && <ProblemMessage error={sources.error} title="Could not load sources" />}
      {sources.isSuccess && rows.length === 0 && (
        <EmptyState>
          No sources yet. <Link to="/sources/new">Register the first one</Link>.
        </EmptyState>
      )}
      {rows.length > 0 && (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Kind</th>
                <th scope="col">Agency</th>
                <th scope="col">Files</th>
                <th scope="col">Registered</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/sources/${s.id}`}>{s.name}</Link>
                  </td>
                  <td>{KINDS[s.kind].label}</td>
                  <td>{s.agency}</td>
                  <td>{s.fileCount}</td>
                  <td>{formatDateTime(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sources.hasNextPage && (
        <p>
          <Button
            variant="secondary"
            onClick={() => sources.fetchNextPage()}
            disabled={sources.isFetchingNextPage}
          >
            {sources.isFetchingNextPage ? 'Loading…' : 'Show more'}
          </Button>
        </p>
      )}
    </section>
  );
}
