import type { FieldError } from '../../api/client';
import type { Catalog, FieldSpec, MappingSpec, TransformStep } from './api';

/** Plain-language names for targets, transforms and rules (the catalog gives only ids). */
export const TARGET_LABELS: Record<string, string> = {
  'person.name_ne': 'Name in Nepali',
  'person.name_en': 'Name in English',
  'person.gender': 'Gender',
  'person.dob_ad': 'Date of birth (stored in AD)',
  'person.citizenship_no': 'Citizenship number',
  'person.father_name_ne': "Father's name in Nepali",
  'household.no': 'Household number',
  'household.local_unit_code': 'Local unit (from old VDC)',
  'household.ward_no': 'Ward number',
  'household.tole': 'Tole',
};

export const TRANSFORM_LABELS: Record<string, string> = {
  trim: 'Trim spaces',
  titleCase: 'Title Case',
  devanagariDigits: 'Devanagari digits → 0-9',
  preetiToUnicode: 'Preeti font → Unicode',
  bsToAd: 'BS date → AD',
  fiscalYear: 'BS date → fiscal year',
  namePart: 'Part of a name',
  mapValues: 'Replace codes',
  vdcToLocalUnit: 'Old VDC → local unit',
};

export const RULE_LABELS: Record<string, string> = {
  required: 'Required',
  notFuture: 'Not in the future',
  after: 'On or after date',
  citizenshipFormat: 'Citizenship number format',
  maxLength: 'At most N characters',
  max: 'At most N',
  wardInUnit: 'Ward exists in the local unit',
};

export const targetLabel = (t: string) => TARGET_LABELS[t] ?? t;

const HOUSEHOLD_KEYS: Record<string, string> = {
  household_no: 'household.no',
  local_unit_code: 'household.local_unit_code',
  ward_no: 'household.ward_no',
  tole: 'household.tole',
};

/** A normalized field ("dob_ad", "ward_no") as the label of the target it fills. */
export const fieldLabel = (field: string) =>
  targetLabel(HOUSEHOLD_KEYS[field] ?? `person.${field}`);
export const transformLabel = (n: string) => TRANSFORM_LABELS[n] ?? n;
export const ruleLabel = (n: string) => RULE_LABELS[n] ?? n;

/** "household.ward_no" -> the key preview rows use for it ("ward_no"). */
export function valueKey(target: string): string {
  const [entity, field = ''] = target.split('.');
  if (entity === 'household' && field === 'no') return 'household_no';
  return field;
}

export const emptyField = (target = ''): FieldSpec => ({
  target,
  from: [],
  transforms: [],
  rules: [],
  onError: 'quarantine',
});

/** Default arguments for a newly added step, so it is valid before the user edits it. */
export function defaultArgs(name: string, catalog: Catalog): unknown {
  if (name === 'bsToAd' || name === 'fiscalYear') return { formats: [...catalog.bsDateFormats] };
  if (name === 'namePart') return { part: 'first' };
  if (name === 'mapValues') return { values: { '': '' } };
  return undefined;
}

export function newStep(name: string, catalog: Catalog): TransformStep {
  const args = defaultArgs(name, catalog);
  return args === undefined ? { name } : { name, args };
}

export function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

/** Removes empty bits the editor allows while typing (blank source columns, empty codes). */
export function cleanSpec(spec: MappingSpec): MappingSpec {
  return {
    fields: spec.fields.map((f) => ({
      ...f,
      from: f.from.map((c) => c.trim()).filter(Boolean),
      transforms: f.transforms.map((s) =>
        s.name === 'mapValues' && s.args && typeof s.args === 'object'
          ? {
              ...s,
              args: {
                ...(s.args as object),
                values: Object.fromEntries(
                  Object.entries((s.args as { values: Record<string, string> }).values).filter(
                    ([k]) => k.trim() !== '',
                  ),
                ),
              },
            }
          : s,
      ),
    })),
  };
}

/** Problems worth fixing before asking the backend; it checks everything else on save. */
export function draftProblems(spec: MappingSpec, catalog: Catalog): string[] {
  const problems: string[] = [];
  const targets = spec.fields.map((f) => f.target);
  for (const required of catalog.requiredTargets) {
    if (!targets.includes(required)) problems.push(`${targetLabel(required)} must be mapped`);
  }
  spec.fields.forEach((f, i) => {
    const name = f.target ? targetLabel(f.target) : `Field ${i + 1}`;
    if (!f.target) problems.push(`${name}: choose what it maps to`);
    if (f.from.length === 0) problems.push(`${name}: choose at least one source column`);
    if (targets.indexOf(f.target) !== i && f.target) problems.push(`${name} is mapped twice`);
  });
  return problems;
}

/**
 * Backend validation errors by field index: "fields.2.transforms.0" (save) and
 * "spec.fields.2.rules.1" (draft preview) both belong to field 2.
 */
export function errorsByField(errors: FieldError[]): {
  byField: Map<number, string[]>;
  other: string[];
} {
  const byField = new Map<number, string[]>();
  const other: string[] = [];
  for (const e of errors) {
    const m = /^(?:spec\.)?fields\.(\d+)(?:\.(.+))?$/.exec(e.path);
    if (!m) {
      other.push(e.path ? `${e.path}: ${e.message}` : e.message);
      continue;
    }
    const index = Number(m[1]);
    const where = m[2] ? `${m[2].replace(/\.(\d+)/g, ' $1')}: ` : '';
    byField.set(index, [...(byField.get(index) ?? []), `${where}${e.message}`]);
  }
  return { byField, other };
}

/** One line per step and rule, for read-only views: "Preeti font → Unicode, Trim spaces". */
export function describeField(f: FieldSpec): { steps: string; rules: string } {
  return {
    steps: f.transforms.map((s) => transformLabel(s.name)).join(' → ') || 'as is',
    rules:
      f.rules
        .map((r) => {
          const [name = '', param] = r.split(':');
          return param ? `${ruleLabel(name)} (${param})` : ruleLabel(name);
        })
        .join(', ') || 'none',
  };
}
