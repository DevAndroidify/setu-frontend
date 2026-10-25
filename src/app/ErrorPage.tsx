import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { ProblemMessage } from '../ui/ProblemMessage';

/** Shown when a page fails to render or load; keeps the request id for support. */
export function ErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <section aria-labelledby="error-title">
        <h1 id="error-title">Page not found</h1>
        <p>
          <Link to="/">Go to the home page</Link>
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="error-title">
      <h1 id="error-title">This page could not be shown</h1>
      <ProblemMessage error={error} />
      <p>
        Try again, or <Link to="/">go to the home page</Link>. If it keeps happening, send the
        request id above to support.
      </p>
    </section>
  );
}
