import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-title">
      <h1 id="not-found-title">Page not found</h1>
      <p>
        There is no page at this address. <Link to="/">Go to the home page</Link>.
      </p>
    </section>
  );
}
