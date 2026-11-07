import type { ReactNode } from 'react';
import { setLanguage, useStrings } from '../i18n/language';
import styles from './Layout.module.css';

/** Setu's own mark: a bridge (सेतु) over a river line. Not a government emblem. */
function Logo() {
  return (
    <svg className={styles.logo} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <circle cx="24" cy="24" r="23" fill="var(--color-brand)" />
      <path
        d="M8 29c5-9 11-13 16-13s11 4 16 13"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M7 30h34" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M14 30v-6M19 30v-11M24 30v-14M29 30v-11M34 30v-6"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M11 35h26" stroke="var(--color-accent)" strokeWidth="2.6" strokeLinecap="round" />
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
      <span aria-hidden="true" className={styles.languageIcon}>
        अ/A
      </span>
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

/** The white header band with the mark and title; `children` sits on the right. */
export function SiteHeader({ children }: { children?: ReactNode }) {
  const t = useStrings();
  return (
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        {/* A plain link, not the router's: it reloads the app fresh on the home page. */}
        <a className={styles.identity} href="/">
          <Logo />
          <span>
            <span className={styles.title}>
              Setu <span lang="ne">सेतु</span>
            </span>
            <span className={styles.subtitle}>{t.subtitle}</span>
          </span>
        </a>
        {children}
      </div>
    </header>
  );
}

export function SiteFooter() {
  const t = useStrings();
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerColumns}`}>
        <section aria-labelledby="footer-about">
          <h2 id="footer-about" className={styles.footerHeading}>
            {t.footer.about}
          </h2>
          <p>{t.footer.aboutText}</p>
        </section>
        <section aria-labelledby="footer-stages">
          <h2 id="footer-stages" className={styles.footerHeading}>
            {t.footer.stages}
          </h2>
          <ol className={styles.footerList}>
            {t.stages.map(([name]) => (
              <li key={name}>{name}</li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="footer-privacy">
          <h2 id="footer-privacy" className={styles.footerHeading}>
            {t.footer.privacy}
          </h2>
          <ul className={styles.footerList}>
            {t.footer.privacyPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      </div>
      <div className={styles.footerBottom}>
        <div className={styles.container}>
          <p>{t.footer.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
