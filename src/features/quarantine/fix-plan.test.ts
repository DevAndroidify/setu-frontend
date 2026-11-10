import type { FieldSpec } from '../mappings/api';
import type { QuarantineEntry } from './api';
import { columnPlan, maskCitizenship, withoutStep } from './fix-plan';

const field = (target: string, from: string[]): FieldSpec => ({
  target,
  from,
  transforms: [],
  rules: [],
  onError: 'quarantine',
});

const entry = {
  reasons: [
    { field: 'dob_ad', stage: 'transform', message: 'bsToAd: 2080-13-02 is not a real BS date' },
  ],
  raw: { NAME_NP: '/fd yfkf', DOB_BS: '2080/13/02', NOTE: 'x' },
  normalized: { name_ne: 'राम थापा', dob_ad: null },
} as unknown as QuarantineEntry;

describe('the fix table', () => {
  it('puts columns behind a failing field first, with the reason in place of a value', () => {
    const plan = columnPlan(entry, [
      field('person.name_ne', ['NAME_NP']),
      field('person.dob_ad', ['DOB_BS']),
    ]);
    expect(plan.map((c) => [c.column, c.failing, c.editable, c.made, c.problems])).toEqual([
      ['DOB_BS', true, true, [], ['bsToAd: 2080-13-02 is not a real BS date']],
      ['NAME_NP', false, false, ['राम थापा'], []],
      ['NOTE', false, false, [], []],
    ]);
  });

  it('lets every column be fixed when no column can be tied to the reason', () => {
    const plan = columnPlan(entry, []);
    expect(plan.every((c) => c.editable && !c.failing)).toBe(true);
  });
});

describe('small helpers', () => {
  it('masks a citizenship number down to its last four digits', () => {
    expect(maskCitizenship('27-01-74-04417')).toBe('•••••••• 4417');
    expect(maskCitizenship('123')).toBe('••••');
  });

  it('drops the step name from a reason', () => {
    expect(withoutStep('bsToAd: 2080-13-02 is not a real BS date')).toBe(
      '2080-13-02 is not a real BS date',
    );
    expect(withoutStep('is required for a household')).toBe('is required for a household');
  });
});
