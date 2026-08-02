import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { LessonCardPage } from './LessonCardPage';

const useLesson = vi.fn();
const useLessonHistory = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useLesson: (...args: unknown[]) => useLesson(...args),
  useLessonHistory: (...args: unknown[]) => useLessonHistory(...args),
}));

/** Урок в том виде, в каком его отдаёт GET /api/lessons/{id} админу. */
function lesson(overrides: Record<string, unknown> = {}) {
  return {
    id: 6,
    date: '2026-08-03',
    startTime: '08:10:00',
    endTime: '08:55:00',
    status: 'ACTIVE',
    temporalStatus: 'UPCOMING',
    academicPeriodStatus: 'ACTIVE',
    className: '7 «А»',
    subjectName: 'Математика',
    room: '311',
    topic: null,
    teacher: { id: 4, fullName: 'Ахметова Гульнара Сериковна' },
    substituteTeacher: null,
    comment: null,
    changedFields: [],
    capabilities: ['VIEW_CARD', 'VIEW_ADMIN_HISTORY', 'MANAGE_STRUCTURE'],
    ...overrides,
  };
}

function renderCard() {
  return render(
    <MemoryRouter initialEntries={['/lesson-schedule/lessons/6']}>
      <Routes>
        <Route path="/lesson-schedule/lessons/:lessonId" element={<LessonCardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LessonCardPage', () => {
  beforeEach(() => {
    useLesson.mockReset();
    useLessonHistory.mockReset();
    useLessonHistory.mockReturnValue({ data: undefined, isPending: false, isError: false });
  });

  it('показывает скелетон, пока урок грузится', () => {
    useLesson.mockReturnValue({ data: undefined, isPending: true, isError: false, error: null });
    renderCard();
    expect(screen.getByLabelText('Загрузка урока')).toBeInTheDocument();
  });

  it('404 показывает «нет доступа», а не ошибку загрузки', () => {
    useLesson.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new ApiError(404, 'Урок не найден'),
      refetch: vi.fn(),
    });
    renderCard();
    expect(screen.getByText('У вас нет доступа к этому уроку')).toBeInTheDocument();
  });

  it('прочая ошибка показывает состояние ошибки с повтором', () => {
    useLesson.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new ApiError(500, 'Ошибка 500'),
      refetch: vi.fn(),
    });
    renderCard();
    expect(screen.getByText('Не удалось загрузить урок')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('пустые тема и комментарий подписаны, карандашей у админа нет', () => {
    useLesson.mockReturnValue({ data: lesson(), isPending: false, isError: false, error: null });
    renderCard();
    expect(screen.getByText('Тема не указана')).toBeInTheDocument();
    expect(screen.getByText('Комментария пока нет')).toBeInTheDocument();
    // MANAGE_STRUCTURE без EDIT_TEACHING_PART: админ учебную часть не правит (ТЗ §5.1).
    expect(
      screen.queryByTitle('Редактирование доступно учителю урока'),
    ).not.toBeInTheDocument();
  });

  it('замена и разовые изменения помечены на карточке', () => {
    useLesson.mockReturnValue({
      data: lesson({
        substituteTeacher: { id: 5, fullName: 'Смирнов Дмитрий Павлович' },
        changedFields: ['TIME', 'ROOM'],
      }),
      isPending: false,
      isError: false,
      error: null,
    });
    renderCard();
    expect(screen.getByText('Смирнов Дмитрий Павлович')).toBeInTheDocument();
    expect(screen.getByText(/Замена вместо Ахметова Гульнара Сериковна/)).toBeInTheDocument();
    expect(screen.getAllByText('Изменено')).toHaveLength(2);
  });

  it('закрытый учебный период показывает замок', () => {
    useLesson.mockReturnValue({
      data: lesson({ academicPeriodStatus: 'ARCHIVED' }),
      isPending: false,
      isError: false,
      error: null,
    });
    renderCard();
    expect(screen.getByText('Учебный период закрыт — только просмотр')).toBeInTheDocument();
  });

  it('отменённый урок показывает чип и причину', () => {
    useLesson.mockReturnValue({
      data: lesson({
        status: 'CANCELLED',
        cancellationComment: 'Учитель на курсах',
      }),
      isPending: false,
      isError: false,
      error: null,
    });
    renderCard();
    expect(screen.getByText('Урок отменен')).toBeInTheDocument();
    expect(screen.getByText('Учитель на курсах')).toBeInTheDocument();
  });
});
