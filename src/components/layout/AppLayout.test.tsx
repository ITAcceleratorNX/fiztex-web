import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';

vi.mock('./Sidebar', () => ({ Sidebar: () => null }));
vi.mock('./AppHeader', () => ({ AppHeader: () => null }));

describe('AppLayout auth notice', () => {
  it('объясняет, почему вместо запрошенной страницы открыт стартовый раздел', () => {
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/homework',
        state: { authNotice: 'У вашей роли нет доступа к разделу /dashboard. Открыт стартовый раздел вашей роли.' },
      }]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/homework" element={<h1>Домашние задания</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('/dashboard');
    expect(screen.getByRole('heading', { name: 'Домашние задания' })).toBeInTheDocument();
  });
});
