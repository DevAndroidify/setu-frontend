import { ApiError } from '../api/client';
import { Alert } from './controls';
import styles from './ui.module.css';

/** What went wrong, in the backend's words, with the request id support needs to find it. */
export function ProblemMessage({ error, title }: { error: unknown; title?: string }) {
  if (error instanceof ApiError) {
    return (
      <Alert kind="error">
        <p>
          {title && <strong>{title}: </strong>}
          {error.detail ?? error.title}
        </p>
        {error.fieldErrors.length > 0 && (
          <ul>
            {error.fieldErrors.map((f) => (
              <li key={`${f.path}:${f.message}`}>
                {f.path}: {f.message}
              </li>
            ))}
          </ul>
        )}
        {error.requestId && <p className={styles.requestId}>Request id: {error.requestId}</p>}
      </Alert>
    );
  }
  return (
    <Alert kind="error">
      <p>
        {title && <strong>{title}: </strong>}
        {error instanceof TypeError
          ? 'The server cannot be reached. Check your connection and try again.'
          : 'Something went wrong.'}
      </p>
    </Alert>
  );
}
