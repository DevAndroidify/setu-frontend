import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Handler } from '../../test/mock-api';
import { renderApp, userFor } from '../../test/render';
import type { MatchCandidate, MatchRow } from './api';

afterEach(() => vi.unstubAllGlobals());

const side = (over: Partial<MatchRow> = {}): MatchRow => ({
  stagedRowId: '10',
  runId: 'run-later',
  rowNo: 12,
  status: 'duplicate_review',
  name_ne: 'राम थापा',
  name_en: 'Ram Thapa',
  gender: 'male',
  dob_ad: '1988-04-12',
  father_name_ne: 'हरि थापा',
  local_unit_code: 'kaski-pokhara',
  ward_no: '3',
  hasCitizenshipNo: true,
  ...over,
});

const candidate: MatchCandidate = {
  id: '7',
  score: 0.9,
  features: { name: 1, dob: 0.5, father: 1, citizenship: 'same' },
  row: side({ dob_ad: null }),
  match: side({ stagedRowId: '3', runId: 'run-first', rowNo: 4, status: 'loaded', ward_no: '9' }),
};

const handlers = (extra: Record<string, Handler> = {}): Record<string, Handler> => ({
  'GET /api/v1/matches': [200, { data: [candidate], nextCursor: null }],
  ...extra,
});

const fieldRow = (name: RegExp | string) => screen.getByRole('rowheader', { name }).closest('tr')!;

describe('duplicate review', () => {
  it('shows the two records side by side and says how each field compares', async () => {
    renderApp({ route: '/matches', user: userFor('reviewer'), handlers: handlers() });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Is this the same person?' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pair 1 of 1')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('Held from this runRow 12');
    expect(table).toHaveTextContent('Already in the registerRow 4');

    expect(fieldRow('Name (English)')).toHaveAttribute('data-match', 'same');
    expect(fieldRow('Ward')).toHaveAttribute('data-match', 'different');
    expect(within(fieldRow('Ward')).getByText('Different')).toBeInTheDocument();
    const dob = fieldRow(/Date of birth/);
    expect(dob).toHaveAttribute('data-match', 'unknown');
    expect(dob).toHaveTextContent('—');
    // Citizenship: whether both have one and whether they agree, never the number.
    expect(fieldRow('Citizenship no.')).toHaveTextContent('Has oneHas oneSame');
    expect(document.body).not.toHaveTextContent(/\d{2}-\d{2}-\d{2}-\d{5}/);

    const closeness = screen.getByRole('region', { name: 'How close they are' });
    expect(closeness).toHaveTextContent('0.90');
    expect(closeness).toHaveTextContent('Date of birth0.50');
  });

  it('asks for a reason before either decision', async () => {
    renderApp({ route: '/matches', user: userFor('reviewer'), handlers: handlers() });
    const link = await screen.findByRole('button', { name: 'Same person. Link them' });
    const notSame = screen.getByRole('button', { name: 'Different people. Load as new' });
    expect(link).toBeDisabled();
    expect(notSame).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Reason, in a sentence (required)'), 'ok');
    expect(link).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Reason, in a sentence (required)'), ' then');
    expect(link).toBeEnabled();
    expect(notSame).toBeEnabled();
  });

  it('links the held row to the existing record with a reason', async () => {
    const { api } = renderApp({
      route: '/matches',
      user: userFor('reviewer'),
      handlers: handlers({
        'POST /api/v1/matches/7/decision': [
          200,
          { id: '7', decision: 'link', rowStatus: 'linked' },
        ],
      }),
    });
    await userEvent.type(
      await screen.findByLabelText('Reason, in a sentence (required)'),
      'Same number, same name and father',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Same person. Link them' }));
    expect(await screen.findByText('Linked to the existing record.')).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === '/api/v1/matches/7/decision')!.body).toEqual({
      decision: 'link',
      reason: 'Same number, same name and father',
    });
  });

  it('loads the held row as a new person when they are different people', async () => {
    const { api } = renderApp({
      route: '/matches',
      user: userFor('reviewer'),
      handlers: handlers({
        'POST /api/v1/matches/7/decision': [
          200,
          { id: '7', decision: 'not_same', rowStatus: 'loaded' },
        ],
      }),
    });
    await userEvent.type(
      await screen.findByLabelText('Reason, in a sentence (required)'),
      'Namesakes: different fathers',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Different people. Load as new' }));
    expect(await screen.findByText('Loaded as a new person.')).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === '/api/v1/matches/7/decision')!.body).toEqual({
      decision: 'not_same',
      reason: 'Namesakes: different fathers',
    });
  });

  it('moves to the next pair and back', async () => {
    const second: MatchCandidate = {
      ...candidate,
      id: '8',
      row: side({ rowNo: 30, name_en: 'Sita Rai' }),
    };
    renderApp({
      route: '/matches',
      user: userFor('reviewer'),
      handlers: { 'GET /api/v1/matches': [200, { data: [candidate, second], nextCursor: null }] },
    });
    expect(await screen.findByText('Pair 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Previous pair/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Skip for now/ }));
    expect(screen.getByText('Pair 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('Row 30');
    await userEvent.click(screen.getByRole('button', { name: /Previous pair/ }));
    expect(screen.getByText('Pair 1 of 2')).toBeInTheDocument();
  });

  it('says so when nothing is waiting', async () => {
    renderApp({
      route: '/matches',
      user: userFor('reviewer'),
      handlers: { 'GET /api/v1/matches': [200, { data: [], nextCursor: null }] },
    });
    expect(await screen.findByText('Nothing is waiting for review.')).toBeInTheDocument();
  });

  it('is only for reviewers', async () => {
    renderApp({ route: '/matches', user: userFor('operator'), handlers: handlers() });
    expect(
      await screen.findByRole('heading', { name: 'Not available to your role' }),
    ).toBeInTheDocument();
  });
});
