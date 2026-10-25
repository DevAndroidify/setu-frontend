import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/context';
import { Alert, Button, TextField } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import styles from './LoginPage.module.css';

/** Only same-app paths are followed after signing in (no open redirects). */
const safeNext = (next: string | null): string =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

function loginMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 401) {
    // The backend says the same for a wrong password, an unknown email and a locked account.
    return 'The email or password is not right. After 5 failed attempts the account is locked for 15 minutes.';
  }
  if (error.status === 429)
    return 'Too many sign-in attempts from this computer. Wait a minute and try again.';
  return null;
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get('next'));

  if (auth.status === 'signedIn') return <Navigate to={next} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.signIn(email.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err);
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  const friendly = loginMessage(error);
  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={submit} aria-labelledby="login-title" noValidate>
        <p className={styles.brand}>
          Setu <span lang="ne">सेतु</span>
        </p>
        <h1 id="login-title">Sign in</h1>
        {auth.status === 'signedOut' && auth.expired && !error && (
          <Alert kind="info">
            <p>Your session ended. Sign in again to continue.</p>
          </Alert>
        )}
        {error !== null &&
          (friendly ? (
            <Alert kind="error">
              <p>{friendly}</p>
            </Alert>
          ) : (
            <ProblemMessage error={error} title="Could not sign in" />
          ))}
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
