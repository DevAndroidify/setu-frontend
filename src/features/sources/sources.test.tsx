import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { problem } from '../../test/mock-api';
import { renderApp, userFor } from '../../test/render';
import type { Source, SourceFile } from './api';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  uploadFile: vi.fn(),
}));
const { uploadFile } = await import('./api');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(uploadFile).mockReset();
});

const operator = userFor('operator');
const source = (over: Partial<Source> = {}): Source => ({
  id: 'src-1',
  name: 'Household register',
  kind: 'csv',
  agency: 'Ward 3 office',
  createdBy: operator.id,
  createdAt: '2026-10-20T08:00:00.000Z',
  fileCount: 0,
  ...over,
});
const file = (over: Partial<SourceFile> = {}): SourceFile => ({
  id: 'file-1',
  sourceId: 'src-1',
  filename: 'register.csv',
  sha256: 'ab'.repeat(32),
  sizeBytes: 104_000,
  encoding: 'windows-1252',
  rowCount: 1000,
  createdAt: '2026-10-21T09:30:00.000Z',
  profileStatus: 'ok',
  ...over,
});

describe('sources list', () => {
  it('lists sources and loads more pages on request', async () => {
    renderApp({
      route: '/sources',
      user: operator,
      handlers: {
        'GET /api/v1/sources': (req) =>
          req.query.get('cursor')
            ? [200, { data: [source({ id: 'src-0', name: 'Old register' })], nextCursor: null }]
            : [200, { data: [source({ fileCount: 2 })], nextCursor: 'src-1' }],
      },
    });
    const row = (await screen.findByRole('link', { name: 'Household register' })).closest('tr')!;
    expect(within(row).getByText('CSV file')).toBeInTheDocument();
    expect(within(row).getByText('2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByRole('link', { name: 'Old register' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('invites registering the first source when there are none', async () => {
    renderApp({
      route: '/sources',
      user: operator,
      handlers: { 'GET /api/v1/sources': [200, { data: [], nextCursor: null }] },
    });
    expect(await screen.findByText(/No sources yet/)).toBeInTheDocument();
  });
});

describe('registering a source', () => {
  it('registers a source and opens it', async () => {
    const { api, router } = renderApp({
      route: '/sources/new',
      user: operator,
      handlers: {
        'POST /api/v1/sources': (req) => [201, source({ ...(req.body as object), id: 'src-9' })],
        'GET /api/v1/sources/src-9': [200, source({ id: 'src-9', kind: 'xml' })],
        'GET /api/v1/sources/src-9/files': [200, []],
        'GET /api/v1/sources/src-9/mappings': [200, []],
      },
    });
    await userEvent.type(await screen.findByLabelText('Name'), 'Birth register');
    await userEvent.type(screen.getByLabelText('Agency'), 'Ward 3 office');
    await userEvent.selectOptions(screen.getByLabelText('Kind of file'), 'xml');
    expect(screen.getByText(/One record per child of the root/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Register source' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/sources/src-9'));
    expect(
      api.calls.find((c) => c.method === 'POST' && c.path === '/api/v1/sources')?.body,
    ).toEqual({
      name: 'Birth register',
      agency: 'Ward 3 office',
      kind: 'xml',
    });
    expect(await screen.findByText(/registered\. Upload its first file/)).toBeInTheDocument();
  });

  it('shows the backend’s field errors next to the fields', async () => {
    renderApp({
      route: '/sources/new',
      user: operator,
      handlers: {
        'POST /api/v1/sources': [
          400,
          problem(400, 'Validation failed', [
            { path: 'agency', message: 'Too big: at most 200 characters' },
          ]),
        ],
      },
    });
    await userEvent.type(await screen.findByLabelText('Name'), 'Register');
    await userEvent.type(screen.getByLabelText('Agency'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Register source' }));
    expect(await screen.findByText('Too big: at most 200 characters')).toBeInTheDocument();
    expect(screen.getByLabelText('Agency')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('a source and its files', () => {
  const handlers = (files: SourceFile[]) => ({
    'GET /api/v1/sources/src-1': [200, source({ fileCount: files.length })] as [number, unknown],
    'GET /api/v1/sources/src-1/files': [200, files] as [number, unknown],
    'GET /api/v1/sources/src-1/mappings': [200, []] as [number, unknown],
  });

  it('lists the files with their profile status, linking only finished profiles', async () => {
    renderApp({
      route: '/sources/src-1',
      user: operator,
      handlers: handlers([
        file(),
        file({ id: 'file-2', filename: 'broken.csv', profileStatus: 'failed' }),
        file({ id: 'file-3', filename: 'new.csv', profileStatus: 'pending', rowCount: null }),
      ]),
    });
    expect(await screen.findByRole('link', { name: 'register.csv' })).toHaveAttribute(
      'href',
      '/sources/src-1/files/file-1',
    );
    expect(screen.getByText('Profiled')).toBeInTheDocument();
    expect(screen.getByText('Unreadable')).toBeInTheDocument();
    expect(screen.getByText('Profiling…')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'new.csv' })).not.toBeInTheDocument();
    expect(screen.getAllByText('1,000')).toHaveLength(2); // the pending file has no count yet
  });

  it('uploads a chosen file and shows it', async () => {
    vi.mocked(uploadFile).mockImplementation(async (_s, f, onProgress) => {
      onProgress(1);
      return file({ id: 'file-4', filename: f.name, profileStatus: undefined });
    });
    renderApp({ route: '/sources/src-1', user: operator, handlers: handlers([]) });
    const picker = await screen.findByLabelText(/choose one/);
    await userEvent.upload(
      picker,
      new File(['NAAM\r\n;Ltf\r\n'], 'ward3.csv', { type: 'text/csv' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByText('ward3.csv uploaded. Profiling it now.')).toBeInTheDocument();
    expect(vi.mocked(uploadFile).mock.calls[0]?.[0]).toBe('src-1');
  });

  it('explains a duplicate upload in plain words', async () => {
    const { ApiError } = await import('../../api/client');
    vi.mocked(uploadFile).mockRejectedValue(
      new ApiError(409, 'Conflict', 'This file was already uploaded (file file-1)', [], 'req-9'),
    );
    renderApp({ route: '/sources/src-1', user: operator, handlers: handlers([file()]) });
    await userEvent.upload(
      await screen.findByLabelText(/choose one/),
      new File(['x'], 'again.csv'),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This file was already uploaded (file file-1). The same bytes can only be imported once.',
    );
  });

  it('refuses a file over 50 MB before sending it', async () => {
    renderApp({ route: '/sources/src-1', user: operator, handlers: handlers([]) });
    const big = new File(['x'], 'huge.csv');
    Object.defineProperty(big, 'size', { value: 51 * 1024 * 1024 });
    await userEvent.upload(await screen.findByLabelText(/choose one/), big);
    expect(screen.getByRole('alert')).toHaveTextContent('larger than the 50 MB limit');
    expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
  });
});
