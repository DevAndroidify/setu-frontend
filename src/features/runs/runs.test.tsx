import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Handler } from '../../test/mock-api';
import { renderApp, userFor } from '../../test/render';
import type { RunDetail } from './api';
import { availableActions, completion } from './status';

afterEach(() => vi.unstubAllGlobals());

const run = (over: Partial<RunDetail> = {}): RunDetail => ({
  id: 'run-12345678',
  sourceFileId: 'file-1',
  mappingId: 'map-1',
  mode: 'dry_run',
  status: 'draft',
  counts: {},
  createdBy: 'user-operator',
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

/** A Server-Sent Events body that sends these statuses, then ends. */
const eventStream = (statuses: RunDetail[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const s of statuses)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(s)}\n\n`));
        controller.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );

describe('run actions', () => {
  it.each([
    ['draft', 'dry_run', 'operator', ['start', 'cancel']],
    ['draft', 'production', 'operator', ['submit', 'cancel']],
    ['draft', 'production', 'admin', ['cancel']],
    ['approved', 'production', 'operator', ['start', 'cancel']],
    ['running', 'production', 'operator', ['pause', 'cancel']],
    ['paused', 'dry_run', 'admin', ['resume', 'cancel']],
    ['running', 'production', 'approver', []],
    ['completed', 'production', 'operator', []],
  ] as const)('offers a %s %s run to an %s: %j', (status, mode, role, expected) => {
    expect(availableActions({ status, mode }, role)).toEqual(expected);
  });

  it('measures progress by finished batches, unknown before any batch exists', () => {
    expect(completion(run())).toBeNull();
    expect(
      completion(
        run({ status: 'running', progress: { ...run().progress, batches: { done: 3, load: 1 } } }),
      ),
    ).toBe(0.75);
  });
});

describe('runs list', () => {
  it('filters by status and links each run', async () => {
    const { api } = renderApp({
      route: '/runs',
      user: userFor('approver'),
      handlers: {
        'GET /api/v1/runs': (req) => [
          200,
          {
            data: req.query.get('status')
              ? []
              : [
                  run({
                    status: 'completed',
                    counts: { total: 1000, valid: 900, quarantined: 100 },
                  }),
                ],
            nextCursor: null,
          },
        ],
      },
    });
    expect(await screen.findByRole('link', { name: 'run-1234' })).toHaveAttribute(
      'href',
      '/runs/run-12345678',
    );
    expect(screen.getByText('900 valid, 100 quarantined', { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New run' })).not.toBeInTheDocument(); // approvers do not create runs
    await userEvent.click(screen.getByRole('button', { name: 'Awaiting approval' }));
    expect(await screen.findByText('No runs here.')).toBeInTheDocument();
    expect(api.calls.at(-1)!.query.get('status')).toBe('awaiting_approval,approved');
  });
});

describe('creating a run', () => {
  it('creates a run from the chosen file and mapping version and opens it', async () => {
    const handlers: Record<string, Handler> = {
      'GET /api/v1/sources': [
        200,
        {
          data: [
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
          nextCursor: null,
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
            encoding: 'utf-8',
            rowCount: 1000,
            createdAt: '2026-10-21T09:30:00Z',
            profileStatus: 'ok',
          },
        ],
      ],
      'GET /api/v1/sources/src-1/mappings': [
        200,
        [
          {
            id: 'map-2',
            sourceId: 'src-1',
            version: 2,
            spec: { fields: [] },
            createdBy: 'u',
            createdAt: '2026-10-22T09:30:00Z',
          },
        ],
      ],
      'POST /api/v1/runs': [201, run({ id: 'run-new', mode: 'production' })],
      'GET /api/v1/runs/run-new': [200, run({ id: 'run-new', mode: 'production' })],
      'GET /api/v1/runs/run-new/events': () => eventStream([]),
    };
    const { api, router } = renderApp({
      route: '/runs/new?sourceId=src-1',
      user: userFor('operator'),
      handlers,
    });
    await screen.findByRole('option', { name: 'Version 2' });
    await userEvent.click(screen.getByLabelText(/Production/));
    await userEvent.click(screen.getByRole('button', { name: 'Create run' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/runs/run-new'));
    expect(api.calls.find((c) => c.method === 'POST' && c.path === '/api/v1/runs')!.body).toEqual({
      sourceFileId: 'file-1',
      mappingId: 'map-2',
      mode: 'production',
    });
    expect(await screen.findByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
  });
});

describe('a run', () => {
  it('starts a dry run and follows its progress live until it completes', async () => {
    let state: 'draft' | 'started' | 'finished' = 'draft';
    const running = run({
      status: 'running',
      counts: { total: 1000 },
      progress: {
        valid: 400,
        quarantined: 50,
        duplicate_review: 0,
        loaded: 0,
        linked: 0,
        batches: { done: 2, validate: 3 },
      },
    });
    const completed = run({
      status: 'completed',
      counts: { total: 1000, valid: 880, quarantined: 120 },
      finishedAt: '2026-10-25T10:02:00Z',
      progress: {
        valid: 880,
        quarantined: 120,
        duplicate_review: 0,
        loaded: 0,
        linked: 0,
        batches: { done: 5 },
      },
    });
    const { api } = renderApp({
      route: '/runs/run-12345678',
      user: userFor('operator'),
      handlers: {
        // Like the backend: the run is draft, then running, and completed once the stream ended.
        'GET /api/v1/runs/run-12345678': () => [
          200,
          { draft: run(), started: running, finished: completed }[state],
        ],
        'POST /api/v1/runs/run-12345678/start': () => {
          state = 'started';
          return [202, run({ status: 'queued' })];
        },
        'GET /api/v1/runs/run-12345678/events': (req) => {
          expect(req.headers.get('authorization')).toBe('Bearer access-1');
          state = 'finished';
          return eventStream([running, completed]);
        },
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Start' }));
    expect(await screen.findByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('880')).toBeInTheDocument();
    expect(screen.getByText('100% of batches done')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(api.calls.some((c) => c.path.endsWith('/events'))).toBe(true);
  });

  it('reconnects when the live stream drops while the run is still going', async () => {
    let streams = 0;
    const paused = run({ status: 'paused', counts: { total: 1000 } });
    const completed = run({ status: 'completed', counts: { total: 1000, valid: 880 } });
    renderApp({
      route: '/runs/run-12345678',
      user: userFor('operator'),
      handlers: {
        'GET /api/v1/runs/run-12345678': () => [200, streams < 2 ? paused : completed],
        // The first stream ends with the run still paused (a proxy timeout, an API restart).
        'GET /api/v1/runs/run-12345678/events': () =>
          ++streams === 1 ? eventStream([paused]) : eventStream([completed]),
      },
    });
    expect(await screen.findByText('Paused')).toBeInTheDocument();
    expect(await screen.findByText('Completed')).toBeInTheDocument();
    expect(streams).toBe(2);
  });

  it('shows why a production run is waiting, and that its maker cannot approve it', async () => {
    renderApp({
      route: '/runs/run-12345678',
      user: userFor('operator'),
      handlers: {
        'GET /api/v1/runs/run-12345678': [
          200,
          run({ mode: 'production', status: 'awaiting_approval' }),
        ],
        'GET /api/v1/runs/run-12345678/events': () => eventStream([]),
      },
    });
    expect(
      await screen.findByText(/cannot be approved by whoever created or submitted it/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel run' })).toBeInTheDocument();
  });
});
