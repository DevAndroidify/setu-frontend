/** A field-level problem from the backend's validation (zod) errors. */
export type FieldError = { path: string; message: string };

/**
 * An error answer from the backend, read from its RFC 9457 problem+json body. `requestId` is
 * the backend's X-Request-Id: shown on error screens so the request can be found in the logs.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string | undefined,
    readonly fieldErrors: FieldError[],
    readonly requestId: string | null,
  ) {
    super(detail ?? title);
    this.name = 'ApiError';
  }
}

/** Every API route lives under /api/v1 (health and metrics do not). */
export const apiPath = (path: string): string => `/api/v1${path}`;

async function toApiError(res: Response): Promise<ApiError> {
  const requestId = res.headers.get('x-request-id');
  let body: { title?: string; detail?: string; errors?: FieldError[] } = {};
  try {
    body = await res.json();
  } catch {
    // not JSON (e.g. a proxy's HTML error page): fall back to the status line
  }
  return new ApiError(
    res.status,
    body.title ?? (res.statusText || `HTTP ${res.status}`),
    body.detail,
    body.errors ?? [],
    requestId,
  );
}

/**
 * fetch for the Setu API: JSON in and out, same-origin cookies (the refresh token), and
 * problem+json answers thrown as ApiError. Network failures are thrown as they come.
 */
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const sendsJson = typeof init.body === 'string';
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(sendsJson ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('json') ? res.json() : res.text()) as Promise<T>;
}
