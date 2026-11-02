import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../../auth/context';
import { Badge, Button, EmptyState, PageHeader, SelectField } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import { useToast } from '../../ui/toast-context';
import ui from '../../ui/ui.module.css';
import { fieldLabel } from '../mappings/spec';
import { listRuns } from '../runs/api';
import { MODE } from '../runs/status';
import { formatNumber } from '../sources/format';
import { listQuarantine, type QuarantineStage, retryRows, retrySummary, STAGE_LABELS } from './api';
import styles from './quarantine.module.css';

export function QuarantinePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const notify = useToast();
  const [params, setParams] = useSearchParams();
  const runId = params.get('runId') ?? '';
  const stage = (params.get('stage') ?? '') as QuarantineStage | '';
  const canFix = user?.role === 'operator';

  const runs = useQuery({
    queryKey: ['runs', 'completed'],
    queryFn: () => listRuns({ statuses: ['completed'] }),
  });
  const entries = useInfiniteQuery({
    queryKey: ['quarantine', runId, stage],
    queryFn: ({ pageParam }) =>
      listQuarantine({ runId: runId || undefined, stage: stage || undefined }, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = entries.data?.pages.flatMap((p) => p.data) ?? [];
  const corrected = rows.filter((r) => r.corrected);

  const retry = useMutation({
    mutationFn: () => retryRows(runId),
    onSuccess: async (result) => {
      notify(result.stillFailing ? 'info' : 'success', retrySummary(result));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['quarantine'] }),
        queryClient.invalidateQueries({ queryKey: ['run', runId] }),
        queryClient.invalidateQueries({ queryKey: ['runs'] }),
      ]);
    },
  });

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <section aria-labelledby="quarantine-title">
      <PageHeader title="Quarantine" />
      <p className={ui.muted}>
        Rows a run could not place, with every reason. Correct a row's legacy values and retry it:
        it goes through the run's mapping again and, if it passes, is placed like any other row.
      </p>
      <div className={styles.filters}>
        <SelectField label="Run" value={runId} onChange={(e) => set('runId', e.target.value)}>
          <option value="">All runs</option>
          {runs.data?.data.map((r) => (
            <option key={r.id} value={r.id}>
              {r.source.name}: {MODE[r.mode].toLowerCase()} of {r.file.filename} ({r.id.slice(0, 8)}
              )
            </option>
          ))}
        </SelectField>
        <SelectField label="Why" value={stage} onChange={(e) => set('stage', e.target.value)}>
          <option value="">Any reason</option>
          {Object.entries(STAGE_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </SelectField>
        {canFix && runId && (
          <Button
            onClick={() => retry.mutate()}
            disabled={corrected.length === 0 || retry.isPending}
          >
            {retry.isPending
              ? 'Retrying…'
              : `Retry corrected rows${corrected.length ? ` (${corrected.length})` : ''}`}
          </Button>
        )}
      </div>
      {retry.isError && <ProblemMessage error={retry.error} title="Retry failed" />}
      {entries.isPending && <Spinner label="Loading quarantined rows" />}
      {entries.isError && (
        <ProblemMessage error={entries.error} title="Could not load the quarantine" />
      )}
      {entries.isSuccess && rows.length === 0 && (
        <EmptyState>Nothing is quarantined here.</EmptyState>
      )}
      {rows.length > 0 && (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th scope="col">Row</th>
                {!runId && <th scope="col">Run</th>}
                <th scope="col">Why</th>
                <th scope="col">Reasons</th>
                <th scope="col">Fix</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/quarantine/${e.id}`}>Row {formatNumber(e.rowNo)}</Link>
                  </td>
                  {!runId && (
                    <td>
                      <Link to={`/runs/${e.runId}`} className={styles.mono}>
                        {e.runId.slice(0, 8)}
                      </Link>
                    </td>
                  )}
                  <td>{STAGE_LABELS[e.stage]}</td>
                  <td>
                    <ul className={styles.reasons}>
                      {e.reasons.map((r) => (
                        <li key={`${r.field}:${r.message}`}>
                          <strong>{fieldLabel(r.field)}</strong>: {r.message}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    {e.corrected ? (
                      <Badge tone="warning">corrected, not retried</Badge>
                    ) : (
                      <span className={ui.muted}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {entries.hasNextPage && (
        <p>
          <Button
            variant="secondary"
            onClick={() => entries.fetchNextPage()}
            disabled={entries.isFetchingNextPage}
          >
            Show more
          </Button>
        </p>
      )}
    </section>
  );
}
