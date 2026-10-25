import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Handler, problem } from '../../test/mock-api';
import { renderApp, userFor } from '../../test/render';

afterEach(() => vi.unstubAllGlobals());

const emptySources: Record<string, Handler> = {
  'GET /api/v1/sources': [200, { data: [], nextCursor: null }],
};

describe('signing in', () => {
  it('sends a signed-out visitor to sign in, then back to the page they asked for', async () => {
    const operator = userFor('operator');
    let signedIn = false;
    const { router } = renderApp({
      route: '/sources',
      handlers: {
        'POST /api/v1/auth/login': () => {
          signedIn = true;
          return [200, { accessToken: 'access-1', tokenType: 'Bearer', expiresIn: 900 }];
        },
        'GET /api/v1/me': () =>
          signedIn ? [200, operator] : [401, problem(401, 'Missing access token')],
        ...emptySources,
      },
    });

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?next=%2Fsources');
    await userEvent.type(screen.getByLabelText('Email'), 'operator@setu.local');
    await userEvent.type(screen.getByLabelText('Password'), 'correct-horse');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Sources' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/sources');
  });

  it('explains a refused sign-in without saying whether the account exists', async () => {
    renderApp({
      route: '/login',
      handlers: { 'POST /api/v1/auth/login': [401, problem(401, 'Invalid email or password')] },
    });
    await userEvent.type(await screen.findByLabelText('Email'), 'someone@setu.local');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/email or password is not right/);
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('asks to wait when sign-in is rate limited', async () => {
    renderApp({
      route: '/login',
      handlers: { 'POST /api/v1/auth/login': [429, problem(429, 'Too many sign-in requests')] },
    });
    await userEvent.type(await screen.findByLabelText('Email'), 'a@setu.local');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Wait a minute/);
  });

  it('keeps the session across a reload by refreshing from the cookie', async () => {
    renderApp({ route: '/', user: userFor('auditor') });
    expect(
      await screen.findByText('auditor@setu.local', { selector: 'strong' }),
    ).toBeInTheDocument();
  });

  it('does not follow a "next" link to another site', async () => {
    const { router } = renderApp({
      route: '/login?next=//evil.example',
      user: userFor('operator'),
    });
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

describe('menus by role', () => {
  it.each([
    ['operator', ['Home', 'Sources', 'Runs', 'System status'], ['Quarantine', 'Records']],
    ['reviewer', ['Home', 'System status'], ['Duplicate review', 'Records']],
    ['approver', ['Home', 'Runs', 'System status'], ['Approvals']],
    ['auditor', ['Home', 'System status'], ['Reports', 'Audit trail']],
  ] as const)('shows the %s their own menu', async (role, links, coming) => {
    renderApp({ route: '/', user: userFor(role) });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const names = within(nav)
      .getAllByRole('link')
      .map((l) => l.textContent);
    expect(names).toEqual(links);
    const later = within(nav).getByRole('list', { name: 'Coming in later phases' });
    for (const label of coming) expect(later).toHaveTextContent(label);
  });

  it('explains that a page is not for your role instead of showing it', async () => {
    renderApp({ route: '/sources', user: userFor('reviewer') });
    expect(
      await screen.findByRole('heading', { name: 'Not available to your role' }),
    ).toBeInTheDocument();
  });
});

describe('signing out', () => {
  it('ends the session on the server and returns to the sign-in page', async () => {
    const { api, router } = renderApp({ route: '/', user: userFor('operator') });
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(api.calls.some((c) => c.method === 'POST' && c.path === '/api/v1/auth/logout')).toBe(
      true,
    );
    expect(await screen.findByText('You are signed out.')).toBeInTheDocument();
  });
});
