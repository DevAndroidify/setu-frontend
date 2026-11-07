import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/context';
import { Alert, Button, TextField } from '../../ui/controls';
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

/** The bridge the records cross, shared by the drawn arch and the moving records. */
const BRIDGE = 'M-20 300 C 300 120, 1140 120, 1460 300';
const HANGERS: [number, number][] = [
  [180, 222],
  [360, 189],
  [540, 171],
  [720, 165],
  [900, 171],
  [1080, 189],
  [1260, 222],
];

/**
 * Decorative scene behind the sign-in page: Himalayan ridges, Setu's bridge and
 * records moving across it, old register to new. Hidden from assistive technology.
 */
function Backdrop() {
  return (
    <svg
      className={styles.backdrop}
      viewBox="0 0 1440 420"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="login-snow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path
        className={styles.ridgeFar}
        d="M0 250 L120 170 L190 205 L300 110 L380 175 L470 95 L560 165 L640 130 L740 60 L830 150 L920 115 L1010 170 L1110 85 L1200 160 L1290 125 L1440 200 L1440 420 L0 420 Z"
        fill="url(#login-snow)"
      />
      <path
        className={styles.ridgeNear}
        d="M0 320 L140 260 L260 300 L380 240 L520 290 L660 230 L800 285 L940 245 L1080 295 L1220 250 L1440 300 L1440 420 L0 420 Z"
        fill="#ffffff"
        fillOpacity="0.06"
      />
      <path className={styles.bridge} d={BRIDGE} pathLength={1} />
      <g stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2">
        {/* Hangers from the arch down to the deck: [x, y where the arch is]. */}
        {HANGERS.map(([x, y]) => (
          <line key={x} x1={x} x2={x} y1={y} y2="300" />
        ))}
      </g>
      <line
        x1="0"
        x2="1440"
        y1="300"
        y2="300"
        stroke="#ffffff"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <g className={styles.records}>
        {[0, 1, 2, 3, 4].map((n) => (
          <rect key={n} width="16" height="11" x="-8" y="-6" rx="2" fill="#ffffff">
            {/* A negative begin starts each record part-way along, so none waits at the corner. */}
            <animateMotion dur="10s" begin={`-${n * 2}s`} repeatCount="indefinite" path={BRIDGE} />
          </rect>
        ))}
      </g>
    </svg>
  );
}

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const strings = useStrings();
  const t = strings.login;
  const stages = strings.stages;
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
        <Backdrop />
        <div className={`${shell.container} ${styles.columns}`}>
          <section className={styles.info} aria-labelledby="login-about">
            <p className={styles.eyebrow}>{t.aboutTitle}</p>
            <h2 id="login-about" className={styles.headline}>
              {t.headline}
            </h2>
            <p className={styles.about}>{t.about}</p>
            <h3 className={styles.stagesTitle}>{t.stagesTitle}</h3>
            <ol className={styles.stages}>
              {stages.map(([name], i) => (
                <li key={name} style={{ '--i': i } as CSSProperties}>
                  <span className={styles.stageDot} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={styles.stageName}>{name}</span>
                </li>
              ))}
            </ol>
            <ul className={styles.points}>
              {t.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
          <form className={styles.card} onSubmit={submit} aria-labelledby="login-title" noValidate>
            <h1 id="login-title" className={styles.cardTitle}>
              {t.title}
            </h1>
            <div className={styles.cardBody}>
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
              <Button type="submit" disabled={busy || !email || !password}>
                {busy ? t.busy : t.submit}
              </Button>
            </div>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
