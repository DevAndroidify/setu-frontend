import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './controls';
import { type Notify, ToastContext, type ToastKind } from './toast-context';
import styles from './ui.module.css';

type Toast = { id: number; kind: ToastKind; message: string };

/** Short confirmations ("Source created") announced to screen readers; they fade after 6 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback<Notify>(
    (kind, message) => {
      const id = next.current++;
      setToasts((all) => [...all.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), 6000);
    },
    [dismiss],
  );

  const value = useMemo(() => notify, [notify]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.toasts} aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={styles.toast} role={t.kind === 'error' ? 'alert' : 'status'}>
            <p>{t.message}</p>
            <Button variant="ghost" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              ×
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
