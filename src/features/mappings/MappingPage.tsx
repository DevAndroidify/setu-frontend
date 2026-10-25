import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button, PageHeader, SelectField } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import ui from '../../ui/ui.module.css';
import { getSource, listFiles } from '../sources/api';
import { formatDateTime } from '../sources/format';
import { getMapping, previewMapping } from './api';
import styles from './mappings.module.css';
import { PreviewTable } from './PreviewTable';
import { describeField, targetLabel } from './spec';

/** A saved mapping version: read-only, previewable, and the starting point for a run. */
export function MappingPage() {
  const { sourceId = '', mappingId = '' } = useParams();
  const source = useQuery({ queryKey: ['source', sourceId], queryFn: () => getSource(sourceId) });
  const mapping = useQuery({
    queryKey: ['mapping', mappingId],
    queryFn: () => getMapping(mappingId),
  });
  const files = useQuery({
    queryKey: ['source-files', sourceId],
    queryFn: () => listFiles(sourceId),
  });
  const readable = (files.data ?? []).filter((f) => f.profileStatus === 'ok');
  const [fileId, setFileId] = useState('');
  const chosen = fileId || readable[0]?.id || '';
  const preview = useMutation({ mutationFn: () => previewMapping(mappingId, chosen) });

  if (mapping.isPending) return <Spinner label="Loading the mapping" />;
  if (mapping.isError)
    return <ProblemMessage error={mapping.error} title="Could not load the mapping" />;
  const m = mapping.data;

  return (
    <section aria-labelledby="mapping-title">
      <p className={styles.crumbs}>
        <Link to="/sources">Sources</Link> /{' '}
        <Link to={`/sources/${sourceId}`}>{source.data?.name ?? 'Source'}</Link> /
      </p>
      <PageHeader
        title={`Mapping version ${m.version}`}
        actions={
          <span className={styles.toolbar}>
            <Link
              className={`${ui.button} ${ui.secondary}`}
              to={`/sources/${sourceId}/mappings/new?from=${m.id}`}
            >
              Edit as a new version
            </Link>
            <Link
              className={`${ui.button} ${ui.primary}`}
              to={`/runs/new?sourceId=${sourceId}&mappingId=${m.id}`}
            >
              Create a run
            </Link>
          </span>
        }
      />
      <p className={ui.muted}>Saved {formatDateTime(m.createdAt)}. Saved versions cannot change.</p>
      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th scope="col">Target</th>
              <th scope="col">From columns</th>
              <th scope="col">Transforms</th>
              <th scope="col">Checks</th>
              <th scope="col">If a transform fails</th>
            </tr>
          </thead>
          <tbody>
            {m.spec.fields.map((f) => {
              const d = describeField(f);
              return (
                <tr key={f.target}>
                  <th scope="row">
                    {targetLabel(f.target)} <div className={ui.muted}>{f.target}</div>
                  </th>
                  <td>
                    <code>{f.from.join(' + ')}</code>
                  </td>
                  <td>{d.steps}</td>
                  <td>{d.rules}</td>
                  <td>
                    {(f.onError ?? 'quarantine') === 'quarantine'
                      ? 'Quarantine the row'
                      : 'Leave empty'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.actions}>
        <SelectField
          label="Preview on file"
          value={chosen}
          onChange={(e) => setFileId(e.target.value)}
        >
          {readable.length === 0 && <option value="">No profiled file yet</option>}
          {readable.map((f) => (
            <option key={f.id} value={f.id}>
              {f.filename}
            </option>
          ))}
        </SelectField>
        <Button
          variant="secondary"
          disabled={!chosen || preview.isPending}
          onClick={() => preview.mutate()}
        >
          {preview.isPending ? 'Previewing…' : 'Preview 50 rows'}
        </Button>
      </div>
      {preview.isError && <ProblemMessage error={preview.error} title="Preview failed" />}
      {preview.data && (
        <section aria-labelledby="preview-title" className={styles.previewSection}>
          <h2 id="preview-title">Preview (nothing was written)</h2>
          <PreviewTable
            preview={preview.data}
            spec={{
              fields: m.spec.fields.map((f) => ({
                ...f,
                transforms: f.transforms ?? [],
                rules: f.rules ?? [],
              })),
            }}
          />
        </section>
      )}
    </section>
  );
}
