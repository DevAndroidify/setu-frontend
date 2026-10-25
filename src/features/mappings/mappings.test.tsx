import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Handler, problem } from '../../test/mock-api';
import { renderApp, userFor } from '../../test/render';
import type { Catalog, Preview } from './api';
import { HOUSEHOLD_REGISTER_TEMPLATE } from './template';

afterEach(() => vi.unstubAllGlobals());

const catalog: Catalog = {
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
  transforms: [
    { name: 'trim', args: {} },
    { name: 'titleCase', args: {} },
    { name: 'preetiToUnicode', args: {} },
    { name: 'devanagariDigits', args: {} },
    { name: 'bsToAd', args: { type: 'object', properties: { formats: { type: 'array' } } } },
    {
      name: 'mapValues',
      args: { type: 'object', properties: { values: { type: 'object' } }, required: ['values'] },
    },
    { name: 'vdcToLocalUnit', args: {} },
  ],
  rules: [
    { name: 'required', param: null },
    { name: 'after', param: 'date' },
    { name: 'maxLength', param: 'number' },
  ],
  bsDateFormats: ['YYYY/M/D', 'YYYY-MM-DD', 'D/M/YYYY', 'YYYY.MM.DD'],
  onError: ['quarantine', 'null'],
};

const preview: Preview = {
  mappingId: null,
  version: null,
  sourceFileId: 'file-1',
  summary: { rows: 2, valid: 1, quarantined: 1 },
  rows: [
    {
      rowNo: 1,
      raw: { NAAM: ';Ltf', NAAM_EN: 'SITA MAGAR' },
      values: { name_ne: 'सीता', name_en: 'Sita Magar' },
      warnings: [],
      errors: [],
      status: 'valid',
    },
    {
      rowNo: 2,
      raw: { NAAM: '', NAAM_EN: 'Ram' },
      values: { name_ne: null, name_en: 'Ram' },
      warnings: [],
      errors: [{ field: 'name_ne', stage: 'validate', message: 'required: is required' }],
      status: 'quarantined',
    },
  ],
};

const base = (extra: Record<string, Handler> = {}): Record<string, Handler> => ({
  'GET /api/v1/mappings/catalog': [200, catalog],
  'GET /api/v1/sources/src-1': [
    200,
    {
      id: 'src-1',
      name: 'Household register',
      kind: 'csv',
      agency: 'Ward 3',
      createdBy: 'u',
      createdAt: '2026-10-20T08:00:00Z',
      fileCount: 1,
    },
  ],
  'GET /api/v1/sources/src-1/files': [
    200,
    [
      {
        id: 'file-1',
        sourceId: 'src-1',
        filename: 'register.csv',
        sha256: 'a',
        sizeBytes: 1,
        encoding: 'windows-1252',
        rowCount: 2,
        createdAt: '2026-10-21T09:30:00Z',
        profileStatus: 'ok',
      },
    ],
  ],
  'GET /api/v1/files/file-1/profile': [
    200,
    {
      status: 'ok',
      encoding: 'windows-1252',
      rowCount: 2,
      raggedRows: 0,
      columns: ['NAAM', 'NAAM_EN', 'LINGA'].map((name) => ({
        name,
        filled: 2,
        empty: 0,
        emptyPct: 0,
        distinct: 2,
        distinctCapped: false,
        topValues: [],
        length: null,
        patterns: [],
        preeti: { share: 0, likely: false },
        dateFormats: [],
        numeric: null,
      })),
    },
  ],
  ...extra,
});

const operator = userFor('operator');

describe('mapping editor', () => {
  it('builds a mapping in the form, previews the draft without saving, and shows errors in their cells', async () => {
    const { api } = renderApp({
      route: '/sources/src-1/mappings/new',
      user: operator,
      handlers: base({ 'POST /api/v1/sources/src-1/mappings/preview': [200, preview] }),
    });
    const nepali = await screen.findByRole('article', { name: 'Name in Nepali' });
    await userEvent.type(within(nepali).getByLabelText('Source columns'), 'NAAM{Enter}');
    await userEvent.selectOptions(
      within(nepali).getByLabelText('Add a transform'),
      'preetiToUnicode',
    );
    await userEvent.selectOptions(within(nepali).getByLabelText('Add a check'), 'required');
    const english = screen.getByRole('article', { name: 'Name in English' });
    await userEvent.type(within(english).getByLabelText('Source columns'), 'NAAM_EN{Enter}');

    await userEvent.click(screen.getByRole('button', { name: 'Preview 50 rows' }));
    expect(await screen.findByText('Preview (nothing was written)')).toBeInTheDocument();
    const sent = api.calls.find((c) => c.path.endsWith('/mappings/preview'))!.body as {
      spec: { fields: unknown[] };
      sourceFileId: string;
    };
    expect(sent.sourceFileId).toBe('file-1');
    expect(sent.spec.fields[0]).toEqual({
      target: 'person.name_ne',
      from: ['NAAM'],
      transforms: [{ name: 'preetiToUnicode' }],
      rules: ['required'],
      onError: 'quarantine',
    });
    expect(screen.getByText('सीता')).toBeInTheDocument();
    expect(screen.getByText('was: ;Ltf')).toBeInTheDocument();
    expect(screen.getByText('required: is required').closest('td')).toHaveClass('cellError');
    expect(screen.getByText('1 would be quarantined')).toBeInTheDocument();
  });

  it('will not preview or save until the required fields have source columns', async () => {
    renderApp({ route: '/sources/src-1/mappings/new', user: operator, handlers: base() });
    expect(
      await screen.findByText('Name in Nepali: choose at least one source column'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as new version' })).toBeDisabled();
  });

  it('starts from the household register template and saves it as a new version', async () => {
    const { router, api } = renderApp({
      route: '/sources/src-1/mappings/new',
      user: operator,
      handlers: base({
        'POST /api/v1/sources/src-1/mappings': (req) => [
          201,
          {
            id: 'map-1',
            sourceId: 'src-1',
            version: 1,
            spec: req.body,
            createdBy: 'u',
            createdAt: '2026-10-25T10:00:00Z',
          },
        ],
        'GET /api/v1/mappings/map-1': [
          200,
          {
            id: 'map-1',
            sourceId: 'src-1',
            version: 1,
            spec: HOUSEHOLD_REGISTER_TEMPLATE,
            createdBy: 'u',
            createdAt: '2026-10-25T10:00:00Z',
          },
        ],
      }),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Start from the household register template' }),
    );
    expect(screen.getAllByRole('article')).toHaveLength(HOUSEHOLD_REGISTER_TEMPLATE.fields.length);
    await userEvent.click(screen.getByRole('button', { name: 'Save as new version' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/sources/src-1/mappings/map-1'),
    );
    expect(
      api.calls.find((c) => c.method === 'POST' && c.path === '/api/v1/sources/src-1/mappings')!
        .body,
    ).toEqual(HOUSEHOLD_REGISTER_TEMPLATE);
    expect(await screen.findByText('Mapping version 1 saved.')).toBeInTheDocument();
  });

  it('shows a refused save under the field it is about', async () => {
    renderApp({
      route: '/sources/src-1/mappings/new',
      user: operator,
      handlers: base({
        'POST /api/v1/sources/src-1/mappings': [
          400,
          problem(400, 'Validation failed', [
            { path: 'fields.0.rules.0', message: 'after needs a date: after:YYYY-MM-DD' },
          ]),
        ],
      }),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Start from the household register template' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save as new version' }));
    const first = screen.getAllByRole('article')[0]!;
    expect(
      await within(first).findByText('rules 0: after needs a date: after:YYYY-MM-DD'),
    ).toBeInTheDocument();
  });

  it('edits the same mapping as JSON and back', async () => {
    renderApp({ route: '/sources/src-1/mappings/new', user: operator, handlers: base() });
    await userEvent.click(await screen.findByRole('tab', { name: 'JSON' }));
    const json = screen.getByLabelText('Mapping spec');
    await userEvent.clear(json);
    await userEvent.click(json);
    await userEvent.paste(
      JSON.stringify({
        fields: [
          { target: 'person.name_en', from: ['NAAM_EN'], transforms: [{ name: 'titleCase' }] },
        ],
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));
    const card = await screen.findByRole('article', { name: 'Name in English' });
    expect(within(card).getByText('NAAM_EN')).toBeInTheDocument();
    expect(within(card).getByText('Title Case', { selector: 'strong' })).toBeInTheDocument();
  });

  it('keeps the JSON tab open and says why when the JSON is broken', async () => {
    renderApp({ route: '/sources/src-1/mappings/new', user: operator, handlers: base() });
    await userEvent.click(await screen.findByRole('tab', { name: 'JSON' }));
    const json = screen.getByLabelText('Mapping spec');
    await userEvent.clear(json);
    await userEvent.type(json, 'not json');
    await userEvent.click(screen.getByRole('button', { name: 'Apply JSON' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Mapping spec')).toBeInTheDocument();
  });
});
