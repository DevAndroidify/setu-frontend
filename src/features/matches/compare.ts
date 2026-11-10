import type { MatchCandidate } from './api';

export type FieldMatch = 'same' | 'close' | 'different' | 'unknown';

/** At or above this, the matcher found two names alike: shown as "close", not "different". */
const CLOSE = 0.85;

/**
 * How one field of the held row compares with the record it may be. Names are close when the
 * matcher scored them alike (spelling, spacing); every other field is the same or different.
 */
export function fieldMatch(
  key: string,
  a: string | null,
  b: string | null,
  features: MatchCandidate['features'],
): FieldMatch {
  const left = a?.trim() ?? '';
  const right = b?.trim() ?? '';
  if (!left || !right) return 'unknown';
  if (left === right) return 'same';
  if (key === 'name_ne' || key === 'name_en') return features.name >= CLOSE ? 'close' : 'different';
  if (key === 'father_name_ne') return features.father >= CLOSE ? 'close' : 'different';
  return 'different';
}
