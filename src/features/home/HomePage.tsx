import { Link } from 'react-router';
import { useAuth } from '../../auth/context';
import { navFor } from '../../auth/roles';
import { PageIcon } from '../../app/icons';
import { useStrings } from '../../i18n/language';
import styles from './home.module.css';

export function HomePage() {
  const { user } = useAuth();
  const t = useStrings();
  if (!user) return null;
  const shortcuts = navFor(user.role).filter((i) => i.to !== '/' && !i.phase);
  const role = t.roles[user.role];
  const [before, email, after] = t.home.signedInAs(user.email, role);
  return (
    <>
      <section className={styles.hero} aria-labelledby="home-title">
        <p className={styles.eyebrow}>{role}</p>
        <h1 id="home-title">{t.home.welcome}</h1>
        <p>
          {before}
          <strong>{email}</strong>
          {after}
        </p>
        <p>{t.home.intro[user.role]}</p>
      </section>

      <section aria-labelledby="services-title" className={styles.section}>
        <h2 id="services-title" className={styles.sectionTitle}>
          {t.home.services}
        </h2>
        <ul className={styles.cards}>
          {shortcuts.map((item) => {
            const [label, description] = t.nav[item.to] ?? [item.label, ''];
            return (
              <li key={item.to}>
                <Link to={item.to} className={styles.card}>
                  <span className={styles.cardIcon}>
                    <PageIcon to={item.to} />
                  </span>
                  <span className={styles.cardTitle}>{label}</span>
                  <span className={styles.cardText}>{description}</span>
                  <span className={styles.cardArrow} aria-hidden="true">
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
          {t.stages.map(([name, text]) => (
            <li key={name} className={styles.stage}>
              <span className={styles.stageName}>{name}</span>
              <span className={styles.stageText}>{text}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
