import { vi } from 'vitest';

export type MockRequest = {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  headers: Headers;
};

/** [status, JSON body, extra headers], or a function of the request returning one. */
export type Answer = [number, unknown?, Record<string, string>?];
/** A function handler may also return a Response, e.g. a streamed event-stream body. */
export type Handler = Answer | ((req: MockRequest) => Answer | Response);

/** A problem+json body like the backend's. */
export const problem = (status: number, detail: string, errors?: unknown[]) => ({
  type: 'about:blank',
  title:
    {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      415: 'Unsupported Media Type',
      429: 'Too Many Requests',
    }[status] ?? 'Error',
  status,
  detail,
  ...(errors ? { errors } : {}),
});

/**
 * Replaces fetch with a tiny fake backend. Keys are "METHOD /path", where a path segment
 * written ":name" matches anything. Unmatched requests fail the test loudly.
 */
export function mockApi(handlers: Record<string, Handler>) {
  const calls: MockRequest[] = [];
  const routes = Object.entries(handlers).map(([key, handler]) => {
    const [method, pattern] = key.split(' ') as [string, string];
    const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`);
    return { method, regex, handler };
  });

  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    let body: unknown = init.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // leave as text
      }
    }
    const req: MockRequest = {
      method,
      path: url.pathname,
      query: url.searchParams,
      body,
      headers: new Headers(init.headers),
    };
    calls.push(req);
    const route = routes.find((r) => r.method === method && r.regex.test(url.pathname));
    if (!route) throw new Error(`Unexpected request in test: ${method} ${url.pathname}`);
    const answer = typeof route.handler === 'function' ? route.handler(req) : route.handler;
    if (answer instanceof Response) return answer;
    const [status, json, headers = {}] = answer;
    const contentType = status >= 400 ? 'application/problem+json' : 'application/json';
    return new Response(status === 204 || json === undefined ? null : JSON.stringify(json), {
      status,
      headers: { 'content-type': contentType, 'x-request-id': 'req-test', ...headers },
    });
  });
  vi.stubGlobal('fetch', fetch);
  return { calls, fetch };
}
