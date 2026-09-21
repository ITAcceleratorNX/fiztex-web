import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import type { MyProfile } from '@/lib/profileApi';

const me = vi.fn();
vi.mock('@/lib/profileApi', () => ({ profileApi: { me: () => me() } }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ admin: { fullName: 'Искаков Алишер', role: 'TEACHER' }, logout: vi.fn() }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const TEACHER: MyProfile = {
  accountId: 2,
  role: 'TEACHER',
  fullName: 'Искаков Алишер Мақсатұлы',
  phone: '+77001000000',
  email: null,
  teacher: {
    teacherProfileId: 1,
    assignments: [
      { subjectId: 1, subjectName: 'Математика', classId: 3, className: '6А' },
      { subjectId: 1, subjectName: 'Математика', classId: 1, className: '5А' },
    ],
  },
  children: [],
};

describe('ProfilePage', () => {
  beforeEach(() => {
    me.mockReset();
  });

  it('учителю показывает нагрузку одной строкой на предмет', async () => {
    me.mockResolvedValue(TEACHER);
    renderPage();

    expect(await screen.findByText('Искаков Алишер Мақсатұлы')).toBeInTheDocument();
    expect(screen.getByText('Учитель')).toBeInTheDocument();
    expect(screen.getByText('+77001000000')).toBeInTheDocument();
    expect(screen.getByText('Математика')).toBeInTheDocument();
    expect(screen.getByText('5А, 6А')).toBeInTheDocument();
  });

  it('роли без школьной карточки не получают пустых блоков', async () => {
    me.mockResolvedValue({
      accountId: 284,
      role: 'PSYCHOLOGIST',
      fullName: 'Ахметова Сауле Ерлановна',
      phone: '+77009000001',
      children: [],
    } satisfies MyProfile);
    renderPage();

    expect(await screen.findByText('Ахметова Сауле Ерлановна')).toBeInTheDocument();
    expect(screen.queryByText('Что веду')).not.toBeInTheDocument();
    expect(screen.queryByText('Учёба')).not.toBeInTheDocument();
    expect(screen.queryByText('Дети')).not.toBeInTheDocument();
  });

  it('пока профиль едет, имя берётся из сессии — экран не выглядит сломанным', () => {
    me.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Искаков Алишер')).toBeInTheDocument();
  });

  it('на отказе предлагает повтор, а не пустую страницу', async () => {
    me.mockRejectedValue(new Error('сеть'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Не удалось загрузить профиль')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});
