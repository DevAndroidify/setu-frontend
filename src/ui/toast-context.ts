import { createContext, useContext } from 'react';

export type ToastKind = 'success' | 'error' | 'info';
export type Notify = (kind: ToastKind, message: string) => void;

export const ToastContext = createContext<Notify>(() => undefined);

export const useToast = (): Notify => useContext(ToastContext);
