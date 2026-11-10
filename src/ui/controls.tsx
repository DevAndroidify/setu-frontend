import { useId } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router';
import styles from './ui.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: navy; secondary: dark outline; link: underlined text; ghost: icon-like. */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
};

export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={[styles.button, styles[variant], className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

type FieldProps = { label: string; hint?: ReactNode; error?: string };

/** A labelled input with its hint and error wired up for screen readers. */
export function TextField({
  label,
  hint,
  error,
  ...input
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {hint && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      <input
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {error && (
        <span id={`${id}-error`} className={styles.fieldError}>
          {error}
        </span>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  ...textarea
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {hint && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      <textarea
        id={id}
        className={`${styles.input} ${styles.textarea}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...textarea}
      />
      {error && (
        <span id={`${id}-error`} className={styles.fieldError}>
          {error}
        </span>
      )}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...select
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {hint && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      <select
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...select}
      >
        {children}
      </select>
      {error && (
        <span id={`${id}-error`} className={styles.fieldError}>
          {error}
        </span>
      )}
    </div>
  );
}

export function Alert({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'success' | 'warning' | 'error';
  children: ReactNode;
}) {
  return (
    <div
      className={`${styles.alert} ${styles[`alert-${kind}`]}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}

/**
 * The fixed status colours: loaded is navy, held is amber, sent for review is a black outline,
 * failed is red. A problem never looks like the brand colour.
 */
export type MarkKind = 'loaded' | 'held' | 'review' | 'failed';

/** A small square in the status colour plus the word. The word carries the meaning. */
export function StatusMark({ kind, children }: { kind: MarkKind; children: ReactNode }) {
  return (
    <span className={`${styles.mark} ${styles[`mark-${kind}`]}`}>
      <span className={styles.markSquare} data-mark={kind} aria-hidden="true" />
      {children}
    </span>
  );
}

const TONE_MARK: Record<'neutral' | 'success' | 'warning' | 'danger', MarkKind> = {
  success: 'loaded',
  warning: 'held',
  danger: 'failed',
  neutral: 'review',
};

/** Older name for a status marker, by tone: success, warning, danger or neutral. */
export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  return <StatusMark kind={TONE_MARK[tone]}>{children}</StatusMark>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}

/**
 * The page title block: a back link in muted text, the heading, a line of facts under it and
 * the actions on the right, with a strong line underneath.
 */
export function PageHeader({
  title,
  back,
  meta,
  actions,
}: {
  title: ReactNode;
  back?: { to: string; label: string };
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.pageTitle}>
        {back && (
          <Link className={styles.backLink} to={back.to}>
            <span aria-hidden="true">← </span>
            {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {meta && <div className={styles.pageMeta}>{meta}</div>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </div>
  );
}

export type Counter = { label: string; value: number; note?: ReactNode; highlight?: boolean };

/** A row of numbers divided by thin lines. Only the important one is filled navy. */
export function Counters({ label, items }: { label: string; items: Counter[] }) {
  return (
    <ul className={styles.counters} aria-label={label}>
      {items.map((c) => (
        <li
          key={c.label}
          className={c.highlight ? styles.counterHighlight : styles.counter}
          data-highlight={c.highlight ? 'true' : undefined}
        >
          <span className={styles.counterLabel}>{c.label}</span>
          <span className={styles.counterValue}>{c.value.toLocaleString('en-IN')}</span>
          {c.note && <span className={styles.counterNote}>{c.note}</span>}
        </li>
      ))}
    </ul>
  );
}

/** A raw legacy value, column name or field code, shown exactly as written. */
export function Raw({ children }: { children: ReactNode }) {
  return <code className={styles.raw}>{children}</code>;
}

/** The one handwritten margin note per screen, in lower case. */
export function MarginNote({ children }: { children: ReactNode }) {
  return (
    <p role="note" className={styles.marginNote}>
      {children}
    </p>
  );
}
