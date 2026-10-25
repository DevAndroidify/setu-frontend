import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { problem } from '../../test/mock-api';
import { renderApp, userFor } from '../../test/render';
import type { ColumnProfile, Profile } from './api';

afterEach(() => vi.unstubAllGlobals());

const column = (name: string, over: Partial<ColumnProfile> = {}): ColumnProfile => ({
  name,
  filled: 1000,
  empty: 0,
  emptyPct: 0,
  distinct: 900,
  distinctCapped: false,
  topValues: [{ value: 'x', count: 3 }],
  length: { min: 1, max: 12 },
  patterns: [{ pattern: 'a', count: 1000 }],
  preeti: { share: 0, likely: false },
  dateFormats: [],
  numeric: null,
  ...over,
});

const report: Profile = {
  status: 'ok',
  encoding: 'windows-1252',
  rowCount: 1000,
  raggedRows: 0,
  columns: [
    column('SN', { numeric: { min: 1, max: 1000, mean: 500.5 } }),
    column('NAAM', {
      preeti: { share: 0.98, likely: true },
      topValues: [{ value: ';Ltf yfkf', count: 4 }],
    }),
    column('JANMA_MITI', {
      dateFormats: [
        { format: 'YYYY/M/D', count: 600 },
        { format: 'D/M/YYYY', count: 370 },
      ],
      emptyPct: 3,
    }),
  ],
};

const handlers = (profile: [number, unknown]) => ({
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
        rowCount: 1000,
        createdAt: '2026-10-21T09:30:00.000Z',
        profileStatus: 'ok',
      },
    ],
  ] as [number, unknown],
  'GET /api/v1/files/file-1/profile': profile,
});

describe('file profile', () => {
  it('highlights the columns a mapping must deal with', async () => {
    renderApp({
      route: '/sources/src-1/files/file-1',
      user: userFor('operator'),
      handlers: handlers([200, report]),
    });
    expect(
      await screen.findByRole('heading', { name: 'Profile of register.csv' }),
    ).toBeInTheDocument();
    const naam = screen.getByRole('rowheader', { name: /NAAM/ });
    expect(naam).toHaveTextContent('Preeti font text: convert to Unicode');
    expect(screen.getByRole('rowheader', { name: /JANMA_MITI/ })).toHaveTextContent(
      '2 date formats mixed',
    );
    expect(within(naam.closest('tr')!).getByText(';Ltf yfkf')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Show only columns needing attention'));
    expect(screen.queryByRole('rowheader', { name: /^SN/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
  });

  it('says why a file could not be read', async () => {
    renderApp({
      route: '/sources/src-1/files/file-1',
      user: userFor('operator'),
      handlers: handlers([
        200,
        {
          status: 'failed',
          encoding: 'utf-8',
          error: 'The dump holds rows of more than one table (a, b)',
        },
      ]),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('more than one table (a, b)');
  });

  it('waits while the file is still being profiled', async () => {
    renderApp({
      route: '/sources/src-1/files/file-1',
      user: userFor('operator'),
      handlers: handlers([404, problem(404, 'The profile is not ready yet; try again shortly')]),
    });
    expect(await screen.findByText(/The file is being profiled/)).toBeInTheDocument();
  });
});
