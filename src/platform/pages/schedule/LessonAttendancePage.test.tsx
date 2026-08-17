import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonAttendancePage } from './LessonAttendancePage';

const useLesson = vi.fn();
const useAttendanceSheet = vi.fn();
const useAttendanceHistory = vi.fn();
const useLessonOccurrences = vi.fn();
const saveDraft = vi.fn();
const publish = vi.fn();
const markAll = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useLesson: (...args: unknown[]) => useLesson(...args),
  useAttendanceSheet: (...args: unknown[]) => useAttendanceSheet(...args),
  useAttendanceHistory: (...args: unknown[]) => useAttendanceHistory(...args),
  useLessonOccurrences: (...args: unknown[]) => useLessonOccurrences(...args),
  useSaveAttendanceDraft: () => ({ mutateAsync: saveDraft, isPending: false }),
  usePublishAttendance: () => ({ mutateAsync: publish, isPending: false }),
  useMarkAllPresent: () => ({ mutateAsync: markAll, isPending: false }),
}));

function lesson(overrides: Record<string, unknown> = {}) {
  return {
    id: 6,
    date: '2026-08-03',
    startTime: '10:00:00',
    endTime: '10:45:00',
    status: 'ACTIVE',
    temporalStatus: 'ONGOING',
    subjectName: 'Английский язык',
    className: '5 «А»',
    room: '204',
    teacher: { fullName: 'Иванова М.В.' },
    capabilities: ['VIEW_CARD', 'VIEW_ATTENDANCE', 'FILL_ATTENDANCE', 'VIEW_ADMIN_HISTORY'],
    ...overrides,
  };
}

function entry(id: number, name: string, draft: Record<string, unknown> = { status: 'NOT_MARKED' }) {
  return { studentProfileId: id, fullName: name, draft, published: null };
}

function sheet(overrides: Record<string, unknown> = {}) {
  return {
    lessonId: 6,
    state: 'NOT_FILLED',
    version: null,
    hasUnpublishedChanges: false,
    restoredAt: null,
    canFill: true,
    canPublish: false,
    reminder: true,
    markedCount: 0,
    totalCount: 2,
    entries: [entry(1, 'Александров Д.С.'), entry(2, 'Иванов А.С.')],
    ...overrides,
  };
}

/** Куда увёл переход — иначе о смене даты можно судить только по вызовам моков. */
function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/lesson-schedule/lessons/6/attendance']}>
      <LocationProbe />
      <Routes>
        <Route
          path="/lesson-schedule/lessons/:lessonId/attendance"
          element={<LessonAttendancePage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LessonAttendancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLesson.mockReturnValue({ data: lesson(), isPending: false, isError: false, error: null });
    useAttendanceSheet.mockReturnValue({
      data: sheet(),
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    useAttendanceHistory.mockReturnValue({ data: undefined, isPending: false, isError: false });
    useLessonOccurrences.mockReturnValue({ data: undefined, isPending: false, isError: false });
  });

  it('открывается на просмотр: отметки видно, но менять их нечем', () => {
    renderPage();

    expect(screen.getByText('Александров Д.С.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Редактировать' })).toBeEnabled();
    // Ни массового действия, ни выпадающих списков — просмотр ничего не меняет.
    expect(screen.queryByRole('button', { name: 'Все присутствуют' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Присутствовал|Не отмечено/ })).not.toBeInTheDocument();
  });

  it('«Редактировать» включает управление листом', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Редактировать' }));

    expect(screen.getByRole('button', { name: 'Все присутствуют' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сохранить черновик' })).toBeInTheDocument();
    // Неполный лист публиковать нельзя — это условие бэкенда, и кнопка о нём знает.
    expect(screen.getByRole('button', { name: 'Опубликовать' })).toBeDisabled();
  });

  it('до начала урока лист только читается и объясняет, почему', () => {
    useLesson.mockReturnValue({
      data: lesson({ temporalStatus: 'UPCOMING' }),
      isPending: false,
      isError: false,
      error: null,
    });
    useAttendanceSheet.mockReturnValue({
      data: sheet({ canFill: false, reminder: false }),
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('Отметка станет доступна с начала урока')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Редактировать' })).toBeDisabled();
  });

  it('отменённый урок показывает погашенную витрину и не предлагает правку', () => {
    useLesson.mockReturnValue({
      data: lesson({ status: 'CANCELLED', cancellationComment: 'болезнь учителя' }),
      isPending: false,
      isError: false,
      error: null,
    });
    useAttendanceSheet.mockReturnValue({
      data: sheet({ state: 'ANNULLED', canFill: false, reminder: false }),
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText(/Урок отменён — посещаемость недоступна/)).toBeInTheDocument();
    expect(screen.getByText(/болезнь учителя/)).toBeInTheDocument();
    expect(
      screen.getByText(/Ранее опубликованные данные скрыты от ученика и родителя/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
  });

  it('пустой состав — вопрос к классу, а не к посещаемости', () => {
    useAttendanceSheet.mockReturnValue({
      data: sheet({ entries: [], totalCount: 0 }),
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('В уроке отсутствуют ученики.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Редактировать' })).toBeDisabled();
  });

  it('даёт перейти на другую дату того же занятия', async () => {
    useLesson.mockReturnValue({
      data: lesson({ scheduleLessonId: 77 }),
      isPending: false,
      isError: false,
      error: null,
    });
    useLessonOccurrences.mockReturnValue({
      data: {
        content: [
          { id: 5, date: '2026-07-27', status: 'ACTIVE', temporalStatus: 'FINISHED' },
          { id: 6, date: '2026-08-03', status: 'ACTIVE', temporalStatus: 'ONGOING' },
          { id: 7, date: '2026-08-10', status: 'CANCELLED', temporalStatus: 'UPCOMING' },
        ],
      },
      isPending: false,
      isError: false,
    });

    renderPage();

    // Открылись на текущем уроке — он и выбран в списке.
    expect(screen.getByRole('button', { name: /Понедельник, 3 августа/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Предыдущее занятие' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/lesson-schedule/lessons/5/attendance',
    );
  });

  it('у урока вне расписания переключать нечего — остаётся дата', () => {
    renderPage();

    expect(screen.getByText('Понедельник, 3 августа')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Предыдущее занятие' })).not.toBeInTheDocument();
  });

  it('восстановленный урок просит опубликовать заново', () => {
    useAttendanceSheet.mockReturnValue({
      data: sheet({ state: 'DRAFT', version: 4, restoredAt: '2026-08-03T09:40:00Z' }),
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(
      screen.getByText('Урок восстановлен — посещаемость требует повторной публикации'),
    ).toBeInTheDocument();
  });
});
