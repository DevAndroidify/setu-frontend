import { Link } from 'react-router';
import { useAuth } from '../../auth/context';
import { navFor } from '../../auth/roles';
import { PageIcon } from '../../app/icons';
import { useLanguage, useStrings } from '../../i18n/language';
import { PageHeader } from '../../ui/controls';
import styles from './home.module.css';

export function HomePage() {
  const { user } = useAuth();
  const t = useStrings();
  const language = useLanguage();
  if (!user) return null;
  const shortcuts = navFor(user.role).filter((i) => i.to !== '/' && !i.phase);
  const role = t.roles[user.role];
  const [before, email, after] = t.home.signedInAs(user.email, role);
  return (
    <>
      <PageHeader
        title={<span id="home-title">{t.home.welcome}</span>}
        meta={
          <span>
            {before}
            <strong className={styles.email}>{email}</strong>
            {after}
          </span>
        }
      />
      <p className={styles.intro}>{t.home.intro[user.role]}</p>

      <section aria-labelledby="services-title" className={styles.section}>
        <h2 id="services-title" className={styles.sectionTitle}>
          {t.home.services}
        </h2>
        <ul className={styles.services}>
          {shortcuts.map((item) => {
            const [label, description] = t.nav[item.to] ?? [item.label, ''];
            return (
              <li key={item.to}>
                <Link to={item.to} className={styles.service}>
                  <PageIcon to={item.to} className={styles.serviceIcon} />
                  <span className={styles.serviceTitle}>{label}</span>
                  <span className={styles.serviceText}>{description}</span>
                  <span className={styles.serviceArrow} aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="stages-title" className={styles.section}>
        <h2 id="stages-title" className={styles.sectionTitle}>
          {t.home.howItWorks}
        </h2>
        <ol className={styles.stages}>
          {t.stages.map(([name, text], i) => (
            <li key={name}>
              <span className={styles.stageNumber} aria-hidden="true">
                {(i + 1).toLocaleString(language === 'ne' ? 'ne-NP' : 'en')}
              </span>
              <span className={styles.stageName}>{name}</span>
              <span className={styles.stageText}>{text}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
