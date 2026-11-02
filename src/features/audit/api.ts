import { api } from '../../auth/session';
import type { Page } from '../sources/api';

export type AuditEvent = {
  stream: string;
  seq: number | string;
  occurredAt: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  payload: Record<string, unknown>;
  reason: string | null;
  prevHash: string;
  hash: string;
};

export type VerifyResult = {
  valid: boolean;
  streamsChecked: number;
  eventsChecked: number;
  firstBroken: { stream: string; seq: number; reason: string } | null;
};

export type AuditFilter = { stream?: string; action?: string; entity?: string; entityId?: string };

export const listEvents = (filter: AuditFilter, cursor?: string) => {
  const q = new URLSearchParams({ limit: '50' });
  for (const [key, value] of Object.entries(filter)) if (value) q.set(key, value);
  if (cursor) q.set('cursor', cursor);
  return api<Page<AuditEvent>>(`/audit/events?${q}`);
};

export const verifyChain = (stream?: string) =>
  api<VerifyResult>(`/audit/verify${stream ? `?stream=${encodeURIComponent(stream)}` : ''}`);
