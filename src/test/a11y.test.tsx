import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Role } from '../auth/session';
import { HOUSEHOLD_REGISTER_TEMPLATE } from '../features/mappings/template';
import { a11yProblems } from './axe';
import type { Handler } from './mock-api';
import { renderApp, userFor } from './render';

afterEach(() => vi.unstubAllGlobals());

// One small, consistent fake backend for every page (synthetic data only).
const file = {
  id: 'file-1',
  sourceId: 'src-1',
  filename: 'register.csv',
  sha256: 'ab'.repeat(32),
  sizeBytes: 104_000,
  encoding: 'windows-1252',
  rowCount: 1000,
  createdAt: '2026-11-01T09:30:00Z',
  profileStatus: 'ok',
};
const source = {
  id: 'src-1',
  name: 'Household register',
  kind: 'csv',
  agency: 'Ward 3 office',
  createdBy: 'u',
  createdAt: '2026-11-01T08:00:00Z',
  fileCount: 1,
};
const column = (name: string, preeti = false) => ({
  name,
  filled: 990,
  empty: 10,
  emptyPct: 1,
  distinct: 400,
  distinctCapped: false,
  topValues: [{ value: ';Ltf', count: 3 }],
  length: { min: 2, max: 20 },
  patterns: [{ pattern: 'a a', count: 990 }],
  preeti: { share: preeti ? 0.98 : 0, likely: preeti },
  dateFormats: [],
  numeric: null,
});
const progress = {
  valid: 0,
  quarantined: 120,
  duplicate_review: 2,
  loaded: 860,
  linked: 18,
  batches: { done: 5 },
};
const run = {
  id: 'run-12345678',
  sourceFileId: 'file-1',
  mappingId: 'map-1',
  mode: 'production',
  status: 'awaiting_approval',
  counts: { total: 1000 },
  createdBy: 'user-operator',
  approvedBy: null,
  createdAt: '2026-11-01T10:00:00Z',
  startedAt: null,
  finishedAt: null,
  file: { id: 'file-1', filename: 'register.csv', rowCount: 1000 },
  source: { id: 'src-1', name: 'Household register', kind: 'csv' },
  mappingVersion: 2,
  progress,
};
const completed = {
  ...run,
  status: 'completed',
  counts: { total: 1000, loaded: 860, linked: 18, review: 2, quarantined: 120, valid: 0 },
  startedAt: '2026-11-01T10:05:00Z',
  finishedAt: '2026-11-01T10:07:00Z',
};
const mapping = {
  id: 'map-1',
  sourceId: 'src-1',
  version: 2,
  spec: HOUSEHOLD_REGISTER_TEMPLATE,
  createdBy: 'u',
  createdAt: '2026-10-31T09:00:00Z',
};
const entry = {
  id: '41',
  runId: 'run-12345678',
  rowNo: 128,
  stage: 'transform',
  reasons: [
    { field: 'dob_ad', stage: 'transform', message: 'bsToAd: 2045-13-04 is not a real BS date' },
  ],
  raw: { SN: '128', NAAM: ';Ltf yfkf', JANMA_MITI: '2045/13/4' },
  normalized: {},
  corrected: null,
  correctedAt: null,
  resolvedAt: null,
  createdAt: '2026-11-01T10:07:00Z',
};
const side = {
  stagedRowId: '10',
  runId: 'run-12345678',
  rowNo: 12,
  status: 'duplicate_review',
  name_ne: 'राम थापा',
  name_en: 'Ram Thapa',
  gender: 'male',
  dob_ad: '1988-04-12',
  father_name_ne: 'हरि थापा',
  local_unit_code: 'kaski-pokhara',
  ward_no: '3',
  hasCitizenshipNo: true,
};
const person = {
  id: 'p-1',
  name_ne: 'सीता थापा',
  name_en: 'Sita Thapa',
  gender: 'female',
  dob_ad: '1988-04-12',
  dob_bs: '2044-12-30',
  citizenship_no: '**-**-**-12345',
  citizenship_no_masked: true,
  father_name_ne: 'हरि थापा',
  household: {
    id: 'h',
    local_unit_code: 'kaski-pokhara',
    ward_no: 3,
    tole: 'Naya Bazar',
    is_head: true,
  },
  created_by_run: 'run-12345678',
};
const report = {
  runId: 'run-12345678',
  mode: 'production',
  ok: true,
  counts: {
    profiled: 1000,
    extracted: 1000,
    loaded: 860,
    linked: 18,
    quarantined: 120,
    pendingReview: 2,
    valid: 0,
    balanced: true,
    problems: [],
  },
  checksums: [{ field: 'name_ne', source: 'a'.repeat(64), target: 'a'.repeat(64), match: true }],
  sample: { size: 20, rowNos: [], mismatches: [] },
};
const catalog = {
  targets: [
    'person.name_ne',
    'person.name_en',
    'person.gender',
    'person.dob_ad',
    'person.citizenship_no',
    'person.father_name_ne',
    'household.no',
    'household.local_unit_code',
    'household.ward_no',
    'household.tole',
  ],
  requiredTargets: ['person.name_ne', 'person.name_en'],
  transforms: ['trim', 'titleCase', 'devanagariDigits', 'preetiToUnicode', 'vdcToLocalUnit']
    .map((name) => ({ name, args: {} }))
    .concat([
      {
        name: 'bsToAd',
        args: { type: 'object', properties: { formats: { type: 'array' } } } as never,
      },
      {
        name: 'mapValues',
        args: { type: 'object', properties: { values: { type: 'object' } } } as never,
      },
    ]),
  rules: [
    { name: 'required', param: null },
    { name: 'after', param: 'date' },
    { name: 'maxLength', param: 'number' },
    { name: 'citizenshipFormat', param: null },
    { name: 'notFuture', param: null },
    { name: 'max', param: 'number' },
    { name: 'wardInUnit', param: null },
  ],
  bsDateFormats: ['YYYY/M/D', 'YYYY-MM-DD'],
  onError: ['quarantine', 'null'],
};
const page = <T,>(data: T[]) => [200, { data, nextCursor: null }] as [number, unknown];

const backend: Record<string, Handler> = {
  'GET /health/ready': [200, { status: 'ok', checks: { postgres: { status: 'up' } } }],
  'GET /api/v1/sources': page([source]),
  'GET /api/v1/sources/src-1': [200, source],
  'GET /api/v1/sources/src-1/files': [200, [file]],
  'GET /api/v1/sources/src-1/mappings': [200, [mapping]],
  'GET /api/v1/files/file-1/profile': [
    200,
    {
      status: 'ok',
      encoding: 'windows-1252',
      rowCount: 1000,
      raggedRows: 3,
      columns: [
        column('NAAM', true),
        column('NAAM_EN'),
        {
          ...column('JANMA_MITI'),
          dateFormats: [
            { format: 'YYYY/M/D', count: 600 },
            { format: 'D/M/YYYY', count: 390 },
          ],
        },
      ],
    },
  ],
  'GET /api/v1/mappings/catalog': [200, catalog],
  'GET /api/v1/mappings/map-1': [200, mapping],
  'GET /api/v1/runs': (req) =>
    req.query.get('status') === 'completed' ? page([completed]) : page([run, completed]),
  'GET /api/v1/runs/run-12345678': [200, run],
  'GET /api/v1/runs/run-done': [200, { ...completed, id: 'run-done' }],
  'GET /api/v1/runs/run-12345678/events': () => new Response(null, { status: 204 }),
  'GET /api/v1/runs/run-12345678/approvals': [
    200,
    [
      {
        id: 'ap',
        runId: 'run-12345678',
        requestedBy: 'user-operator',
        decidedBy: null,
        decision: null,
        reason: null,
        expiresAt: '2030-01-01T00:00:00Z',
        createdAt: '2026-11-01T10:01:00Z',
        decidedAt: null,
      },
    ],
  ],
  'GET /api/v1/runs/run-done/approvals': [200, []],
  'GET /api/v1/runs/run-12345678/reconciliation': [200, report],
  'GET /api/v1/quarantine': page([entry]),
  'GET /api/v1/quarantine/41': [200, { ...entry, runId: 'run-done' }],
  'GET /api/v1/matches': page([
    {
      id: '7',
      score: 0.9,
      features: { name: 1, dob: 0.5, father: 1, citizenship: 'same' },
      row: { ...side, dob_ad: null },
      match: { ...side, stagedRowId: '3', rowNo: 4, status: 'loaded' },
    },
  ]),
  'GET /api/v1/persons': page([person]),
  'GET /api/v1/persons/p-1': [200, person],
  'GET /api/v1/persons/p-1/lineage': [
    200,
    [{ rawRowId: '501', runId: 'run-12345678', mappingId: 'map-1', batchId: 'batch-1' }],
  ],
  'GET /api/v1/audit/events': page([
    {
      stream: 'global',
      seq: 2,
      occurredAt: '2026-11-02T08:00:00Z',
      actorId: 'user-auditor',
      action: 'person.unmasked',
      entity: 'person',
      entityId: 'p-1',
      payload: { field: 'citizenship_no' },
      reason: 'Complaint ref 42',
      prevHash: 'a'.repeat(64),
      hash: 'b'.repeat(64),
    },
  ]),
};

/** Each page, who sees it, and something on it to wait for before checking. */
const PAGES: [string, Role | null, string, RegExp][] = [
  ['sign in', null, '/login', /Old registers in/],
  ['home', 'operator', '/', /Welcome/],
  ['sources', 'operator', '/sources', /Sources/],
  ['new source', 'operator', '/sources/new', /New source/],
  ['source and upload', 'operator', '/sources/src-1', /Household register/],
  ['file profile', 'operator', '/sources/src-1/files/file-1', /Profile of register\.csv/],
  [
    'mapping editor',
    'operator',
    '/sources/src-1/mappings/new?from=map-1',
    /New version from version 2/,
  ],
  ['mapping version', 'operator', '/sources/src-1/mappings/map-1', /Mapping version 2/],
  ['runs', 'operator', '/runs', /Runs/],
  ['new run', 'operator', '/runs/new?sourceId=src-1', /New run/],
  ['run waiting for approval', 'approver', '/runs/run-12345678', /Production of register\.csv/],
  ['approvals', 'approver', '/approvals', /Approvals/],
  [
    'reconciliation report',
    'auditor',
    '/runs/run-12345678/reconciliation',
    /Reconciliation report/,
  ],
  ['reports', 'auditor', '/reports', /Reconciliation reports/],
  ['quarantine', 'operator', '/quarantine?runId=run-12345678', /Quarantine/],
  ['fix a row', 'operator', '/quarantine/41', /Row 128/],
  ['duplicate review', 'reviewer', '/matches', /Duplicate review/],
  ['records', 'operator', '/persons', /Records/],
  ['person with lineage', 'auditor', '/persons/p-1', /Sita Thapa/],
  ['audit trail', 'auditor', '/audit', /Audit trail/],
  ['system status', 'operator', '/status', /System status/],
];

describe('accessibility (axe-core, WCAG serious and critical rules)', () => {
  it.each(PAGES)('has no serious problems on the %s page', async (_name, role, route, heading) => {
    renderApp({ route, user: role ? userFor(role) : undefined, handlers: backend });
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    await screen.findAllByText(/./); // let pending requests settle
    expect(await a11yProblems()).toEqual([]);
  });

  it('has no serious problems with a decision dialog open', async () => {
    renderApp({ route: '/approvals', user: userFor('approver'), handlers: backend });
    await userEvent.click(await screen.findByRole('button', { name: 'Approve…' }));
    expect(await a11yProblems()).toEqual([]);
  });
});
