import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../auth/context';
import { navFor, ROLE_LABELS } from '../auth/roles';
import { Button } from '../ui/controls';
import { useToast } from '../ui/toast-context';
import styles from './Layout.module.css';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.link} ${styles.active}` : styles.link;

/** The app frame for a signed-in user: header, the menu for their role, and the page. */
export function Layout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const notify = useToast();
  const user = auth.user;
  const items = user ? navFor(user.role) : [];
  const ready = items.filter((i) => !i.phase);
  const coming = items.filter((i) => i.phase);

  async function signOut() {
    await auth.signOut();
    notify('info', 'You are signed out.');
    navigate('/login', { replace: true });
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <span className={styles.brand}>
          Setu <span lang="ne">सेतु</span>
        </span>
        <span className={styles.tagline}>Legacy records, migrated with proof</span>
        {user && (
          <div className={styles.user}>
            <span>
              {user.email} <span className={styles.role}>{ROLE_LABELS[user.role]}</span>
            </span>
            <Button variant="secondary" onClick={signOut}>
              Sign out
            </Button>
          </div>
        )}
      </header>
      <nav className={styles.nav} aria-label="Main">
        {ready.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navClass}>
            {item.label}
          </NavLink>
        ))}
        {coming.length > 0 && (
          <ul className={styles.coming} aria-label="Coming in later phases">
            {coming.map((item) => (
              <li key={item.to}>
                {item.label} <span className={styles.phase}>{item.phase}</span>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
