import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, userFor } from '../../test/render';

afterEach(() => vi.unstubAllGlobals());

describe('the sign-in page', () => {
  it('explains where every row ends up before asking you to sign in', async () => {
    renderApp({ route: '/login' });
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Old registers in. Clean records out. Nothing dropped quietly.',
      }),
    ).toBeInTheDocument();
    const places = screen.getByRole('list', { name: 'Every row ends up in one of three places' });
    expect(
      within(places)
        .getAllByRole('listitem')
        .map((li) => li.firstChild?.textContent),
    ).toEqual(['Loaded', 'Held', 'Sent for review']);
    const stages = screen.getByRole('list', { name: 'How a run works' });
    expect(within(stages).getAllByRole('listitem')).toHaveLength(6);
  });

  it('states the lockout rule next to the form', async () => {
    renderApp({ route: '/login' });
    const form = await screen.findByRole('form', { name: 'Sign in' });
    expect(
      within(form).getByText('Five wrong passwords lock the account for 15 minutes.'),
    ).toBeInTheDocument();
  });

  it('signs a visitor in as a role with one click on a public demo', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true');
    const { api, router } = renderApp({
      route: '/login',
      handlers: {
        'POST /api/v1/auth/demo': [
          200,
          { accessToken: 'demo-1', tokenType: 'Bearer', expiresIn: 900 },
        ],
        'GET /api/v1/me': [200, userFor('reviewer')],
      },
    });
    const demo = await screen.findByRole('region', { name: 'Look around as any role' });
    // The ordinary form stays for real accounts.
    expect(screen.getByRole('form', { name: 'Sign in' })).toBeInTheDocument();
    await userEvent.click(within(demo).getByRole('button', { name: 'Sign in as Reviewer' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(api.calls.find((c) => c.path === '/api/v1/auth/demo')!.body).toEqual({
      role: 'reviewer',
    });
    vi.unstubAllEnvs();
  });

  it('offers no password-free sign-in in a production build that is not a public demo', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_DEMO_MODE', '');
    renderApp({ route: '/login' });
    await screen.findByRole('form', { name: 'Sign in' });
    expect(screen.queryByRole('button', { name: /Sign in as/ })).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });

  it('offers one-click sign-in for every role while developing', async () => {
    renderApp({ route: '/login' });
    const demo = await screen.findByRole('region', { name: 'Look around as any role' });
    for (const role of ['Operator', 'Reviewer', 'Approver', 'Auditor', 'Administrator']) {
      expect(within(demo).getByRole('button', { name: `Sign in as ${role}` })).toBeEnabled();
    }
  });

  it('says how to turn demo sign-in on when the backend has it off', async () => {
    renderApp({
      route: '/login',
      handlers: {
        'POST /api/v1/auth/demo': [
          404,
          { type: 'about:blank', title: 'Not Found', status: 404, detail: 'Cannot POST' },
        ],
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in as Operator' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('DEMO_MODE=true');
  });
});
