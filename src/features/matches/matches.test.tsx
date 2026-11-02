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
  match: side({ stagedRowId: '3', runId: 'run-first', rowNo: 4, status: 'loaded' }),
};

const handlers = (extra: Record<string, Handler> = {}): Record<string, Handler> => ({
  'GET /api/v1/matches': [200, { data: [candidate], nextCursor: null }],
  ...extra,
});

describe('duplicate review', () => {
  it('shows the two records side by side and highlights what differs', async () => {
    renderApp({ route: '/matches', user: userFor('reviewer'), handlers: handlers() });
    const card = await screen.findByRole('article', { name: 'Possible duplicate: Ram Thapa' });
    expect(within(card).getByText('90%')).toBeInTheDocument();
    expect(within(card).getByText('same citizenship number')).toBeInTheDocument();
    expect(card).toHaveTextContent('Possible match · In the register (an earlier run)');
    expect(card).toHaveTextContent('Held row · Row 12 of this run');
    const dob = within(card)
      .getByRole('rowheader', { name: /Date of birth/ })
      .closest('tr')!;
    expect(dob).toHaveClass('differs');
    expect(dob).toHaveTextContent('—');
    const name = within(card).getByRole('rowheader', { name: 'Name (English)' }).closest('tr')!;
    expect(name).not.toHaveClass('differs');
    expect(card).not.toHaveTextContent(/\d{2}-\d{2}-\d{2}-\d{5}/);
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
    await userEvent.click(await screen.findByRole('button', { name: 'Same person: link…' }));
    const dialog = screen.getByRole('dialog', { name: 'Link to the existing record' });
    await userEvent.type(
      within(dialog).getByLabelText('Reason'),
      'Same number, same name and father',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Link' }));
    expect(await screen.findByText('Linked to the existing record.')).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === '/api/v1/matches/7/decision')!.body).toEqual({
      decision: 'link',
      reason: 'Same number, same name and father',
    });
  });

  it('loads the held row as a new person when they are different people', async () => {
    renderApp({
      route: '/matches',
      user: userFor('reviewer'),
      handlers: handlers({
        'POST /api/v1/matches/7/decision': [
          200,
          { id: '7', decision: 'not_same', rowStatus: 'loaded' },
        ],
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Different people…' }));
    const dialog = screen.getByRole('dialog', { name: 'Load as a different person' });
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Namesakes: different fathers');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Load as new' }));
    expect(await screen.findByText('Loaded as a new person.')).toBeInTheDocument();
  });

  it('is only for reviewers', async () => {
    renderApp({ route: '/matches', user: userFor('operator'), handlers: handlers() });
    expect(
      await screen.findByRole('heading', { name: 'Not available to your role' }),
    ).toBeInTheDocument();
  });
});
