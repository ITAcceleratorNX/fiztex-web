import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationCenterButton } from './NotificationCenterButton';

const api = vi.hoisted(() => ({
  page: vi.fn(),
  collections: vi.fn(),
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
      collection: 'ACTIONS',
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
      collection: 'LESSONS',
      params: { lessonId: 91 },
    },
  ],
};

/** Подборки первого экрана: строки ленты, разложенные по разделам сервера. */
function collectionsOf(page: typeof PAGE) {
  const groups = new Map<string, { collection: string; unreadCount: number; latest: (typeof PAGE.items)[number] }>();
  for (const item of page.items) {
    const key = (item as { collection?: string }).collection ?? 'OTHER';
    const group = groups.get(key);
    if (!group) groups.set(key, { collection: key, unreadCount: item.read ? 0 : 1, latest: item });
    else group.unreadCount += item.read ? 0 : 1;
  }
  return { unreadCount: page.unreadCount, collections: [...groups.values()] };
}

/** Открыть колокольчик и раздел. */
async function openSection(label: RegExp) {
  await userEvent.click(await screen.findByRole('button', { name: /Уведомления/ }));
  const dialog = await screen.findByRole('dialog', { name: 'Уведомления' });
  await userEvent.click(await within(dialog).findByRole('button', { name: label }));
  return dialog;
}

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
    api.page.mockImplementation((_signal: unknown, collection?: string) => Promise.resolve({
      ...PAGE, items: PAGE.items.filter((item) => !collection || item.collection === collection),
    }));
    api.collections.mockResolvedValue(collectionsOf(PAGE));
    api.markRead.mockResolvedValue(undefined);
  });

  it('на значке — число непрочитанных', async () => {
    renderButton();

    expect(await screen.findByRole('button', { name: 'Уведомления, непрочитанных: 2' })).toHaveTextContent('2');
  });

  it('первый экран — подборки с последней строкой и числом непрочитанного', async () => {
    renderButton();
    await userEvent.click(await screen.findByRole('button', { name: /Уведомления/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Уведомления' });

    const actions = await within(dialog).findByRole('button', { name: /Незавершённые действия/ });
    expect(actions).toHaveTextContent('Незавершённые действия: 3');
    expect(actions).toHaveTextContent('непрочитанных: 1');
    expect(within(dialog).getByRole('button', { name: /Уроки/ })).toHaveTextContent('Скоро урок: Математика, 5А');
    expect(api.page).not.toHaveBeenCalled();
  });

  it('«Прочитать все» внутри раздела отмечает только его', async () => {
    api.markAllRead.mockResolvedValue(undefined);
    renderButton();
    const dialog = await openSection(/Незавершённые действия/);
    await within(dialog).findByText('Незавершённые действия: 3');

    await userEvent.click(within(dialog).getByRole('button', { name: /Прочитать все/ }));

    expect(api.markAllRead).toHaveBeenCalledWith('2026-10-14T10:00:00Z', 'ACTIONS');
  });

  it('«Незавершённые действия» разворачиваются списком, и действие ведёт к своему уроку', async () => {
    renderButton();
    const dialog = await openSection(/Незавершённые действия/);

    expect(await within(dialog).findByText('Незавершённые действия: 3')).toBeInTheDocument();
    // Перечислено одно действие из трёх — остальное в разделах.
    expect(within(dialog).getByText('И ещё 2 — в разделах панели.')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Посещаемость: Физика, 7А · 14.10' }));

    expect(screen.getByTestId('where')).toHaveTextContent('/lesson-schedule/lessons/77/attendance');
    expect(api.markRead).toHaveBeenCalledWith('pending');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('событие урока открывает урок; прочитанное второй раз не отмечается', async () => {
    renderButton();
    const dialog = await openSection(/Уроки/);

    await userEvent.click(await within(dialog).findByRole('button', { name: /Скоро урок: Математика, 5А/ }));

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
    const adminPage = {
      unreadCount: 2,
      hasMore: false,
      items: [
        {
          id: 'period', kind: 'ADMIN_SCHEDULE_UNPUBLISHED', read: false, createdAt: '2026-10-14T10:00:00Z',
          title: 'Расписание на «2 четверть» не опубликовано', body: 'До начала периода осталось 14 дней',
          route: 'schedule', params: { periodId: 31 }, collection: 'SCHEDULE',
        },
        {
          id: 'survey', kind: 'ADMIN_SURVEY_CLOSED', read: false, createdAt: '2026-10-14T09:00:00Z',
          title: 'Опрос «Обратная связь о школе» завершён', body: 'Опрос прошли: 47 пользователей.',
          route: 'survey-results', params: { surveyId: 44 }, collection: 'SURVEYS',
        },
      ],
    };
    api.page.mockImplementation((_signal: unknown, collection?: string) => Promise.resolve({
      ...adminPage, items: adminPage.items.filter((item) => !collection || item.collection === collection),
    }));
    api.collections.mockResolvedValue(collectionsOf(adminPage as unknown as typeof PAGE));
    renderButton();
    let dialog = await openSection(/Опросы/);
    expect(await within(dialog).findByLabelText('Информация')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Опросы' }));

    dialog = screen.getByRole('dialog');
    await userEvent.click(await within(dialog).findByRole('button', { name: /Расписание/ }));
    expect(await within(dialog).findByLabelText('Предупреждение')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: /Расписание на «2 четверть»/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/lesson-schedule');
    expect(api.markRead).toHaveBeenCalledWith('period');
  });
});
