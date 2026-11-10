import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/context';
import { navFor } from '../auth/roles';
import { useStrings } from '../i18n/language';
import { Button } from '../ui/controls';
import { useToast } from '../ui/toast-context';
import styles from './Layout.module.css';
import { LanguageSwitch, SiteFooter, SiteHeader, SkipLink } from './SiteChrome';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.link} ${styles.active}` : styles.link;

/** The app frame for a signed-in user: the header with their role's menu, the page, the footer. */
export function Layout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  const t = useStrings();
  const user = auth.user;
  const items = user ? navFor(user.role) : [];
  const ready = items.filter((i) => !i.phase);
  const coming = items.filter((i) => i.phase);
  const label = (to: string, fallback: string) => t.nav[to]?.[0] ?? fallback;

  async function signOut() {
    await auth.signOut();
    notify('info', t.signedOut);
    navigate('/login', { replace: true });
  }

  const nav = (
    <nav className={styles.nav} aria-label="Main">
      {ready.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          // Home reloads the app fresh, as the logo does; other pages switch in place.
          reloadDocument={item.to === '/'}
          className={navClass}
        >
          {label(item.to, item.label)}
        </NavLink>
      ))}
      {coming.length > 0 && (
        <ul className={styles.coming} aria-label="Coming in later phases">
          {coming.map((item) => (
            <li key={item.to}>
              {label(item.to, item.label)} ({item.phase})
            </li>
          ))}
        </ul>
      )}
    </nav>
  );

  return (
    <div className={styles.shell}>
      <SkipLink />
      <SiteHeader nav={nav}>
        {user && (
          <span className={styles.userLine}>
            {t.roles[user.role]} · {user.email}
          </span>
        )}
        <LanguageSwitch />
        {user && (
          <Button variant="link" onClick={signOut}>
            {t.signOut}
          </Button>
        )}
      </SiteHeader>
      <main id="main" className={styles.main} tabIndex={-1}>
        <div className={`${styles.container} ${styles.page}`}>
          <Outlet />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
