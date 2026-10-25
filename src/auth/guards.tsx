import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '../ui/Spinner';
import { useAuth } from './context';
import { ROLE_LABELS } from './roles';
import type { Role } from './session';

/** Pages inside need a signed-in user; others are sent to sign in and brought back after. */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <Spinner label="Checking your session" />;
  if (auth.status === 'signedOut') {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}

/** A page only some roles may use. The backend enforces this too; this explains it early. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (user && roles.includes(user.role)) return <>{children}</>;
  return (
    <section aria-labelledby="forbidden-title">
      <h1 id="forbidden-title">Not available to your role</h1>
      <p>
        This page is for {roles.map((r) => ROLE_LABELS[r]).join(', ')}. You are signed in as{' '}
        {user ? ROLE_LABELS[user.role] : 'nobody'}.
      </p>
    </section>
  );
}
