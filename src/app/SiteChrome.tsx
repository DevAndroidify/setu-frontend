import type { ReactNode } from 'react';
import { setLanguage, useStrings } from '../i18n/language';
import styles from './Layout.module.css';

/** Setu's own mark: a bridge (सेतु) over a river line, on a dark square. Not a government emblem. */
function Logo({ large }: { large?: boolean }) {
  return (
    <svg
      className={large ? styles.logoLarge : styles.logo}
      viewBox="0 0 34 34"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="34" height="34" fill="var(--color-text)" />
      <path d="M5 25 Q17 9 29 25" fill="none" stroke="var(--color-brand)" strokeWidth="3" />
      <line x1="5" y1="25" x2="29" y2="25" stroke="#ffffff" strokeWidth="2" />
    </svg>
  );
}

/** Switches the interface between English and Nepali; labelled in the language it offers. */
export function LanguageSwitch() {
  const t = useStrings();
  const target = t.switchToLang as 'en' | 'ne';
  return (
    <button
      type="button"
      className={styles.languageSwitch}
      lang={target}
      title={t.switchLabel}
      onClick={() => setLanguage(target)}
    >
      {t.switchTo}
    </button>
  );
}

/** "Skip to main content": hidden until a keyboard user tabs to it. */
export function SkipLink() {
  const t = useStrings();
  return (
    <a className={styles.skip} href="#main">
      {t.skip}
    </a>
  );
}

/**
 * The header: a 4px navy band, then the mark and "Setu". Signed in, the menu sits next to the
 * mark (`nav`) and the user line on the right (`children`). On sign-in the mark is larger and
 * carries the subtitle.
 */
export function SiteHeader({ nav, children }: { nav?: ReactNode; children?: ReactNode }) {
  const t = useStrings();
  const large = !nav;
  return (
    <header className={large ? `${styles.header} ${styles.headerLarge}` : styles.header}>
      <div className={styles.headerStart}>
        {/* A plain link, not the router's: it reloads the app fresh on the home page. */}
        <a className={styles.identity} href="/">
          <Logo large={large} />
          <span className={styles.identityText}>
            <span className={styles.title}>
              Setu{' '}
              {large && (
                <span lang="ne" className={styles.titleNe}>
                  सेतु
                </span>
              )}
            </span>
            {large && <span className={styles.subtitle}>{t.subtitle}</span>}
          </span>
        </a>
        {nav}
      </div>
      <div className={styles.headerEnd}>{children}</div>
    </header>
  );
}

export function SiteFooter() {
  const t = useStrings();
  return (
    <footer className={styles.footer}>
      <p>{t.footer.copyright}</p>
    </footer>
  );
}
