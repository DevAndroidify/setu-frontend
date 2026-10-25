import type { Catalog, MappingSpec } from './api';
import {
  cleanSpec,
  draftProblems,
  emptyField,
  errorsByField,
  move,
  newStep,
  valueKey,
} from './spec';

const catalog: Catalog = {
  targets: ['person.name_ne', 'person.name_en', 'person.dob_ad', 'household.no'],
  requiredTargets: ['person.name_ne', 'person.name_en'],
  transforms: [
    { name: 'bsToAd', args: { type: 'object', properties: { formats: { type: 'array' } } } },
  ],
  rules: [{ name: 'required', param: null }],
  bsDateFormats: ['YYYY/M/D', 'YYYY-MM-DD'],
  onError: ['quarantine', 'null'],
};

describe('mapping spec helpers', () => {
  it('names the problems the backend would refuse before asking it', () => {
    const spec: MappingSpec = {
      fields: [
        { ...emptyField('person.name_en'), from: ['NAAM_EN'] },
        { ...emptyField('person.name_en'), from: [] },
        emptyField(),
      ],
    };
    expect(draftProblems(spec, catalog)).toEqual([
      'Name in Nepali must be mapped',
      'Name in English: choose at least one source column',
      'Name in English is mapped twice',
      'Field 3: choose what it maps to',
      'Field 3: choose at least one source column',
    ]);
  });

  it('files backend errors under the field they belong to, from a save or a draft preview', () => {
    const { byField, other } = errorsByField([
      { path: 'fields.1.transforms.0', message: 'unknown transform "magic"' },
      { path: 'spec.fields.1.rules.2', message: 'after needs a date' },
      { path: 'fields', message: 'person.name_en must be mapped' },
    ]);
    expect(byField.get(1)).toEqual([
      'transforms 0: unknown transform "magic"',
      'rules 2: after needs a date',
    ]);
    expect(other).toEqual(['fields: person.name_en must be mapped']);
  });

  it('starts a date step with every known format, so it is valid as added', () => {
    expect(newStep('bsToAd', catalog)).toEqual({
      name: 'bsToAd',
      args: { formats: ['YYYY/M/D', 'YYYY-MM-DD'] },
    });
    expect(newStep('trim', catalog)).toEqual({ name: 'trim' });
  });

  it('drops blank columns and blank codes before sending', () => {
    const spec = cleanSpec({
      fields: [
        {
          ...emptyField('person.gender'),
          from: [' LINGA ', ''],
          transforms: [
            { name: 'mapValues', args: { values: { M: 'male', '': '' }, caseInsensitive: true } },
          ],
        },
      ],
    });
    expect(spec.fields[0]!.from).toEqual(['LINGA']);
    expect(spec.fields[0]!.transforms[0]!.args).toEqual({
      values: { M: 'male' },
      caseInsensitive: true,
    });
  });

  it('finds the preview key of each target and moves items within bounds', () => {
    expect(valueKey('person.dob_ad')).toBe('dob_ad');
    expect(valueKey('household.no')).toBe('household_no');
    expect(move(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});
