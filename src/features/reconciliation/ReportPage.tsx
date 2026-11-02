import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { Alert, Badge, Button, PageHeader } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import ui from '../../ui/ui.module.css';
import { targetLabel } from '../mappings/spec';
import { getRun } from '../runs/api';
import { MODE } from '../runs/status';
import { formatNumber } from '../sources/format';
import { downloadReportCsv, getReport, type Report } from './api';
import styles from './reconciliation.module.css';

const label = (field: string) => targetLabel(`person.${field}`);

/** Every extracted row accounted for: the parts on the left must add up to the total. */
function Balance({ report }: { report: Report }) {
  const c = report.counts;
  const parts =
    report.mode === 'production'
      ? [
          ['Loaded', c.loaded],
          ['Linked', c.linked],
          ['Quarantined', c.quarantined],
          ['Held for review', c.pendingReview],
        ]
      : [
          ['Valid', c.valid],
          ['Quarantined', c.quarantined],
          ['Held for review', c.pendingReview],
        ];
  const sum = parts.reduce((a, [, n]) => a + (n as number), 0);
  return (
    <div className={styles.balance} aria-label="Row balance">
      {parts.map(([name, n], i) => (
        <span key={name as string} className={styles.term}>
          {i > 0 && <span className={styles.op}>+</span>}
          <span>
            <strong>{formatNumber(n as number)}</strong>
            <span className={ui.muted}>{name}</span>
          </span>
        </span>
      ))}
      <span className={styles.op}>=</span>
      <span>
        <strong>{formatNumber(sum)}</strong>
        <span className={ui.muted}>accounted for</span>
      </span>
      <span className={styles.op}>{c.balanced ? '=' : '≠'}</span>
      <span>
        <strong>{formatNumber(c.extracted)}</strong>
        <span className={ui.muted}>
          extracted{c.profiled !== null && ` (profile counted ${formatNumber(c.profiled)})`}
        </span>
      </span>
    </div>
  );
}

/** The proof a run did what it should: counts that balance, matching checksums, a sampled diff. */
export function ReportPage() {
  const { runId = '' } = useParams();
  const run = useQuery({ queryKey: ['run', runId], queryFn: () => getRun(runId) });
  const report = useQuery({ queryKey: ['report', runId], queryFn: () => getReport(runId) });
  const download = useMutation({ mutationFn: () => downloadReportCsv(runId) });

  if (report.isPending) return <Spinner label="Loading the report" />;
  if (report.isError) return <ProblemMessage error={report.error} title="No report" />;
  const r = report.data;

  return (
    <section aria-labelledby="report-title">
      <p className={styles.crumbs}>
        <Link to="/reports">Reports</Link> /{' '}
        <Link to={`/runs/${runId}`}>Run {runId.slice(0, 8)}</Link> /
      </p>
      <PageHeader
        title="Reconciliation report"
        actions={
          <Button
            variant="secondary"
            onClick={() => download.mutate()}
            disabled={download.isPending}
          >
            {download.isPending ? 'Preparing…' : 'Download CSV'}
          </Button>
        }
      />
      {run.data && (
        <p className={ui.muted}>
          {MODE[r.mode]} of {run.data.file.filename} ({run.data.source.name}), mapping version{' '}
          {run.data.mappingVersion}
        </p>
      )}
      {download.isError && <ProblemMessage error={download.error} title="Could not download" />}
      {r.ok ? (
        <Alert kind="success">
          <p>
            <strong>Reconciled.</strong> Every row is accounted for
            {r.mode === 'production' &&
              ', every loaded column matches its source and the sample agrees'}
            .
          </p>
        </Alert>
      ) : (
        <Alert kind="error">
          <p>
            <strong>Problems found:</strong>
          </p>
          <ul>
            {r.counts.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      )}

      <h2>Rows</h2>
      <Balance report={r} />

      {r.checksums && (
        <>
          <h2>Column checksums</h2>
          <p className={ui.muted}>
            For each loaded column, a hash of all its values as staging prepared them and as the
            register now holds them. Equal hashes mean the column arrived unchanged.
          </p>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th scope="col">Column</th>
                  <th scope="col">Source</th>
                  <th scope="col">Register</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {r.checksums.map((c) => (
                  <tr key={c.field}>
                    <th scope="row">{label(c.field)}</th>
                    <td>
                      <code className={styles.hash}>{c.source.slice(0, 16)}…</code>
                    </td>
                    <td>
                      <code className={styles.hash}>{c.target.slice(0, 16)}…</code>
                    </td>
                    <td>
                      {c.match ? (
                        <Badge tone="success">match</Badge>
                      ) : (
                        <Badge tone="danger">differs</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {r.sample && (
        <>
          <h2>Sample check</h2>
          <p>
            {formatNumber(r.sample.size)} rows chosen at random (the same rows every time for this
            run) were compared field by field:{' '}
            {r.sample.mismatches.length === 0 ? (
              <strong>no differences.</strong>
            ) : (
              <strong>{r.sample.mismatches.length} differences.</strong>
            )}
          </p>
          {r.sample.mismatches.length > 0 && (
            <table className={ui.table}>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Field</th>
                  <th scope="col">Source</th>
                  <th scope="col">Register</th>
                </tr>
              </thead>
              <tbody>
                {r.sample.mismatches.map((m) => (
                  <tr key={`${m.rowNo}-${m.field}`}>
                    <td>{m.rowNo}</td>
                    <td>{label(m.field)}</td>
                    <td>{m.source ?? '(empty)'}</td>
                    <td>{m.target ?? '(missing)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      {!r.checksums && (
        <p className={ui.muted}>
          A dry run loads nothing, so there are no checksums or sample to compare.
        </p>
      )}
    </section>
  );
}
