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

  it('names the Logo with APP_NAME and spells it in the wordmark', () => {
    const { container } = render(<Logo />);
    expect(screen.getByRole('img', { name: APP_NAME })).toBeInTheDocument();
    expect(container).toHaveTextContent(APP_NAME);
    expect(container.textContent ?? '').not.toMatch(/fiztex/i);
  });

  it('белый логотип панели входа тоже называется PhysTech, а не прежним словом', () => {
    const { container } = render(<Logo tone="white" />);
    expect(screen.getByRole('img', { name: APP_NAME })).toBeInTheDocument();
    expect(container).toHaveTextContent(APP_NAME);
    expect(container.querySelector('img')).toBeNull();
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

