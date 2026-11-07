import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/context';
import { navFor } from '../auth/roles';
import { useStrings } from '../i18n/language';
import { Button } from '../ui/controls';
import { useToast } from '../ui/toast-context';
import styles from './Layout.module.css';
import { PageIcon } from './icons';
import { LanguageSwitch, SiteFooter, SiteHeader, SkipLink } from './SiteChrome';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.link} ${styles.active}` : styles.link;

/** The app frame for a signed-in user: top strip, header, the menu for their role, the page. */
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

  return (
    <div className={styles.shell}>
      <SkipLink />
      <SiteHeader>
        {user && (
          <div className={styles.user}>
            <div className={styles.userText}>
              <span className={styles.role}>{t.roles[user.role]}</span>
              <span className={styles.email}>{user.email}</span>
            </div>
            <Button variant="secondary" onClick={signOut}>
              {t.signOut}
            </Button>
          </div>
        )}
      </SiteHeader>
      <nav className={styles.nav} aria-label="Main">
        <div className={`${styles.container} ${styles.navInner}`}>
          {ready.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              // Home reloads the app fresh, as the logo does; other pages switch in place.
              reloadDocument={item.to === '/'}
              className={navClass}
            >
              <PageIcon to={item.to} className={styles.linkIcon} />
              {label(item.to, item.label)}
            </NavLink>
          ))}
          {coming.length > 0 && (
            <ul className={styles.coming} aria-label="Coming in later phases">
              {coming.map((item) => (
                <li key={item.to}>
                  {label(item.to, item.label)} <span className={styles.phase}>{item.phase}</span>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.navEnd}>
            <LanguageSwitch />
          </div>
        </div>
      </nav>
      <main id="main" className={styles.main} tabIndex={-1}>
        <div className={`${styles.container} ${styles.page}`}>
          <Outlet />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
