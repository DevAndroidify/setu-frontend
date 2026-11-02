import { api } from '../../auth/session';
import type { Page } from '../sources/api';

export type Person = {
  id: string;
  name_ne: string;
  name_en: string;
  gender: 'male' | 'female' | 'other' | null;
  dob_ad: string | null;
  /** Present when asked for with ?calendar=bs; converted at the API edge. */
  dob_bs?: string | null;
  /** Masked to the last five digits unless unmasked with a reason. */
  citizenship_no: string | null;
  citizenship_no_masked: boolean;
  father_name_ne: string | null;
  household: {
    id: string;
    local_unit_code: string;
    ward_no: number;
    tole: string | null;
    is_head: boolean;
  } | null;
  created_by_run: string | null;
};

export type LineageLink = { rawRowId: string; runId: string; mappingId: string; batchId: string };

export const searchPersons = (filter: { q?: string; localUnit?: string }, cursor?: string) => {
  const q = new URLSearchParams({ limit: '25', calendar: 'bs' });
  if (filter.q) q.set('q', filter.q);
  if (filter.localUnit) q.set('localUnit', filter.localUnit);
  if (cursor) q.set('cursor', cursor);
  return api<Page<Person>>(`/persons?${q}`);
};

export const getPerson = (id: string) => api<Person>(`/persons/${id}?calendar=bs`);

/** The full citizenship number. The backend writes the reason to the audit trail. */
export const unmaskPerson = (id: string, reason: string) =>
  api<Person>(`/persons/${id}?${new URLSearchParams({ calendar: 'bs', unmask: 'true', reason })}`);

export const getLineage = (id: string) => api<LineageLink[]>(`/persons/${id}/lineage`);

export const GENDER: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other' };
