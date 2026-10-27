import { act, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';

function Probe() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="fallback">{t('missing.translation.key')}</span>
      <button onClick={() => setLanguage('ar')}>Arabic</button>
    </div>
  );
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'connectlocal_locale=; Max-Age=0; Path=/';
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('falls back without exposing a missing translation key', () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    expect(screen.getByTestId('fallback')).toHaveTextContent('');
  });

  it('updates locale direction and persists the selected locale', async () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    await act(async () => {
      screen.getByRole('button', { name: 'Arabic' }).click();
    });
    await waitFor(() => expect(screen.getByTestId('language')).toHaveTextContent('ar'));
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('selectedLanguage')).toBe('ar');
    expect(document.cookie).toContain('connectlocal_locale=ar');
  });
});
