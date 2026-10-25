import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../app/router';
import { AuthProvider } from '../auth/AuthProvider';
import { type Me, resetSession, type Role } from '../auth/session';
import { ToastProvider } from '../ui/Toasts';
import { type Handler, mockApi, problem } from './mock-api';

const testClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** Renders a component with a fresh query cache and an in-memory router (no sign-in). */
export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  return render(
    <QueryClientProvider client={testClient()}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

export const userFor = (role: Role): Me => ({
  id: `user-${role}`,
  email: `${role}@setu.local`,
  role,
});

/**
 * Renders the whole app (real routes, guards and providers) at `route`, against a fake
 * backend. With `user`, the refresh cookie is "valid" and /me answers that user.
 */
export function renderApp({
  route = '/',
  user,
  handlers = {},
}: {
  route?: string;
  user?: Me;
  handlers?: Record<string, Handler>;
} = {}) {
  resetSession();
  const api = mockApi({
    'POST /api/v1/auth/refresh': user
      ? [200, { accessToken: 'access-1', tokenType: 'Bearer', expiresIn: 900 }]
      : [401, problem(401, 'Missing refresh token')],
    'GET /api/v1/me': user ? [200, user] : [401, problem(401, 'Missing access token')],
    'POST /api/v1/auth/logout': [204],
    ...handlers,
  });
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const view = render(
    <QueryClientProvider client={testClient()}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { ...view, router, api };
}
