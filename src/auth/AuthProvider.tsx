import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AuthContext, type AuthState } from './context';
import { api, type Me, onSessionLost, refreshAccessToken, signIn, signOut } from './session';

/**
 * Knows who is signed in. On load it tries the refresh cookie, so a reload keeps the session;
 * when a refresh is refused later, the user is signed out and the cached data dropped.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

  useEffect(() => {
    let active = true;
    refreshAccessToken()
      .then(async (token) => (token ? api<Me>('/me') : null))
      .catch(() => null)
      .then((user) => {
        if (!active) return;
        setState(user ? { status: 'signedIn', user } : { status: 'signedOut', user: null });
      });
    const unsubscribe = onSessionLost(() => {
      queryClient.clear();
      setState({ status: 'signedOut', user: null, expired: true });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [queryClient]);

  const doSignIn = useCallback(async (email: string, password: string) => {
    const user = await signIn(email, password);
    setState({ status: 'signedIn', user });
  }, []);

  const doSignOut = useCallback(async () => {
    await signOut();
    queryClient.clear();
    setState({ status: 'signedOut', user: null });
  }, [queryClient]);

  const value = useMemo(
    () => ({ ...state, signIn: doSignIn, signOut: doSignOut }),
    [state, doSignIn, doSignOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
