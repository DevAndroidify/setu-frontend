import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Handler, problem } from '../../test/mock-api';
import { renderApp, userFor } from '../../test/render';
import type { QuarantineEntry } from './api';
import { retrySummary } from './api';

afterEach(() => vi.unstubAllGlobals());

const entry = (over: Partial<QuarantineEntry> = {}): QuarantineEntry => ({
  id: '41',
  runId: 'run-12345678',
  rowNo: 128,
  stage: 'transform',
  reasons: [
    { field: 'dob_ad', stage: 'transform', message: 'bsToAd: 2045-13-04 is not a real BS date' },
  ],
  raw: { SN: '128', NAAM: ';Ltf yfkf', JANMA_MITI: '2045/13/4', GABISA: 'Hemja' },
  normalized: { name_ne: 'सीता थापा' },
  corrected: null,
  correctedAt: null,
  resolvedAt: null,
  createdAt: '2026-11-01T10:00:00Z',
  ...over,
});

const run = {
  id: 'run-12345678',
  mappingId: 'map-1',
  mode: 'production',
  status: 'completed',
  counts: { total: 1000 },
  file: { id: 'f', filename: 'register.csv', rowCount: 1000 },
  source: { id: 's', name: 'Household register', kind: 'csv' },
  mappingVersion: 2,
  progress: {
    valid: 0,
    quarantined: 120,
    duplicate_review: 0,
    loaded: 880,
    linked: 0,
    batches: { done: 5 },
  },
};
const mapping = {
  id: 'map-1',
  sourceId: 's',
  version: 2,
  createdBy: 'u',
  createdAt: '2026-10-30T09:00:00Z',
  spec: {
    fields: [
      {
        target: 'person.name_ne',
        from: ['NAAM'],
        transforms: [],
        rules: [],
        onError: 'quarantine',
      },
      {
        target: 'person.dob_ad',
        from: ['JANMA_MITI'],
        transforms: [],
        rules: [],
        onError: 'quarantine',
      },
    ],
  },
};

const fixHandlers = (extra: Record<string, Handler> = {}): Record<string, Handler> => ({
  'GET /api/v1/quarantine/41': [200, entry()],
  'GET /api/v1/runs/run-12345678': [200, run],
  'GET /api/v1/mappings/map-1': [200, mapping],
  ...extra,
});

const operator = userFor('operator');

describe('retry summary', () => {
  it('says what a retry did in words', () => {
    expect(retrySummary({ retried: 3, passed: 2, stillFailing: 1, reopened: true })).toBe(
      '2 rows pass and will be placed; 1 still fails. The run is reopened to place them.',
    );
    expect(retrySummary({ retried: 0, passed: 0, stillFailing: 0, reopened: false })).toBe(
      'There were no corrected rows to retry.',
    );
  });
});

describe('quarantine list', () => {
  it('lists rows with every reason and retries the corrected ones of a run', async () => {
    const { api } = renderApp({
      route: '/quarantine?runId=run-12345678',
      user: operator,
      handlers: {
        'GET /api/v1/runs': [200, { data: [], nextCursor: null }],
        'GET /api/v1/quarantine': [
          200,
          {
            data: [
              entry({ corrected: { JANMA_MITI: '2045/12/4' } }),
              entry({ id: '42', rowNo: 300 }),
            ],
            nextCursor: null,
          },
        ],
        'POST /api/v1/quarantine/retry': [
          200,
          { retried: 1, passed: 1, stillFailing: 0, reopened: true },
        ],
      },
    });
    const row = (await screen.findByRole('link', { name: 'Row 128' })).closest('tr')!;
    expect(row).toHaveTextContent(
      'Date of birth (stored in AD): bsToAd: 2045-13-04 is not a real BS date',
    );
    expect(within(row).getByText('corrected, not retried')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry corrected rows (1)' }));
    expect(
      await screen.findByText(/1 row passes and will be placed\. The run is reopened/),
    ).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === '/api/v1/quarantine/retry')!.body).toEqual({
      runId: 'run-12345678',
    });
  });

  it('lets an admin look but not fix', async () => {
    renderApp({
      route: '/quarantine?runId=run-12345678',
      user: userFor('admin'),
      handlers: {
        'GET /api/v1/runs': [200, { data: [], nextCursor: null }],
        'GET /api/v1/quarantine': [200, { data: [entry()], nextCursor: null }],
      },
    });
    expect(await screen.findByRole('link', { name: 'Row 128' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });
});

describe('fixing a row', () => {
  it('puts the columns behind the failing field first, saves the fix and shows the row now passes', async () => {
    const { api } = renderApp({
      route: '/quarantine/41',
      user: operator,
      handlers: fixHandlers({
        'PATCH /api/v1/quarantine/41': (req) => [
          200,
          {
            id: '41',
            rowNo: 128,
            corrected: (req.body as { values: Record<string, string> }).values,
            result: {
              status: 'valid',
              values: { name_ne: 'सीता थापा', dob_ad: '1988-03-26' },
              warnings: [],
              errors: [],
            },
          },
        ],
      }),
    });
    expect(await screen.findByText('behind a failing field')).toBeInTheDocument();
    const firstColumn = screen.getAllByRole('rowheader')[0]!;
    expect(firstColumn).toHaveTextContent('JANMA_MITI');

    const input = screen.getByLabelText('Value to use for JANMA_MITI');
    await userEvent.clear(input);
    await userEvent.type(input, '2045/12/4');
    await userEvent.click(screen.getByRole('button', { name: 'Save fix and check' }));
    expect(await screen.findByText(/The row now maps cleanly/)).toBeInTheDocument();
    expect(screen.getByText('1988-03-26')).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === 'PATCH')!.body).toEqual({
      values: { JANMA_MITI: '2045/12/4' },
    });
  });

  it('shows the new reasons when the fix still fails', async () => {
    renderApp({
      route: '/quarantine/41',
      user: operator,
      handlers: fixHandlers({
        'PATCH /api/v1/quarantine/41': [
          200,
          {
            id: '41',
            rowNo: 128,
            corrected: { JANMA_MITI: '2045/14/4' },
            result: {
              status: 'quarantined',
              values: {},
              warnings: [],
              errors: [
                {
                  field: 'dob_ad',
                  stage: 'transform',
                  message: 'bsToAd: 2045-14-04 is not a real BS date',
                },
              ],
            },
          },
        ],
      }),
    });
    const input = await screen.findByLabelText('Value to use for JANMA_MITI');
    await userEvent.clear(input);
    await userEvent.type(input, '2045/14/4');
    await userEvent.click(screen.getByRole('button', { name: 'Save fix and check' }));
    expect(await screen.findByText(/2045-14-04 is not a real BS date/)).toBeInTheDocument();
  });

  it('retries a corrected row and returns to the list when it passes', async () => {
    const { router } = renderApp({
      route: '/quarantine/41',
      user: operator,
      handlers: fixHandlers({
        'GET /api/v1/quarantine/41': [200, entry({ corrected: { JANMA_MITI: '2045/12/4' } })],
        'POST /api/v1/quarantine/retry': [
          200,
          { retried: 1, passed: 1, stillFailing: 0, reopened: true },
        ],
        'GET /api/v1/runs': [200, { data: [], nextCursor: null }],
        'GET /api/v1/quarantine': [200, { data: [], nextCursor: null }],
      }),
    });
    expect(await screen.findByLabelText('Value to use for JANMA_MITI')).toHaveValue('2045/12/4');
    await userEvent.click(screen.getByRole('button', { name: 'Retry this row' }));
    await waitFor(() => expect(router.state.location.search).toBe('?runId=run-12345678'));
  });

  it('explains a refused fix in the backend’s words', async () => {
    renderApp({
      route: '/quarantine/41',
      user: operator,
      handlers: fixHandlers({
        'PATCH /api/v1/quarantine/41': [
          409,
          problem(409, 'This row has already been fixed and retried'),
        ],
      }),
    });
    const input = await screen.findByLabelText('Value to use for JANMA_MITI');
    await userEvent.type(input, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Save fix and check' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already been fixed and retried');
  });

  it('does not offer fixing while the run is not completed', async () => {
    renderApp({
      route: '/quarantine/41',
      user: operator,
      handlers: fixHandlers({
        'GET /api/v1/runs/run-12345678': [200, { ...run, status: 'rolled_back' }],
      }),
    });
    expect(
      await screen.findByText(/once their run has completed \(this one is rolled back\)/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Value to use for JANMA_MITI')).not.toBeInTheDocument();
  });
});
