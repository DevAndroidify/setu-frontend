import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { Badge, EmptyState, PageHeader } from '../../ui/controls';
import ui from '../../ui/ui.module.css';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import { useToast } from '../../ui/toast-context';
import { getSource, KINDS, listFiles, type SourceFile } from './api';
import { formatBytes, formatDateTime, formatNumber } from './format';
import styles from './sources.module.css';
import { UploadPanel } from './UploadPanel';
import { MappingsSection } from '../mappings/MappingsSection';

function ProfileBadge({ status }: { status: SourceFile['profileStatus'] }) {
  if (status === 'ok') return <Badge tone="success">Profiled</Badge>;
  if (status === 'failed') return <Badge tone="danger">Unreadable</Badge>;
  return <Badge>Profiling…</Badge>;
}

export function SourcePage() {
  const { sourceId = '' } = useParams();
  const queryClient = useQueryClient();
  const notify = useToast();
  const source = useQuery({ queryKey: ['source', sourceId], queryFn: () => getSource(sourceId) });
  const files = useQuery({
    queryKey: ['source-files', sourceId],
    queryFn: () => listFiles(sourceId),
    // While a file is being profiled, check again every 2 seconds.
    refetchInterval: (q) =>
      q.state.data?.some((f) => f.profileStatus === 'pending') ? 2000 : false,
  });

  if (source.isPending) return <Spinner label="Loading the source" />;
  if (source.isError)
    return <ProblemMessage error={source.error} title="Could not load the source" />;
  const s = source.data;

  return (
    <section aria-labelledby="source-title">
      <p className={styles.crumbs}>
        <Link to="/sources">Sources</Link> /
      </p>
      <PageHeader title={s.name} />
      <dl className={styles.facts}>
        <div>
          <dt>Agency</dt>
          <dd>{s.agency}</dd>
        </div>
        <div>
          <dt>Kind</dt>
          <dd>{KINDS[s.kind].label}</dd>
        </div>
        <div>
          <dt>Registered</dt>
          <dd>{formatDateTime(s.createdAt)}</dd>
        </div>
      </dl>

      <UploadPanel
        source={s}
        onUploaded={(file) => {
          notify('success', `${file.filename} uploaded. Profiling it now.`);
          void queryClient.invalidateQueries({ queryKey: ['source-files', sourceId] });
          void queryClient.invalidateQueries({ queryKey: ['sources'] });
        }}
      />

      <MappingsSection sourceId={sourceId} />

      <h2 id="files-title">Files</h2>
      {files.isPending && <Spinner label="Loading files" />}
      {files.isError && <ProblemMessage error={files.error} title="Could not load the files" />}
      {files.data?.length === 0 && <EmptyState>No files uploaded yet.</EmptyState>}
      {files.data && files.data.length > 0 && (
        <div className={ui.tableWrap}>
          <table className={ui.table} aria-labelledby="files-title">
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col">Size</th>
                <th scope="col">Encoding</th>
                <th scope="col">Rows</th>
                <th scope="col">Profile</th>
                <th scope="col">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {files.data.map((f) => (
                <tr key={f.id}>
                  <td>
                    {f.profileStatus === 'pending' ? (
                      f.filename
                    ) : (
                      <Link to={`/sources/${sourceId}/files/${f.id}`}>{f.filename}</Link>
                    )}
                    <div className={styles.sha} title="SHA-256 of the file">
                      {f.sha256.slice(0, 12)}…
                    </div>
                  </td>
                  <td>{formatBytes(f.sizeBytes)}</td>
                  <td>{f.encoding ?? '—'}</td>
                  <td>{f.rowCount === null ? '—' : formatNumber(f.rowCount)}</td>
                  <td>
                    <ProfileBadge status={f.profileStatus} />
                  </td>
                  <td>{formatDateTime(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
