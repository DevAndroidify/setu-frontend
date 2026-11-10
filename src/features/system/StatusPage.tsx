import { useQuery } from '@tanstack/react-query';
import { Alert, PageHeader, StatusMark } from '../../ui/controls';
import ui from '../../ui/ui.module.css';
import { getReadiness } from './readiness';
import styles from './StatusPage.module.css';

const LABELS: Record<string, string> = {
  postgres: 'Database (PostgreSQL)',
  redis: 'Queue (Redis)',
  minio: 'File store (MinIO)',
};

/** Whether the API and the services it depends on are reachable. Refreshes every 10 seconds. */
export function StatusPage() {
  const readiness = useQuery({
    queryKey: ['readiness'],
    queryFn: getReadiness,
    refetchInterval: 10_000,
    retry: false,
  });

  return (
    <section aria-labelledby="status-title">
      <PageHeader title={<span id="status-title">System status</span>} />
      {readiness.isPending && <p className={ui.muted}>Checking…</p>}
      {readiness.isError && (
        <Alert kind="error">
          <p>The API cannot be reached. Is the backend running on port 3000?</p>
        </Alert>
      )}
      {readiness.data && (
        <>
          <p className={styles.summary} role="status">
            <StatusMark kind={readiness.data.ok ? 'loaded' : 'failed'}>
              {readiness.data.ok ? 'All services are up.' : 'Some services are down.'}
            </StatusMark>
          </p>
          <table className={`${ui.table} ${styles.table}`}>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(readiness.data.checks).map(([name, check]) => (
                <tr key={name}>
                  <td>{LABELS[name] ?? name}</td>
                  <td>
                    <StatusMark kind={check.status === 'up' ? 'loaded' : 'failed'}>
                      {check.status === 'up' ? 'Up' : 'Down'}
                    </StatusMark>
                    {check.error && <span className={ui.muted}> {check.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
