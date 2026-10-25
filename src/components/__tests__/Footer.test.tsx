import { render, screen } from '@testing-library/react';
import { Footer } from '../Footer';
import { LanguageProvider } from '@/contexts/LanguageContext';

describe('Footer', () => {
  it('renders the copyright notice', () => {
    render(
      <LanguageProvider>
        <Footer />
      </LanguageProvider>
    );
    
    const year = new Date().getFullYear();
    const copyrightText = screen.getByText(`© ${year} business_web. All rights reserved.`);
    
    expect(copyrightText).toBeInTheDocument();
  });

  it('contains links to other pages', () => {
    render(
      <LanguageProvider>
        <Footer />
      </LanguageProvider>
    );
    
    expect(screen.getByText('About Us')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });
});
