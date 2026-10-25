import { useQuery } from '@tanstack/react-query';
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
      <h1 id="status-title">System status</h1>
      {readiness.isPending && <p className={styles.muted}>Checking…</p>}
      {readiness.isError && (
        <p role="alert" className={styles.alert}>
          The API cannot be reached. Is the backend running on port 3000?
        </p>
      )}
      {readiness.data && (
        <>
          <p className={readiness.data.ok ? styles.ok : styles.alert} role="status">
            {readiness.data.ok ? 'All services are up.' : 'Some services are down.'}
          </p>
          <table className={styles.table}>
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
                    <span className={check.status === 'up' ? styles.up : styles.down}>
                      {check.status === 'up' ? 'Up' : 'Down'}
                    </span>
                    {check.error && <span className={styles.muted}> {check.error}</span>}
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
