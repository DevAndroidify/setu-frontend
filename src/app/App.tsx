import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { RouterProvider } from 'react-router';
import { ApiError } from '../api/client';
import { AuthProvider } from '../auth/AuthProvider';
import { ToastProvider } from '../ui/Toasts';
import { createRouter } from './router';

/** Client errors (4xx) will not change on a retry; network and server errors might. */
const retry = (failures: number, error: unknown) =>
  failures < 2 && !(error instanceof ApiError && error.status < 500);

export function App() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry } } }),
  );
  const [router] = useState(createRouter);
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
