import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setLanguage } from '../i18n/language';
import { renderApp, userFor } from '../test/render';

afterEach(() => {
  setLanguage('en');
  localStorage.clear();
});

describe('going home', () => {
  it('links the logo and the Home menu item to a fresh load of the home page', async () => {
    renderApp({ route: '/status', user: userFor('operator') });
    const banner = await screen.findByRole('banner');
    expect(within(banner).getByRole('link', { name: /Setu/ })).toHaveAttribute('href', '/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });
});

describe('language switch', () => {
  it('shows the menu and home page in Nepali, then back in English', async () => {
    renderApp({ route: '/', user: userFor('operator') });
    const nav = await screen.findByRole('navigation', { name: 'Main' });

    await userEvent.click(within(nav).getByRole('button', { name: 'नेपाली' }));
    expect(within(nav).getByRole('link', { name: 'गृहपृष्ठ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'स्वागत छ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'बाहिरिनुहोस्' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ne');
    expect(localStorage.getItem('setu.language')).toBe('ne');

    await userEvent.click(within(nav).getByRole('button', { name: 'English' }));
    expect(within(nav).getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('offers the switch on the sign-in page too', async () => {
    renderApp({ route: '/login' });
    await userEvent.click(await screen.findByRole('button', { name: 'नेपाली' }));
    expect(screen.getByRole('heading', { level: 1, name: 'लगइन' })).toBeInTheDocument();
    expect(screen.getByLabelText('पासवर्ड')).toBeInTheDocument();
  });
});
