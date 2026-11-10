import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/context';
import { ALL_ROLES } from '../../auth/roles';
import { Alert, Button, MarginNote, StatusMark, TextField } from '../../ui/controls';
import type { MarkKind } from '../../ui/controls';
import { ProblemMessage } from '../../ui/ProblemMessage';
import { LanguageSwitch, SiteFooter, SiteHeader, SkipLink } from '../../app/SiteChrome';
import { useStrings } from '../../i18n/language';
import type { Strings } from '../../i18n/strings';
import shell from '../../app/Layout.module.css';
import styles from './LoginPage.module.css';

/** Only same-app paths are followed after signing in (no open redirects). */
const safeNext = (next: string | null): string =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

function loginMessage(error: unknown, t: Strings['login']): string | null {
  if (!(error instanceof ApiError)) return null;
  // The backend says the same for a wrong password, an unknown email and a locked account.
  if (error.status === 401) return t.wrong;
  if (error.status === 429) return t.tooMany;
  return null;
}

const PLACES = ['loaded', 'held', 'review'] as const satisfies readonly MarkKind[];

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const strings = useStrings();
  const t = strings.login;
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

  const friendly = loginMessage(error, t);
  return (
    <div className={shell.shell}>
      <SkipLink />
      <SiteHeader>
        <LanguageSwitch />
      </SiteHeader>
      <main id="main" className={styles.page} tabIndex={-1}>
        <section className={styles.info} aria-labelledby="login-headline">
          <div className={styles.intro}>
            <p className={styles.eyebrow}>{t.eyebrow}</p>
            <h1 id="login-headline" className={styles.headline}>
              {t.headline}
            </h1>
            <p lang="ne" className={styles.tagline}>
              {t.tagline}
            </p>
            <p className={styles.about}>{t.about}</p>
          </div>

          <div className={styles.block}>
            <h2 id="login-places" className={styles.blockTitle}>
              {strings.places.title}
            </h2>
            <ul className={styles.places} aria-labelledby="login-places">
              {PLACES.map((kind) => {
                const [name, text] = strings.places[kind];
                return (
                  <li key={kind}>
                    <span className={styles.placeName}>
                      <StatusMark kind={kind}>{name}</StatusMark>
                    </span>
                    <span className={styles.placeText}>{text}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className={styles.block}>
            <h2 id="login-stages" className={styles.blockTitle}>
              {t.stagesTitle}
            </h2>
            <ol className={styles.stages} aria-labelledby="login-stages">
              {strings.stages.map(([name, text], i) => (
                <li key={name}>
                  <span className={styles.stageNumber} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={styles.stageName}>{name}</span>
                  <span className={styles.stageText}>{text}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={styles.side} aria-labelledby="login-title">
          <h2 id="login-title" className={styles.formTitle}>
            {t.title}
          </h2>
          <form className={styles.form} onSubmit={submit} aria-labelledby="login-title" noValidate>
            {auth.status === 'signedOut' && auth.expired && !error && (
              <Alert kind="info">
                <p>{t.expired}</p>
              </Alert>
            )}
            {error !== null &&
              (friendly ? (
                <Alert kind="error">
                  <p>{friendly}</p>
                </Alert>
              ) : (
                <ProblemMessage error={error} title={t.failed} />
              ))}
            <TextField
              label={t.email}
              type="email"
              name="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              label={t.password}
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" className={styles.submit} disabled={busy || !email || !password}>
              {busy ? t.busy : t.submit}
            </Button>
            <p className={styles.lockout}>{t.lockout}</p>
          </form>

          {import.meta.env.DEV && (
            <section className={styles.demo} aria-labelledby="login-demo">
              <h3 id="login-demo" className={styles.demoTitle}>
                {t.demoTitle}
              </h3>
              <dl className={styles.demoList}>
                {ALL_ROLES.map((role) => (
                  <div key={role}>
                    <dt>{strings.roles[role]}</dt>
                    <dd>{role}@setu.local</dd>
                  </div>
                ))}
              </dl>
              <p className={styles.demoPassword}>{t.demoPassword}</p>
            </section>
          )}

          <MarginNote>{t.note}</MarginNote>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
