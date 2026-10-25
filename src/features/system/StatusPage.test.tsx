import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/render';
import { StatusPage } from './StatusPage';

const answer = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe('StatusPage', () => {
  it('shows every service as up when the backend is ready', async () => {
    vi.stubGlobal(
      'fetch',
      answer(200, {
        status: 'ok',
        checks: { postgres: { status: 'up' }, redis: { status: 'up' }, minio: { status: 'up' } },
      }),
    );
    renderWithProviders(<StatusPage />);
    expect(await screen.findByText('All services are up.')).toBeInTheDocument();
    expect(screen.getAllByText('Up')).toHaveLength(3);
    expect(screen.getByText('Database (PostgreSQL)')).toBeInTheDocument();
  });

  it('names the service that is down, with its error', async () => {
    vi.stubGlobal(
      'fetch',
      answer(503, {
        status: 503,
        checks: {
          postgres: { status: 'up' },
          redis: { status: 'down', error: 'timed out' },
          minio: { status: 'up' },
        },
      }),
    );
    renderWithProviders(<StatusPage />);
    expect(await screen.findByText('Some services are down.')).toBeInTheDocument();
    expect(screen.getByText('Down')).toBeInTheDocument();
    expect(screen.getByText(/timed out/)).toBeInTheDocument();
  });

  it('says so when the API cannot be reached at all', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderWithProviders(<StatusPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The API cannot be reached');
  });
});
