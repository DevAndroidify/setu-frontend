import { api } from '../../auth/session';
import type { Page } from '../sources/api';

/** One side of a pair, as the backend shows it to reviewers (never the citizenship number). */
export type MatchRow = {
  stagedRowId: string;
  runId: string;
  rowNo: number;
  status: string;
  name_ne: string;
  name_en: string;
  gender: string | null;
  dob_ad: string | null;
  father_name_ne: string | null;
  local_unit_code: string | null;
  ward_no: string | null;
  hasCitizenshipNo: boolean;
};

export type MatchCandidate = {
  id: string;
  score: number;
  features: {
    name: number;
    dob: number;
    father: number;
    citizenship: 'same' | 'different' | 'unknown';
  };
  /** The row held for review. */
  row: MatchRow;
  /** The record it may be: already in the register, or an earlier row of the run. */
  match: MatchRow;
};

export type MatchDecision = 'link' | 'not_same';

export const listMatches = (filter: { runId?: string }, cursor?: string) => {
  const q = new URLSearchParams({ limit: '20' });
  if (filter.runId) q.set('runId', filter.runId);
  if (cursor) q.set('cursor', cursor);
  return api<Page<MatchCandidate>>(`/matches?${q}`);
};

export const decideMatch = (id: string, decision: MatchDecision, reason: string) =>
  api<{ id: string; decision: MatchDecision; rowStatus: string }>(`/matches/${id}/decision`, {
    method: 'POST',
    body: JSON.stringify({ decision, reason }),
  });

/** The fields shown side by side, in the order a reviewer compares them. */
export const COMPARED: { key: keyof MatchRow; label: string }[] = [
  { key: 'name_ne', label: 'Name (Nepali)' },
  { key: 'name_en', label: 'Name (English)' },
  { key: 'dob_ad', label: 'Date of birth (AD)' },
  { key: 'gender', label: 'Gender' },
  { key: 'father_name_ne', label: "Father's name" },
  { key: 'local_unit_code', label: 'Local unit' },
  { key: 'ward_no', label: 'Ward' },
];

/** How strongly the score says "same person", in words. */
export function scoreWords(score: number): string {
  if (score >= 0.95) return 'almost certainly the same';
  if (score >= 0.9) return 'very likely the same';
  return 'possibly the same';
}
