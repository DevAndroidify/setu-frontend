import { screen, within } from '@testing-library/react';
import { renderApp } from '../../test/render';

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

  it('lists one demo account per role while developing', async () => {
    renderApp({ route: '/login' });
    const demo = await screen.findByRole('region', { name: 'Demo accounts, one per role' });
    for (const email of [
      'operator@setu.local',
      'reviewer@setu.local',
      'approver@setu.local',
      'auditor@setu.local',
      'admin@setu.local',
    ]) {
      expect(within(demo).getByText(email)).toBeInTheDocument();
    }
  });
});
