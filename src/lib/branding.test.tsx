import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { APP_NAME, ADMIN_TITLE } from './branding';
import { Logo } from '@/components/layout/Logo';
import { EntranceShell } from '@/pages/entrance/EntranceShell';

describe('web branding', () => {
  it('exports PhysTech constants', () => {
    expect(APP_NAME).toBe('PhysTech');
    expect(ADMIN_TITLE).toBe('PhysTech — Административная панель');
  });

  it('uses the exported brand lockup with APP_NAME as its accessible name', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: APP_NAME })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: APP_NAME })).toHaveAttribute('src', expect.stringContaining('fiztex-logo-lockup'));
  });

  it('uses the exported white brand lockup with APP_NAME as its accessible name', () => {
    render(<Logo tone="white" />);
    expect(screen.getByRole('img', { name: APP_NAME })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: APP_NAME })).toHaveAttribute('width', '137');
    expect(screen.getByRole('img', { name: APP_NAME })).toHaveAttribute('height', '36');
    expect(screen.getByRole('img', { name: APP_NAME })).toHaveAttribute('src', expect.stringContaining('fiztex-logo-white'));
  });

  // Роутер нужен, потому что в подвале шелла стоят ссылки на политику
  // конфиденциальности. Имя ищем внутри <header>: в подвале рядом стоит копирайт,
  // и поиск по всему документу нашёл бы два совпадения вместо проверки заголовка.
  it('renders APP_NAME inside EntranceShell header', () => {
    render(
      <MemoryRouter>
        <EntranceShell>child</EntranceShell>
      </MemoryRouter>,
    );
    const header = screen.getByRole('banner');
    expect(within(header).getByText(APP_NAME)).toBeInTheDocument();
  });

  it('links to both language versions of the privacy policy from the public shell', () => {
    render(
      <MemoryRouter>
        <EntranceShell>child</EntranceShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Политика конфиденциальности' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy?lang=en',
    );
  });
});

