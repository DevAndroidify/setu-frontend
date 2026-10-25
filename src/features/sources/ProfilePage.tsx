import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Alert, Badge, PageHeader } from '../../ui/controls';
import ui from '../../ui/ui.module.css';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import { type ColumnProfile, getProfile, listFiles } from './api';
import { columnFlags, formatNumber } from './format';
import styles from './sources.module.css';

const PATTERN_NOTE = '9 digit · ९ Devanagari digit · a Latin word · क Devanagari word';

function Column({ column }: { column: ColumnProfile }) {
  const flags = columnFlags(column);
  return (
    <tr className={flags.length ? styles.flagged : undefined}>
      <th scope="row">
        <code>{column.name}</code>
        {flags.length > 0 && (
          <ul className={styles.flags}>
            {flags.map((f) => (
              <li key={f.text}>
                <Badge tone={f.tone}>{f.text}</Badge>
              </li>
            ))}
          </ul>
        )}
      </th>
      <td>
        {formatNumber(column.filled)} filled
        <div className={ui.muted}>{column.emptyPct}% empty</div>
      </td>
      <td>
        {formatNumber(column.distinct)}
        {column.distinctCapped && '+'}
      </td>
      <td>
        <ol className={styles.values}>
          {column.topValues.map((v) => (
            <li key={v.value}>
              <span className={styles.value}>{v.value === '' ? '(empty)' : v.value}</span>{' '}
              <span className={ui.muted}>×{formatNumber(v.count)}</span>
            </li>
          ))}
        </ol>
      </td>
      <td>
        <ol className={styles.values}>
          {column.patterns.slice(0, 3).map((p) => (
            <li key={p.pattern}>
              <code>{p.pattern}</code> <span className={ui.muted}>×{formatNumber(p.count)}</span>
            </li>
          ))}
        </ol>
      </td>
      <td>
        {column.dateFormats.length > 0
          ? column.dateFormats.map((d) => (
              <div key={d.format}>
                <code>{d.format}</code> <span className={ui.muted}>×{formatNumber(d.count)}</span>
              </div>
            ))
          : column.numeric
            ? `${column.numeric.min} to ${column.numeric.max}`
            : column.length && `${column.length.min}–${column.length.max} chars`}
      </td>
    </tr>
  );
}

export function ProfilePage() {
  const { sourceId = '', fileId = '' } = useParams();
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const files = useQuery({
    queryKey: ['source-files', sourceId],
    queryFn: () => listFiles(sourceId),
  });
  const profile = useQuery({
    queryKey: ['profile', fileId],
    queryFn: () => getProfile(fileId),
    refetchInterval: (q) => (q.state.data === null ? 2000 : false), // still profiling
  });
  const file = files.data?.find((f) => f.id === fileId);

  return (
    <section aria-labelledby="profile-title">
      <p className={styles.crumbs}>
        <Link to="/sources">Sources</Link> / <Link to={`/sources/${sourceId}`}>Source</Link> /
      </p>
      <PageHeader title={file ? `Profile of ${file.filename}` : 'File profile'} />
      {profile.isPending && <Spinner label="Loading the profile" />}
      {profile.isError && (
        <ProblemMessage error={profile.error} title="Could not load the profile" />
      )}
      {profile.data === null && <Spinner label="The file is being profiled" />}
      {profile.data?.status === 'failed' && (
        <Alert kind="error">
          <p>
            <strong>The file could not be read as its format.</strong> {profile.data.error}
          </p>
          <p>Fix the export and upload it again; nothing from this file can be imported.</p>
        </Alert>
      )}
      {profile.data?.status === 'ok' &&
        (() => {
          const report = profile.data;
          const flagged = report.columns.filter((c) => columnFlags(c).length > 0);
          const shown = onlyFlagged ? flagged : report.columns;
          return (
            <>
              <dl className={styles.facts}>
                <div>
                  <dt>Rows</dt>
                  <dd>{formatNumber(report.rowCount)}</dd>
                </div>
                <div>
                  <dt>Columns</dt>
                  <dd>{report.columns.length}</dd>
                </div>
                <div>
                  <dt>Encoding</dt>
                  <dd>{report.encoding}</dd>
                </div>
                <div>
                  <dt>Columns needing attention</dt>
                  <dd>{flagged.length}</dd>
                </div>
                <div>
                  <dt>Rows with a different number of fields</dt>
                  <dd>{formatNumber(report.raggedRows)}</dd>
                </div>
              </dl>
              {report.raggedRows > 0 && (
                <Alert kind="warning">
                  <p>
                    {formatNumber(report.raggedRows)} rows have more or fewer fields than the
                    header. Their missing values will be empty.
                  </p>
                </Alert>
              )}
              <p>
                <label>
                  <input
                    type="checkbox"
                    checked={onlyFlagged}
                    onChange={(e) => setOnlyFlagged(e.target.checked)}
                  />{' '}
                  Show only columns needing attention
                </label>
              </p>
              <div className={ui.tableWrap}>
                <table className={ui.table}>
                  <caption className={styles.caption}>
                    Patterns: {PATTERN_NOTE}. Top values may contain personal data: do not copy them
                    out of Setu.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Column</th>
                      <th scope="col">Filled</th>
                      <th scope="col">Distinct</th>
                      <th scope="col">Top values</th>
                      <th scope="col">Patterns</th>
                      <th scope="col">Dates, numbers or length</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((c) => (
                      <Column key={c.name} column={c} />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
    </section>
  );
}
