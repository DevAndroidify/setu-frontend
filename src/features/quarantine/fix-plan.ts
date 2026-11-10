import type { FieldSpec } from '../mappings/api';
import { valueKey } from '../mappings/spec';
import type { QuarantineEntry } from './api';

export type ColumnPlan = {
  column: string;
  /** Normalized fields read from this column ("dob_ad"). */
  reads: string[];
  /** A field read from this column failed: the row is tinted and gets an input. */
  failing: boolean;
  /** Offered for a fix: failing columns, or every column if none can be tied to a reason. */
  editable: boolean;
  /** What Setu made of it: the normalized values of the fields it feeds. */
  made: string[];
  /** The reasons of the failing fields it feeds, in place of a value. */
  problems: string[];
};

/** Each legacy column of a held row, as the fix table shows it; failing columns first. */
export function columnPlan(
  entry: Pick<QuarantineEntry, 'raw' | 'normalized' | 'reasons'>,
  fields: FieldSpec[],
): ColumnPlan[] {
  const failingFields = new Set(entry.reasons.map((r) => r.field));
  const plan = Object.keys(entry.raw).map((column) => {
    const reads = fields.filter((f) => f.from.includes(column)).map((f) => valueKey(f.target));
    const failing = reads.some((k) => failingFields.has(k));
    return {
      column,
      reads,
      failing,
      editable: failing,
      made: failing ? [] : reads.map((k) => entry.normalized[k]).filter((v): v is string => !!v),
      problems: entry.reasons.filter((r) => reads.includes(r.field)).map((r) => r.message),
    };
  });
  if (!plan.some((c) => c.failing)) plan.forEach((c) => (c.editable = true));
  return plan.sort((a, b) => Number(b.failing) - Number(a.failing));
}

/** "•••••••• 4417": enough to tell numbers apart, not enough to use one. */
export function maskCitizenship(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length > 4 ? `•••••••• ${digits.slice(-4)}` : '••••';
}

/** A reason without the name of the step that raised it ("bsToAd: …"). */
export const withoutStep = (message: string): string => message.replace(/^\w+:\s*/, '');
