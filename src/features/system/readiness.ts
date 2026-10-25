export type CheckStatus = { status: 'up' | 'down'; error?: string };

export type Readiness = {
  ok: boolean;
  checks: Record<string, CheckStatus>;
};

/**
 * The backend's readiness probe. 503 is an answer here, not an error: it lists which
 * dependency is down. Only an unreachable API throws.
 */
export async function getReadiness(): Promise<Readiness> {
  const res = await fetch('/health/ready', { headers: { Accept: 'application/json' } });
  if (res.status !== 200 && res.status !== 503) {
    throw new Error(`The API answered ${res.status}`);
  }
  const body = (await res.json()) as { checks?: Record<string, CheckStatus> };
  return { ok: res.status === 200, checks: body.checks ?? {} };
}
