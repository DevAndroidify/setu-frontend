import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Handler } from '../../test/mock-api';
import { renderApp, userFor } from '../../test/render';
import type { Report } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const report = (over: Partial<Report> = {}): Report => ({
  runId: 'run-1',
  mode: 'production',
  ok: true,
  counts: {
    profiled: 1000,
    extracted: 1000,
    loaded: 780,
    linked: 20,
    quarantined: 198,
    pendingReview: 2,
    valid: 0,
    balanced: true,
    problems: [],
  },
  checksums: ['name_ne', 'name_en', 'gender', 'dob_ad', 'citizenship_no', 'father_name_ne'].map(
    (field) => ({
      field,
      source: 'a'.repeat(64),
      target: 'a'.repeat(64),
      match: true,
    }),
  ),
  sample: { size: 20, rowNos: [], mismatches: [] },
  ...over,
});

const handlers = (r: Report, extra: Record<string, Handler> = {}): Record<string, Handler> => ({
  'GET /api/v1/runs/run-1': [
    200,
    {
      id: 'run-1',
      mode: r.mode,
      status: 'completed',
      file: { id: 'f', filename: 'register.csv', rowCount: 1000 },
      source: { id: 's', name: 'Household register', kind: 'csv' },
      mappingVersion: 3,
      counts: {},
      progress: {
        valid: 0,
        quarantined: 0,
        duplicate_review: 0,
        loaded: 0,
        linked: 0,
        batches: {},
      },
    },
  ],
  'GET /api/v1/runs/run-1/reconciliation': (req) =>
    req.query.get('format') === 'csv'
      ? new Response('section,item,source,target,result\r\n', {
          status: 200,
          headers: { 'content-type': 'text/csv' },
        })
      : [200, r],
  ...extra,
});

const auditor = userFor('auditor');

describe('reconciliation report', () => {
  it('proves the run: rows that balance, six matching checksums and a clean sample', async () => {
    renderApp({ route: '/runs/run-1/reconciliation', user: auditor, handlers: handlers(report()) });
    expect(
      await screen.findByText(/Every row is accounted for, every loaded column matches/),
    ).toBeInTheDocument();
    const balance = screen.getByLabelText('Row balance');
    expect(balance).toHaveTextContent('780Loaded');
    expect(balance).toHaveTextContent('1,000accounted for');
    expect(balance).toHaveTextContent('extracted (profile counted 1,000)');
    expect(screen.getAllByText('match')).toHaveLength(6);
    expect(screen.getByText('no differences.')).toBeInTheDocument();
    expect(screen.getByText(/mapping version 3/)).toBeInTheDocument();
  });

  it('lists the problems of a report that does not reconcile, and the differing fields', async () => {
    const bad = report({
      ok: false,
      counts: {
        ...report().counts,
        balanced: false,
        problems: ['column dob_ad differs between staging and target'],
      },
      checksums: [
        { field: 'dob_ad', source: 'a'.repeat(64), target: 'b'.repeat(64), match: false },
      ],
      sample: {
        size: 20,
        rowNos: [7],
        mismatches: [{ rowNo: 7, field: 'dob_ad', source: '1988-04-12', target: '1988-04-13' }],
      },
    });
    renderApp({ route: '/runs/run-1/reconciliation', user: auditor, handlers: handlers(bad) });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'column dob_ad differs between staging and target',
    );
    expect(screen.getByText('differs')).toBeInTheDocument();
    const row = screen.getByText('1988-04-13').closest('tr')!;
    expect(within(row).getByText('Date of birth (stored in AD)')).toBeInTheDocument();
    expect(screen.getByLabelText('Row balance')).toHaveTextContent('≠');
  });

  it('downloads the CSV with the auditor’s token', async () => {
    const createObjectURL = vi.fn(() => 'blob:report');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { api } = renderApp({
      route: '/runs/run-1/reconciliation',
      user: auditor,
      handlers: handlers(report()),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Download CSV' }));
    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    const call = api.calls.find((c) => c.query.get('format') === 'csv')!;
    expect(call.headers.get('authorization')).toBe('Bearer access-1');
    expect(createObjectURL).toHaveBeenCalled();
  });

  it('explains that a dry run has nothing loaded to compare', async () => {
    renderApp({
      route: '/runs/run-1/reconciliation',
      user: auditor,
      handlers: handlers(
        report({
          mode: 'dry_run',
          checksums: null,
          sample: null,
          counts: {
            ...report().counts,
            loaded: 0,
            linked: 0,
            valid: 800,
            quarantined: 198,
            pendingReview: 2,
          },
        }),
      ),
    });
    expect(await screen.findByText(/A dry run loads nothing/)).toBeInTheDocument();
    expect(screen.getByLabelText('Row balance')).toHaveTextContent('800Valid');
  });

  it('is only for auditors', async () => {
    renderApp({
      route: '/runs/run-1/reconciliation',
      user: userFor('operator'),
      handlers: handlers(report()),
    });
    expect(
      await screen.findByRole('heading', { name: 'Not available to your role' }),
    ).toBeInTheDocument();
  });
});
