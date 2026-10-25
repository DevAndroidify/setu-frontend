import { useState } from 'react';
import { Badge } from '../../ui/controls';
import ui from '../../ui/ui.module.css';
import type { MappingSpec, Preview } from './api';
import styles from './mappings.module.css';
import { targetLabel, valueKey } from './spec';

/**
 * Each previewed row: per mapped field the normalized value, with what the legacy file held
 * underneath, and every error or warning in the cell it belongs to.
 */
export function PreviewTable({ preview, spec }: { preview: Preview; spec: MappingSpec }) {
  const [onlyProblems, setOnlyProblems] = useState(false);
  const rows = onlyProblems
    ? preview.rows.filter((r) => r.status === 'quarantined' || r.warnings.length)
    : preview.rows;
  const fields = spec.fields.filter((f) => f.target);

  return (
    <div>
      <p className={styles.summary} role="status">
        {preview.summary.rows} rows previewed:{' '}
        <Badge tone="success">{preview.summary.valid} valid</Badge>{' '}
        <Badge tone={preview.summary.quarantined ? 'danger' : 'neutral'}>
          {preview.summary.quarantined} would be quarantined
        </Badge>
      </p>
      <p>
        <label>
          <input
            type="checkbox"
            checked={onlyProblems}
            onChange={(e) => setOnlyProblems(e.target.checked)}
          />{' '}
          Show only rows with errors or warnings
        </label>
      </p>
      <div className={ui.tableWrap}>
        <table className={`${ui.table} ${styles.preview}`}>
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Result</th>
              {fields.map((f) => (
                <th scope="col" key={f.target}>
                  {targetLabel(f.target)}
                  <div className={ui.muted}>
                    from <code>{f.from.join(' + ') || '—'}</code>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowNo}>
                <th scope="row">{row.rowNo}</th>
                <td>
                  {row.status === 'valid' ? (
                    <Badge tone="success">valid</Badge>
                  ) : (
                    <Badge tone="danger">quarantine</Badge>
                  )}
                </td>
                {fields.map((f) => {
                  const key = valueKey(f.target);
                  const errors = row.errors.filter((e) => e.field === key);
                  const warnings = row.warnings.filter((w) => w.field === key);
                  const raw = f.from
                    .map((c) => row.raw[c] ?? '')
                    .join(' ')
                    .trim();
                  const value = row.values[key];
                  return (
                    <td
                      key={f.target}
                      className={
                        errors.length
                          ? styles.cellError
                          : warnings.length
                            ? styles.cellWarning
                            : undefined
                      }
                    >
                      <div className={styles.value}>
                        {value ?? <span className={ui.muted}>(empty)</span>}
                      </div>
                      {raw !== (value ?? '') && (
                        <div className={styles.raw}>was: {raw || '(empty)'}</div>
                      )}
                      {[...errors, ...warnings].map((issue) => (
                        <div key={issue.message} className={styles.issue}>
                          {issue.message}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
