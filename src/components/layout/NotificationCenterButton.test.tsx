import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationCenterButton } from './NotificationCenterButton';

const api = vi.hoisted(() => ({
  page: vi.fn(),
  unread: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}));

vi.mock('@/lib/notificationCenterApi', () => ({ notificationCenterApi: api }));

const role = vi.hoisted(() => ({ current: 'TEACHER' }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ admin: { role: role.current } }) }));

const PAGE = {
  unreadCount: 2,
  hasMore: false,
  items: [
    {
      id: 'pending',
      kind: 'TEACHER_PENDING_ACTIONS',
      title: 'Незавершённые действия: 3',
      body: '2 урока без посещаемости · 1 тест на проверку',
      createdAt: '2026-10-14T10:00:00Z',
      read: false,
      route: 'home',
      params: {
        groups: [{ type: 'ATTENDANCE', count: 2 }, { type: 'TEST_REVIEW', count: 1 }],
        actions: [
          { type: 'ATTENDANCE', label: 'Посещаемость: Физика, 7А · 14.10', route: 'attendance', params: { lessonId: 77 } },
        ],
      },
    },
    {
      id: 'soon',
      kind: 'TEACHER_LESSON_SOON',
      title: 'Скоро урок: Математика, 5А',
      body: 'Начало через 10 минут, в 10:30 · каб. 301',
      createdAt: '2026-10-14T10:20:00Z',
      read: true,
      route: 'lesson',
      params: { lessonId: 91 },
    },
  ],
};

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}</p>;
}

function renderButton() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/homework']}>
        <aside>
          <NotificationCenterButton wide />
        </aside>
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationCenterButton — лента учителя', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    role.current = 'TEACHER';
    api.unread.mockResolvedValue({ count: 2 });
    api.page.mockResolvedValue(PAGE);
    api.markRead.mockResolvedValue(undefined);
  });

  it('на значке — число непрочитанных', async () => {
    renderButton();

    expect(await screen.findByRole('button', { name: 'Уведомления, непрочитанных: 2' })).toHaveTextContent('2');
  });

  it('«Незавершённые действия» разворачиваются списком, и действие ведёт к своему уроку', async () => {
    renderButton();
    await userEvent.click(await screen.findByRole('button', { name: /Уведомления/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Уведомления' });
    expect(within(dialog).getByText('Незавершённые действия: 3')).toBeInTheDocument();
    // Перечислено одно действие из трёх — остальное в разделах.
    expect(within(dialog).getByText('И ещё 2 — в разделах панели.')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Посещаемость: Физика, 7А · 14.10' }));

    expect(screen.getByTestId('where')).toHaveTextContent('/lesson-schedule/lessons/77/attendance');
    expect(api.markRead).toHaveBeenCalledWith('pending');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('событие урока открывает урок; прочитанное второй раз не отмечается', async () => {
    renderButton();
    await userEvent.click(await screen.findByRole('button', { name: /Уведомления/ }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: /Скоро урок: Математика, 5А/ }));

    expect(screen.getByTestId('where')).toHaveTextContent('/lesson-schedule/lessons/91');
    expect(api.markRead).not.toHaveBeenCalled();
  });

  it('Escape закрывает ленту', async () => {
    renderButton();
    await userEvent.click(await screen.findByRole('button', { name: /Уведомления/ }));
    await screen.findByRole('dialog');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('администрация: Warning ведёт в расписание периода, Info — в результаты опроса', async () => {
    role.current = 'ADMIN';
    api.page.mockResolvedValue({
      unreadCount: 2,
      hasMore: false,
      items: [
        {
          id: 'period', kind: 'ADMIN_SCHEDULE_UNPUBLISHED', read: false, createdAt: '2026-10-14T10:00:00Z',
          title: 'Расписание на «2 четверть» не опубликовано', body: 'До начала периода осталось 14 дней',
          route: 'schedule', params: { periodId: 31 },
        },
        {
          id: 'survey', kind: 'ADMIN_SURVEY_CLOSED', read: false, createdAt: '2026-10-14T09:00:00Z',
          title: 'Опрос «Обратная связь о школе» завершён', body: 'Опрос прошли: 47 пользователей.',
          route: 'survey-results', params: { surveyId: 44 },
        },
      ],
    });
    renderButton();
    await userEvent.click(await screen.findByRole('button', { name: /Уведомления/ }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByLabelText('Предупреждение')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Информация')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: /Расписание на «2 четверть»/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/lesson-schedule');
    expect(api.markRead).toHaveBeenCalledWith('period');
  });
});
