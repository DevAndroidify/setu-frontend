import { createBrowserRouter, type RouteObject } from 'react-router';
import { RequireAuth, RequireRole } from '../auth/guards';
import { LoginPage } from '../features/auth/LoginPage';
import { HomePage } from '../features/home/HomePage';
import { NotFoundPage } from '../features/home/NotFoundPage';
import { ApprovalsPage } from '../features/approvals/ApprovalsPage';
import { MappingEditorPage } from '../features/mappings/MappingEditorPage';
import { ReportPage } from '../features/reconciliation/ReportPage';
import { ReportsPage } from '../features/reconciliation/ReportsPage';
import { MappingPage } from '../features/mappings/MappingPage';
import { NewRunPage } from '../features/runs/NewRunPage';
import { RunPage } from '../features/runs/RunPage';
import { RunsPage } from '../features/runs/RunsPage';
import { NewSourcePage } from '../features/sources/NewSourcePage';
import { ProfilePage } from '../features/sources/ProfilePage';
import { SourcePage } from '../features/sources/SourcePage';
import { SourcesPage } from '../features/sources/SourcesPage';
import { StatusPage } from '../features/system/StatusPage';
import { ErrorPage } from './ErrorPage';
import { Layout } from './Layout';

const sourceRoles = ['operator', 'admin'] as const;
const forSources = (page: React.ReactNode) => (
  <RequireRole roles={[...sourceRoles]}>{page}</RequireRole>
);

const forRuns = (page: React.ReactNode) => (
  <RequireRole roles={['operator', 'approver', 'auditor', 'admin']}>{page}</RequireRole>
);

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage />, errorElement: <ErrorPage /> },
  {
    element: <RequireAuth />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            errorElement: <ErrorPage />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'status', element: <StatusPage /> },
              { path: 'sources', element: forSources(<SourcesPage />) },
              { path: 'sources/new', element: forSources(<NewSourcePage />) },
              { path: 'sources/:sourceId', element: forSources(<SourcePage />) },
              {
                path: 'sources/:sourceId/files/:fileId',
                element: forSources(<ProfilePage />),
              },
              {
                path: 'sources/:sourceId/mappings/new',
                element: forSources(<MappingEditorPage />),
              },
              {
                path: 'sources/:sourceId/mappings/:mappingId',
                element: forSources(<MappingPage />),
              },
              { path: 'runs', element: forRuns(<RunsPage />) },
              { path: 'runs/new', element: forSources(<NewRunPage />) },
              { path: 'runs/:runId', element: forRuns(<RunPage />) },
              {
                path: 'runs/:runId/reconciliation',
                element: <RequireRole roles={['auditor']}>{<ReportPage />}</RequireRole>,
              },
              {
                path: 'approvals',
                element: <RequireRole roles={['approver']}>{<ApprovalsPage />}</RequireRole>,
              },
              {
                path: 'reports',
                element: <RequireRole roles={['auditor']}>{<ReportsPage />}</RequireRole>,
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
