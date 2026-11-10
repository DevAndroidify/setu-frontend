import { createContext, useContext } from 'react';
import type { Me, Role } from './session';

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null; expired?: boolean }
  | { status: 'signedIn'; user: Me };

export type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  /** Public demo only: sign in as a role's seeded account (see VITE_DEMO_MODE). */
  signInAsDemo: (role: Role) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
