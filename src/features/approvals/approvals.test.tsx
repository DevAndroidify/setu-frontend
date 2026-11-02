import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Handler, problem } from '../../test/mock-api';
import { renderApp, userFor } from '../../test/render';
import type { RunDetail } from '../runs/api';
import { type Approval, cannotDecide, fromNow } from './api';

afterEach(() => vi.unstubAllGlobals());

const approver = userFor('approver');
const now = Date.now();
const iso = (ms: number) => new Date(now + ms).toISOString();

const run = (over: Partial<RunDetail> = {}): RunDetail => ({
  id: 'run-prod-0001',
  sourceFileId: 'file-1',
  mappingId: 'map-1',
  mode: 'production',
  status: 'awaiting_approval',
  counts: {},
  createdBy: 'user-operator',
  approvedBy: null,
  createdAt: iso(-3_600_000),
  startedAt: null,
  finishedAt: null,
  file: { id: 'file-1', filename: 'register.csv', rowCount: 1000 },
  source: { id: 'src-1', name: 'Household register', kind: 'csv' },
  mappingVersion: 2,
  progress: { valid: 0, quarantined: 0, duplicate_review: 0, loaded: 0, linked: 0, batches: {} },
  ...over,
});
const dryRun = run({
  id: 'run-dry-0001',
  mode: 'dry_run',
  status: 'completed',
  counts: { total: 1000, valid: 880, quarantined: 120 },
});
const request: Approval = {
  id: 'ap-1',
  runId: 'run-prod-0001',
  requestedBy: 'user-operator',
  decidedBy: null,
  decision: null,
  reason: null,
  createdAt: iso(-1_800_000),
  expiresAt: iso(22 * 3_600_000),
  decidedAt: null,
};

const queue = (extra: Record<string, Handler> = {}): Record<string, Handler> => ({
  'GET /api/v1/runs': (req) =>
    req.query.get('sourceId')
      ? [200, { data: [dryRun], nextCursor: null }]
      : [200, { data: [run()], nextCursor: null }],
  'GET /api/v1/runs/run-prod-0001/approvals': [200, [request]],
  ...extra,
});

describe('approval rules', () => {
  it('never lets the maker be the checker', () => {
    expect(cannotDecide({ createdBy: 'u1' }, request, 'u1')).toMatch(/You created this run/);
    expect(cannotDecide({ createdBy: 'u0' }, { ...request, requestedBy: 'u1' }, 'u1')).toMatch(
      /You submitted/,
    );
    expect(cannotDecide({ createdBy: 'u0' }, request, 'u2')).toBeNull();
  });

  it('says when something expires in words', () => {
    expect(fromNow(iso(22 * 3_600_000), now)).toBe('in 22 hours');
    expect(fromNow(iso(-30 * 60_000), now)).toBe('30 minutes ago');
  });
});

describe('approvals queue', () => {
  it('shows each waiting run with its dry-run result and when the request expires', async () => {
    renderApp({ route: '/approvals', user: approver, handlers: queue() });
    const card = await screen.findByRole('article', { name: 'Household register' });
    expect(await within(card).findByText('880 valid')).toBeInTheDocument();
    expect(within(card).getByText(/120 quarantined \(12%\)/)).toBeInTheDocument();
    expect(within(card).getByText(/the request expires in 22 hours/)).toBeInTheDocument();
  });

  it('warns when the file was never dry-run with this mapping version', async () => {
    renderApp({
      route: '/approvals',
      user: approver,
      handlers: queue({
        'GET /api/v1/runs': (req) =>
          req.query.get('sourceId')
            ? [200, { data: [], nextCursor: null }]
            : [200, { data: [run()], nextCursor: null }],
      }),
    });
    expect(
      await screen.findByText(/has not been dry-run with this mapping version/),
    ).toBeInTheDocument();
  });

  it('approves only with a reason, and records it', async () => {
    const { api } = renderApp({
      route: '/approvals',
      user: approver,
      handlers: queue({
        'POST /api/v1/runs/run-prod-0001/approve': [200, run({ status: 'approved' })],
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Approve…' }));
    const dialog = screen.getByRole('dialog', { name: 'Approve this production run' });
    const confirm = within(dialog).getByRole('button', { name: 'Approve' });
    expect(confirm).toBeDisabled();
    await userEvent.type(
      within(dialog).getByLabelText('Reason'),
      'Dry run checked: 12% quarantined is expected',
    );
    await userEvent.click(confirm);
    expect(
      await screen.findByText(/Approved\. The operator can start it within 24 hours/),
    ).toBeInTheDocument();
    expect(api.calls.find((c) => c.path.endsWith('/approve'))!.body).toEqual({
      decision: 'approved',
      reason: 'Dry run checked: 12% quarantined is expected',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rejects with a reason and shows the backend refusing an expired request', async () => {
    renderApp({
      route: '/approvals',
      user: approver,
      handlers: queue({
        'POST /api/v1/runs/run-prod-0001/approve': [
          409,
          problem(409, 'The approval request expired after 24 hours: submit the run again'),
        ],
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Reject…' }));
    const dialog = screen.getByRole('dialog', { name: 'Send this run back' });
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Too many quarantined rows');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await within(dialog).findByText(/expired after 24 hours/)).toBeInTheDocument();
  });

  it('closes the dialog with Escape and puts focus back on the button', async () => {
    renderApp({ route: '/approvals', user: approver, handlers: queue() });
    const open = await screen.findByRole('button', { name: 'Approve…' });
    await userEvent.click(open);
    expect(within(screen.getByRole('dialog')).getByLabelText('Reason')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(open).toHaveFocus();
  });

  it('tells an approver who submitted the run that someone else must decide', async () => {
    renderApp({
      route: '/approvals',
      user: approver,
      handlers: queue({
        'GET /api/v1/runs/run-prod-0001/approvals': [
          200,
          [{ ...request, requestedBy: approver.id }],
        ],
      }),
    });
    expect(
      await screen.findByText('You submitted this run, so someone else must approve it.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve…' })).not.toBeInTheDocument();
  });
});

describe('rollback', () => {
  const completed = run({
    status: 'completed',
    counts: { total: 1000, loaded: 780, linked: 20, quarantined: 200 },
    progress: {
      valid: 0,
      quarantined: 200,
      duplicate_review: 0,
      loaded: 780,
      linked: 20,
      batches: { done: 5 },
    },
  });
  const handlers = (rollback: Handler): Record<string, Handler> => ({
    'GET /api/v1/runs/run-prod-0001': [200, completed],
    'GET /api/v1/runs/run-prod-0001/approvals': [
      200,
      [{ ...request, decision: 'approved', reason: 'ok', decidedAt: iso(-60_000) }],
    ],
    'POST /api/v1/runs/run-prod-0001/rollback': rollback,
  });

  it('says exactly what will be removed before rolling back', async () => {
    const { api } = renderApp({
      route: '/runs/run-prod-0001',
      user: approver,
      handlers: handlers([200, { ...completed, status: 'rolled_back' }]),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Roll back…' }));
    const dialog = screen.getByRole('dialog', { name: 'Roll back this run?' });
    expect(dialog).toHaveTextContent('780 records this run created');
    expect(dialog).toHaveTextContent('20 links from its rows to records that already existed');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Roll back' }));
    expect(await screen.findByText(/Rolled back\. The register is as it was/)).toBeInTheDocument();
    expect(api.calls.some((c) => c.method === 'POST' && c.path.endsWith('/rollback'))).toBe(true);
  });

  it('explains a refused rollback', async () => {
    renderApp({
      route: '/runs/run-prod-0001',
      user: approver,
      handlers: handlers([
        409,
        problem(409, 'Later runs have linked to records from this run; roll those back first'),
      ]),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Roll back…' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Roll back' }),
    );
    expect(await screen.findByText(/roll those back first/)).toBeInTheDocument();
  });

  it('is offered only to approvers', async () => {
    renderApp({
      route: '/runs/run-prod-0001',
      user: userFor('operator'),
      handlers: handlers([200, completed]),
    });
    expect(await screen.findByText('Production of register.csv')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Approval history')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Roll back…' })).not.toBeInTheDocument();
  });
});
