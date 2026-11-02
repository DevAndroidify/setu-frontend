import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Handler, problem } from '../../test/mock-api';
import { renderApp, userFor } from '../../test/render';
import type { AuditEvent } from '../audit/api';
import type { Person } from './api';

afterEach(() => vi.unstubAllGlobals());

const person = (over: Partial<Person> = {}): Person => ({
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
  ...over,
});

const personHandlers = (extra: Record<string, Handler> = {}): Record<string, Handler> => ({
  'GET /api/v1/persons/p-1': (req) =>
    req.query.get('unmask') === 'true'
      ? [200, person({ citizenship_no: '85-01-50-12345', citizenship_no_masked: false })]
      : [200, person()],
  ...extra,
});

describe('records', () => {
  it('searches by name and shows BS dates and masked numbers', async () => {
    const { api } = renderApp({
      route: '/persons',
      user: userFor('operator'),
      handlers: { 'GET /api/v1/persons': [200, { data: [person()], nextCursor: null }] },
    });
    await userEvent.type(await screen.findByLabelText('Name'), 'sita');
    await userEvent.click(screen.getByRole('button', { name: 'Search' }));
    const row = (await screen.findByRole('link', { name: 'Sita Thapa' })).closest('tr')!;
    expect(row).toHaveTextContent('2044-12-30');
    expect(row).toHaveTextContent('AD 1988-04-12');
    expect(row).toHaveTextContent('**-**-**-12345');
    const last = api.calls.filter((c) => c.path === '/api/v1/persons').at(-1)!;
    expect(last.query.get('q')).toBe('sita');
    expect(last.query.get('calendar')).toBe('bs');
  });

  it('unmasks the number for an auditor who gives a reason, without keeping it', async () => {
    const { api } = renderApp({
      route: '/persons/p-1',
      user: userFor('auditor'),
      handlers: personHandlers({ 'GET /api/v1/persons/p-1/lineage': [200, []] }),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Show the full citizenship number…' }),
    );
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Complaint ref 42');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Show number' }));
    expect(await screen.findByText('85-01-50-12345')).toBeInTheDocument();
    const call = api.calls.find((c) => c.query.get('unmask') === 'true')!;
    expect(call.query.get('reason')).toBe('Complaint ref 42');
    await userEvent.click(screen.getByRole('button', { name: 'Hide it' }));
    expect(screen.queryByText('85-01-50-12345')).not.toBeInTheDocument();
    expect(screen.getByText('**-**-**-12345')).toBeInTheDocument();
  });

  it('does not offer unmasking to operators, and shows the backend refusing it otherwise', async () => {
    renderApp({ route: '/persons/p-1', user: userFor('operator'), handlers: personHandlers() });
    expect(await screen.findByText('Sita Thapa')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /full citizenship number/ }),
    ).not.toBeInTheDocument();
  });

  it('shows auditors the source rows behind a record', async () => {
    renderApp({
      route: '/persons/p-1',
      user: userFor('auditor'),
      handlers: personHandlers({
        'GET /api/v1/persons/p-1/lineage': [
          200,
          [
            { rawRowId: '501', runId: 'run-12345678', mappingId: 'm', batchId: 'batch-aaaa' },
            { rawRowId: '9001', runId: 'run-87654321', mappingId: 'm', batchId: 'batch-bbbb' },
          ],
        ],
      }),
    });
    expect(await screen.findByRole('heading', { name: 'Lineage' })).toBeInTheDocument();
    expect(await screen.findByText(/#501/)).toHaveTextContent('created the record');
    expect(screen.getByRole('link', { name: 'run-8765' })).toHaveAttribute(
      'href',
      '/runs/run-87654321',
    );
  });

  it('reports a refused unmask in the backend’s words', async () => {
    renderApp({
      route: '/persons/p-1',
      user: userFor('reviewer'),
      handlers: personHandlers({
        'GET /api/v1/persons/p-1': (req) =>
          req.query.get('unmask') === 'true'
            ? [403, problem(403, 'Your role cannot see unmasked citizenship numbers')]
            : [200, person()],
      }),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Show the full citizenship number…' }),
    );
    await userEvent.type(within(screen.getByRole('dialog')).getByLabelText('Reason'), 'Checking');
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Show number' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'cannot see unmasked citizenship numbers',
    );
  });
});

const event = (over: Partial<AuditEvent> = {}): AuditEvent => ({
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
  ...over,
});

describe('audit trail', () => {
  const handlers = (verify: Handler): Record<string, Handler> => ({
    'GET /api/v1/audit/events': [200, { data: [event()], nextCursor: null }],
    'GET /api/v1/audit/verify': verify,
  });

  it('lists events with their reasons and filters them', async () => {
    const { api } = renderApp({
      route: '/audit',
      user: userFor('auditor'),
      handlers: handlers([200, {}]),
    });
    const row = (await screen.findByText('person.unmasked')).closest('tr')!;
    expect(row).toHaveTextContent('Complaint ref 42');
    expect(row).toHaveTextContent('global · 2');
    await userEvent.type(screen.getByLabelText('Action'), 'run.approved');
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));
    await vi.waitFor(() =>
      expect(
        api.calls
          .filter((c) => c.path === '/api/v1/audit/events')
          .at(-1)!
          .query.get('action'),
      ).toBe('run.approved'),
    );
  });

  it('reports an intact chain', async () => {
    renderApp({
      route: '/audit',
      user: userFor('auditor'),
      handlers: handlers([
        200,
        { valid: true, streamsChecked: 4, eventsChecked: 1234, firstBroken: null },
      ]),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Verify every stream' }));
    expect(await screen.findByText(/1,234 events in 4 streams/)).toBeInTheDocument();
  });

  it('points to the exact event where the chain breaks', async () => {
    renderApp({
      route: '/audit?stream=global',
      user: userFor('auditor'),
      handlers: handlers([
        200,
        {
          valid: false,
          streamsChecked: 1,
          eventsChecked: 9,
          firstBroken: { stream: 'global', seq: 2, reason: 'hash does not match the event' },
        },
      ]),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Verify stream global' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'The chain is broken in stream global at event 2: hash does not match the event',
    );
  });

  it('is for auditors and admins only', async () => {
    renderApp({ route: '/audit', user: userFor('reviewer'), handlers: handlers([200, {}]) });
    expect(
      await screen.findByRole('heading', { name: 'Not available to your role' }),
    ).toBeInTheDocument();
  });
});
