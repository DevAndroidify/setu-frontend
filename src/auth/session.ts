import { ApiError, apiPath, request } from '../api/client';

export type Role = 'operator' | 'reviewer' | 'approver' | 'auditor' | 'admin';
export type Me = { id: string; email: string; role: Role };
type Tokens = { accessToken: string; tokenType: 'Bearer'; expiresIn: number };

/**
 * The signed-in session. The access token lives only in memory (never in browser storage);
 * the refresh token is an httpOnly cookie the browser sends to /api/v1/auth itself.
 */
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
const lostListeners = new Set<() => void>();

/** Called when the session ends without the user signing out (refresh refused). */
export function onSessionLost(listener: () => void): () => void {
  lostListeners.add(listener);
  return () => lostListeners.delete(listener);
}

const sessionLost = () => {
  accessToken = null;
  for (const listener of lostListeners) listener();
};

/**
 * Refresh tokens are single use: the backend treats a reused one as stolen and revokes every
 * session. So one refresh at a time: calls in this tab share one request, and a Web Lock keeps
 * other tabs (which share the cookie) from refreshing at the same moment.
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= withLock(async () => {
    try {
      const tokens = await request<Tokens>(apiPath('/auth/refresh'), { method: 'POST' });
      accessToken = tokens.accessToken;
      return accessToken;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        accessToken = null;
        return null;
      }
      throw err;
    }
  }).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function withLock<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? (locks.request('setu-auth-refresh', work) as unknown as Promise<T>) : work();
}

/**
 * A call to the API as the signed-in user. An expired access token is refreshed once and the
 * call repeated; if that fails too, the session is over.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = (token: string) =>
    request<T>(apiPath(path), {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });

  const token = accessToken ?? (await refreshAccessToken());
  if (!token) {
    sessionLost();
    throw new ApiError(401, 'Unauthorized', 'You are not signed in', [], null);
  }
  try {
    return await send(token);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    const renewed = await refreshAccessToken();
    if (!renewed) {
      sessionLost();
      throw err;
    }
    return send(renewed);
  }
}

/** The current access token, refreshed if needed (for requests made without `api`). */
export async function currentToken(): Promise<string | null> {
  return accessToken ?? refreshAccessToken();
}

export async function signIn(email: string, password: string): Promise<Me> {
  const tokens = await request<Tokens>(apiPath('/auth/login'), {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  accessToken = tokens.accessToken;
  return api<Me>('/me');
}

/** Ends the session on the server (revokes the refresh token) and forgets the access token. */
export async function signOut(): Promise<void> {
  accessToken = null;
  await request(apiPath('/auth/logout'), { method: 'POST' }).catch(() => undefined);
}

/** For tests: start from no session. */
export function resetSession(): void {
  accessToken = null;
  refreshing = null;
  lostListeners.clear();
}
