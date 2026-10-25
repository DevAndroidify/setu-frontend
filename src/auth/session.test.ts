import { ApiError } from '../api/client';
import { mockApi, problem } from '../test/mock-api';
import { api, onSessionLost, refreshAccessToken, resetSession, signIn, signOut } from './session';

const tokens = (n: number) =>
  [200, { accessToken: `access-${n}`, tokenType: 'Bearer', expiresIn: 900 }] as [number, unknown];

beforeEach(() => resetSession());
afterEach(() => vi.unstubAllGlobals());

describe('session', () => {
  it('shares one refresh between calls made at the same time (refresh tokens are single use)', async () => {
    let n = 0;
    const { calls } = mockApi({ 'POST /api/v1/auth/refresh': () => tokens(++n) });
    const results = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);
    expect(results).toEqual(['access-1', 'access-1', 'access-1']);
    expect(calls).toHaveLength(1);
  });

  it('sends the access token, and on a 401 refreshes once and repeats the call', async () => {
    let refreshes = 0;
    const { calls } = mockApi({
      'POST /api/v1/auth/login': tokens(0),
      'POST /api/v1/auth/refresh': () => tokens(++refreshes),
      'GET /api/v1/me': (req) =>
        req.headers.get('authorization') === 'Bearer access-0'
          ? [200, { id: 'u', email: 'operator@setu.local', role: 'operator' }]
          : [401, problem(401, 'Invalid or expired access token')],
      'GET /api/v1/sources': (req) =>
        req.headers.get('authorization') === 'Bearer access-1'
          ? [200, { data: [], nextCursor: null }]
          : [401, problem(401, 'Invalid or expired access token')],
    });
    await signIn('operator@setu.local', 'pw');
    await expect(api('/sources')).resolves.toEqual({ data: [], nextCursor: null });
    expect(refreshes).toBe(1);
    expect(calls.filter((c) => c.path === '/api/v1/sources')).toHaveLength(2);
  });

  it('ends the session when the refresh is refused', async () => {
    mockApi({
      'POST /api/v1/auth/refresh': [401, problem(401, 'Refresh token expired')],
    });
    const lost = vi.fn();
    onSessionLost(lost);
    await expect(api('/sources')).rejects.toBeInstanceOf(ApiError);
    expect(lost).toHaveBeenCalledTimes(1);
  });

  it('signs out on the server and forgets the token, even if the server is unreachable', async () => {
    const { calls } = mockApi({
      'POST /api/v1/auth/login': tokens(0),
      'GET /api/v1/me': [200, { id: 'u', email: 'a@b.c', role: 'auditor' }],
    });
    await signIn('a@b.c', 'pw');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(signOut()).resolves.toBeUndefined();
    mockApi({ 'POST /api/v1/auth/refresh': [401, problem(401, 'Missing refresh token')] });
    await expect(api('/me')).rejects.toMatchObject({ status: 401 });
    expect(calls.some((c) => c.path === '/api/v1/auth/login')).toBe(true);
  });
});
