import { useId } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import styles from './ui.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
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

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  return <span className={`${styles.badge} ${styles[`badge-${tone}`]}`}>{children}</span>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className={styles.pageHeader}>
      <h1>{title}</h1>
      {actions}
    </div>
  );
}
