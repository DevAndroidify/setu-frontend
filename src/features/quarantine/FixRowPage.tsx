import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../auth/context';
import { Alert, Badge, Button, PageHeader } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import { useToast } from '../../ui/toast-context';
import ui from '../../ui/ui.module.css';
import { getMapping } from '../mappings/api';
import { fieldLabel, valueKey } from '../mappings/spec';
import { getRun } from '../runs/api';
import { formatNumber } from '../sources/format';
import { correctEntry, getEntry, retryRows, retrySummary, STAGE_LABELS } from './api';
import styles from './quarantine.module.css';

/**
 * One quarantined row: its reasons next to the legacy columns behind them. The operator types
 * what the file should have held; "Check" stores the fix and shows how the row now maps, and
 * "Retry" sends it through the run again.
 */
export function FixRowPage() {
  const { entryId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useToast();
  const entry = useQuery({
    queryKey: ['quarantine-entry', entryId],
    queryFn: () => getEntry(entryId),
  });
  const run = useQuery({
    queryKey: ['run', entry.data?.runId],
    queryFn: () => getRun(entry.data!.runId),
    enabled: !!entry.data,
  });
  const mapping = useQuery({
    queryKey: ['mapping', run.data?.mappingId],
    queryFn: () => getMapping(run.data!.mappingId),
    enabled: !!run.data,
  });
  const [edits, setEdits] = useState<Record<string, string>>({});

  const check = useMutation({
    mutationFn: () => correctEntry(entryId, edits),
    onSuccess: async () => {
      setEdits({});
      await queryClient.invalidateQueries({ queryKey: ['quarantine-entry', entryId] });
    },
  });
  const retry = useMutation({
    mutationFn: () => retryRows(entry.data!.runId, [entryId]),
    onSuccess: async (result) => {
      notify(result.passed ? 'success' : 'info', retrySummary(result));
      await queryClient.invalidateQueries({ queryKey: ['quarantine'] });
      if (result.passed) navigate(`/quarantine?runId=${entry.data!.runId}`);
      else await queryClient.invalidateQueries({ queryKey: ['quarantine-entry', entryId] });
    },
  });

  if (entry.isPending) return <Spinner label="Loading the row" />;
  if (entry.isError) return <ProblemMessage error={entry.error} title="Could not load the row" />;
  const e = entry.data;
  const canFix = user?.role === 'operator' && !e.resolvedAt && run.data?.status === 'completed';

  // The legacy columns each failing field is read from, so they can be shown first.
  const failing = new Set(e.reasons.map((r) => r.field));
  const behind = new Set(
    (mapping.data?.spec.fields ?? [])
      .filter((f) => failing.has(valueKey(f.target)))
      .flatMap((f) => f.from),
  );
  const columns = Object.keys(e.raw).sort((a, b) => Number(behind.has(b)) - Number(behind.has(a)));
  const current = (column: string) => edits[column] ?? e.corrected?.[column] ?? e.raw[column] ?? '';

  function submit(event: FormEvent) {
    event.preventDefault();
    check.mutate();
  }

  const result = check.data?.result;
  return (
    <section aria-labelledby="fix-title">
      <p className={styles.crumbs}>
        <Link to={`/quarantine?runId=${e.runId}`}>Quarantine</Link> /
      </p>
      <PageHeader title={`Row ${formatNumber(e.rowNo)}`} />
      <p className={ui.muted}>
        {STAGE_LABELS[e.stage]} in <Link to={`/runs/${e.runId}`}>run {e.runId.slice(0, 8)}</Link>
        {run.data &&
          ` (${run.data.source.name}, ${run.data.file.filename}, mapping v${run.data.mappingVersion})`}
        .
      </p>
      {e.resolvedAt && (
        <Alert kind="success">
          <p>This row was fixed and placed.</p>
        </Alert>
      )}
      {run.data && run.data.status !== 'completed' && !e.resolvedAt && (
        <Alert kind="info">
          <p>
            Rows can be fixed once their run has completed (this one is{' '}
            {run.data.status.replace('_', ' ')}).
          </p>
        </Alert>
      )}
      <h2>Why</h2>
      <ul className={styles.reasons}>
        {e.reasons.map((r) => (
          <li key={`${r.field}:${r.message}`}>
            <strong>{fieldLabel(r.field)}</strong>: {r.message}
          </li>
        ))}
      </ul>

      <form onSubmit={submit} aria-labelledby="values-title">
        <h2 id="values-title">Legacy values</h2>
        <p className={ui.muted}>
          The file's row is never changed: your correction is kept beside it, and every fix is
          recorded in the run's audit trail (by column, not by value).
        </p>
        <table className={`${ui.table} ${styles.values}`}>
          <thead>
            <tr>
              <th scope="col">Column</th>
              <th scope="col">In the file</th>
              <th scope="col">Value to use</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => {
              const changed = current(column) !== (e.raw[column] ?? '');
              return (
                <tr key={column} className={behind.has(column) ? styles.behind : undefined}>
                  <th scope="row">
                    <code>{column}</code>
                    {behind.has(column) && (
                      <div className={styles.note}>behind a failing field</div>
                    )}
                  </th>
                  <td className={styles.raw}>
                    {e.raw[column] || <span className={ui.muted}>(empty)</span>}
                  </td>
                  <td>
                    {canFix ? (
                      <input
                        className={`${ui.input} ${changed ? styles.changed : ''}`}
                        aria-label={`Value to use for ${column}`}
                        value={current(column)}
                        onChange={(ev) => setEdits({ ...edits, [column]: ev.target.value })}
                      />
                    ) : (
                      current(column)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {check.isError && <ProblemMessage error={check.error} title="Not saved" />}
        {canFix && (
          <div className={styles.actions}>
            <Button
              type="submit"
              variant="secondary"
              disabled={Object.keys(edits).length === 0 || check.isPending}
            >
              {check.isPending ? 'Checking…' : 'Save fix and check'}
            </Button>
            <Button
              onClick={() => retry.mutate()}
              disabled={!e.corrected || Object.keys(edits).length > 0 || retry.isPending}
            >
              {retry.isPending ? 'Retrying…' : 'Retry this row'}
            </Button>
          </div>
        )}
      </form>
      {retry.isError && <ProblemMessage error={retry.error} title="Retry failed" />}

      {result && (
        <section aria-labelledby="check-title">
          <h2 id="check-title">With your fix</h2>
          {result.status === 'valid' ? (
            <Alert kind="success">
              <p>
                <Badge tone="success">passes</Badge> The row now maps cleanly. Retry it to place it.
              </p>
            </Alert>
          ) : (
            <Alert kind="error">
              <p>Still fails:</p>
              <ul>
                {result.errors.map((r) => (
                  <li key={`${r.field}:${r.message}`}>
                    <strong>{fieldLabel(r.field)}</strong>: {r.message}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          <dl className={styles.result}>
            {Object.entries(result.values)
              .filter(([, v]) => v !== null)
              .map(([field, value]) => (
                <div key={field}>
                  <dt>{fieldLabel(field)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}
    </section>
  );
}
