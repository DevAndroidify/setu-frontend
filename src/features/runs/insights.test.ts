import type { MappingSpec, PreviewRow } from '../mappings/api';
import type { QuarantineEntry } from '../quarantine/api';
import type { RunDetail } from './api';
import { fixExamples, heldReasons, reasonText, rowSplit, stageProgress } from './insights';

const run = (over: Partial<RunDetail> = {}): RunDetail => ({
  id: 'run-1',
  sourceFileId: 'file-1',
  mappingId: 'map-1',
  mode: 'production',
  status: 'running',
  counts: { total: 1000 },
  createdBy: 'u',
  approvedBy: null,
  createdAt: '2026-10-25T10:00:00Z',
  startedAt: null,
  finishedAt: null,
  file: { id: 'file-1', filename: 'register.csv', rowCount: 1000 },
  source: { id: 'src-1', name: 'Household register', kind: 'csv' },
  mappingVersion: 2,
  progress: { valid: 0, quarantined: 0, duplicate_review: 0, loaded: 0, linked: 0, batches: {} },
  ...over,
});

describe('stage progress', () => {
  it('counts a batch as done with every stage before the one it is in', () => {
    const r = run({ progress: { ...run().progress, batches: { validate: 2, load: 1, done: 7 } } });
    expect(stageProgress(r).map((s) => [s.stage, s.done, s.total, s.state])).toEqual([
      ['extract', 10, 10, 'done'],
      ['transform', 10, 10, 'done'],
      ['validate', 8, 10, 'now'],
      ['match', 8, 10, 'following'],
      ['load', 7, 10, 'following'],
      ['reconcile', 0, 10, 'afterLoad'],
    ]);
  });

  it('shows a dry run as extract, transform and validate only', () => {
    const r = run({ mode: 'dry_run', progress: { ...run().progress, batches: { done: 4 } } });
    expect(stageProgress(r).map((s) => s.stage)).toEqual(['extract', 'transform', 'validate']);
    expect(stageProgress(r).every((s) => s.state === 'done')).toBe(true);
  });

  it('marks reconcile done once the run has completed', () => {
    const r = run({ status: 'completed', progress: { ...run().progress, batches: { done: 3 } } });
    expect(stageProgress(r).at(-1)).toMatchObject({ stage: 'reconcile', done: 3, state: 'done' });
  });

  it('waits on every stage before any batch exists', () => {
    expect(stageProgress(run()).map((s) => s.state)).toEqual([
      'waiting',
      'waiting',
      'waiting',
      'waiting',
      'waiting',
      'afterLoad',
    ]);
  });
});

describe('where the rows went', () => {
  it('splits a production run into loaded, linked, held, review and still to go', () => {
    const r = run({
      progress: {
        valid: 5,
        quarantined: 100,
        duplicate_review: 20,
        loaded: 700,
        linked: 30,
        batches: {},
      },
    });
    expect(rowSplit(r)).toEqual({
      total: 1000,
      parts: [
        { kind: 'loaded', value: 700 },
        { kind: 'linked', value: 30 },
        { kind: 'held', value: 100 },
        { kind: 'review', value: 20 },
      ],
      toGo: 150,
    });
  });

  it('counts rows that passed every check as the result of a dry run', () => {
    const r = run({
      mode: 'dry_run',
      progress: {
        valid: 880,
        quarantined: 120,
        duplicate_review: 0,
        loaded: 0,
        linked: 0,
        batches: {},
      },
    });
    expect(rowSplit(r)).toEqual({
      total: 1000,
      parts: [
        { kind: 'passed', value: 880 },
        { kind: 'held', value: 120 },
      ],
      toGo: 0,
    });
  });
});

describe('why rows are held', () => {
  it('drops the value from a reason so the same problem is counted once', () => {
    expect(reasonText('bsToAd: 2045-13-04 is not a real BS date')).toBe('is not a real BS date');
    expect(reasonText('"Hemja Gaun" is not a VDC in the crosswalk')).toBe(
      'is not a VDC in the crosswalk',
    );
    expect(reasonText('is required for a household')).toBe('is required for a household');
    expect(reasonText('must be at most 9')).toBe('must be at most 9');
  });

  it('groups reasons by field and message, most common first', () => {
    const entry = (reasons: [string, string][]) =>
      ({
        reasons: reasons.map(([field, message]) => ({ field, stage: 'validate', message })),
      }) as QuarantineEntry;
    const groups = heldReasons([
      entry([['dob_ad', 'bsToAd: 2045-13-04 is not a real BS date']]),
      entry([
        ['dob_ad', 'bsToAd: 2046-14-01 is not a real BS date'],
        ['name_en', 'is required'],
      ]),
      entry([['ward_no', 'is required']]),
      entry([['dob_ad', 'bsToAd: 2047-15-02 is not a real BS date']]),
    ]);
    expect(groups).toEqual([
      { field: 'dob_ad', message: 'is not a real BS date', count: 3 },
      { field: 'name_en', message: 'is required', count: 1 },
      { field: 'ward_no', message: 'is required', count: 1 },
    ]);
  });
});

describe('what Setu fixed on the way', () => {
  const spec: MappingSpec = {
    fields: [
      {
        target: 'person.name_en',
        from: ['name'],
        transforms: [{ name: 'trim' }],
        rules: [],
        onError: 'quarantine',
      },
      {
        target: 'person.name_ne',
        from: ['name_np'],
        transforms: [{ name: 'preetiToUnicode' }],
        rules: [],
        onError: 'quarantine',
      },
      {
        target: 'person.dob_ad',
        from: ['dob'],
        transforms: [{ name: 'bsToAd' }],
        rules: [],
        onError: 'quarantine',
      },
      {
        target: 'household.local_unit_code',
        from: ['district', 'vdc'],
        transforms: [{ name: 'vdcToLocalUnit' }],
        rules: [],
        onError: 'quarantine',
      },
    ],
  };
  const row = (raw: Record<string, string>, values: Record<string, string | null>) =>
    ({ rowNo: 1, raw, values, warnings: [], errors: [], status: 'valid' }) as PreviewRow;

  it('takes one before and after for each kind of fix, in a fixed order', () => {
    const rows = [
      row(
        { name_np: '', dob: '2080/11/17', district: 'Kaski', vdc: 'Hemja VDC' },
        { name_ne: null, dob_ad: '2024-02-29', local_unit_code: 'kaski-pokhara' },
      ),
      row(
        { name_np: '/fd yfkf', dob: '', district: '', vdc: '' },
        { name_ne: 'राम थापा', dob_ad: null, local_unit_code: null },
      ),
    ];
    expect(fixExamples(spec, rows)).toEqual([
      { kind: 'preetiToUnicode', before: '/fd yfkf', after: 'राम थापा' },
      { kind: 'bsToAd', before: '2080/11/17', after: '2024-02-29' },
      { kind: 'vdcToLocalUnit', before: 'Kaski Hemja VDC', after: 'kaski-pokhara' },
    ]);
  });

  it('leaves out a kind the mapping does not use or the file never needed', () => {
    const rows = [
      row(
        { name_np: 'same', dob: '', district: '', vdc: '' },
        { name_ne: 'same', dob_ad: null, local_unit_code: null },
      ),
    ];
    expect(fixExamples(spec, rows)).toEqual([]);
  });
});
