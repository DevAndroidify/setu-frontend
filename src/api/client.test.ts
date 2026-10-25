import { ApiError, apiPath, request } from './client';

const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  vi
    .fn()
    .mockResolvedValue(
      new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers }),
    );

afterEach(() => vi.unstubAllGlobals());

describe('request', () => {
  it('returns the JSON body of a successful answer', async () => {
    vi.stubGlobal('fetch', respond(200, { ok: true }, { 'content-type': 'application/json' }));
    await expect(request(apiPath('/me'))).resolves.toEqual({ ok: true });
  });

  it('sends JSON bodies with a JSON content type and same-origin credentials', async () => {
    const fetch = respond(201, {}, { 'content-type': 'application/json' });
    vi.stubGlobal('fetch', fetch);
    await request(apiPath('/sources'), { method: 'POST', body: JSON.stringify({ a: 1 }) });
    expect(fetch).toHaveBeenCalledWith('/api/v1/sources', {
      method: 'POST',
      body: '{"a":1}',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
  });

  it('throws a problem+json answer as an ApiError with its fields and request id', async () => {
    vi.stubGlobal(
      'fetch',
      respond(
        400,
        {
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'Validation failed',
          errors: [{ path: 'reason', message: 'a reason is required' }],
        },
        { 'content-type': 'application/problem+json', 'x-request-id': 'req-123' },
      ),
    );
    const error = await request('/api/v1/runs/1/approve').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      title: 'Bad Request',
      message: 'Validation failed',
      fieldErrors: [{ path: 'reason', message: 'a reason is required' }],
      requestId: 'req-123',
    });
  });

  it('still raises an ApiError when an error answer is not JSON', async () => {
    vi.stubGlobal('fetch', respond(502, '<html>Bad gateway</html>'));
    await expect(request('/api/v1/me')).rejects.toMatchObject({ status: 502, fieldErrors: [] });
  });
});
