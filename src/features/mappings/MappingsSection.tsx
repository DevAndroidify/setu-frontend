import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { EmptyState } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { Spinner } from '../../ui/Spinner';
import ui from '../../ui/ui.module.css';
import { formatDateTime } from '../sources/format';
import { listMappings } from './api';
import styles from './mappings.module.css';

/** The mapping versions of a source, newest first, on the source's page. */
export function MappingsSection({ sourceId }: { sourceId: string }) {
  const mappings = useQuery({
    queryKey: ['mappings', sourceId],
    queryFn: () => listMappings(sourceId),
  });
  const latest = mappings.data?.[0];
  return (
    <section aria-labelledby="mappings-title" className={styles.section}>
      <div className={ui.pageHeader}>
        <h2 id="mappings-title">Mappings</h2>
        <Link
          className={`${ui.button} ${ui.secondary}`}
          to={`/sources/${sourceId}/mappings/new${latest ? `?from=${latest.id}` : ''}`}
        >
          {latest ? `New version from version ${latest.version}` : 'Write a mapping'}
        </Link>
      </div>
      {mappings.isPending && <Spinner label="Loading mappings" />}
      {mappings.isError && (
        <ProblemMessage error={mappings.error} title="Could not load the mappings" />
      )}
      {mappings.data?.length === 0 && (
        <EmptyState>No mapping yet. Write one to preview and run this source's files.</EmptyState>
      )}
      {mappings.data && mappings.data.length > 0 && (
        <table className={ui.table}>
          <thead>
            <tr>
              <th scope="col">Version</th>
              <th scope="col">Fields</th>
              <th scope="col">Saved</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {mappings.data.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link to={`/sources/${sourceId}/mappings/${m.id}`}>Version {m.version}</Link>
                </td>
                <td>{m.spec.fields.length}</td>
                <td>{formatDateTime(m.createdAt)}</td>
                <td>
                  <Link to={`/runs/new?sourceId=${sourceId}&mappingId=${m.id}`}>Create a run</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
