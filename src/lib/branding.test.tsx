import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { APP_NAME, ADMIN_TITLE } from './branding';
import { Logo } from '@/components/layout/Logo';
import { EntranceShell } from '@/pages/entrance/EntranceShell';

describe('web branding', () => {
  it('exports PhysTech constants', () => {
    expect(APP_NAME).toBe('PhysTech');
    expect(ADMIN_TITLE).toBe('PhysTech — Административная панель');
  });

  it('uses APP_NAME in Logo alt text', () => {
    render(<Logo />);
    expect(screen.getByAltText(APP_NAME)).toBeInTheDocument();
  });

  it('renders APP_NAME inside EntranceShell header', () => {
    render(<EntranceShell>child</EntranceShell>);
    expect(screen.getByText(APP_NAME)).toBeInTheDocument();
  });
});

