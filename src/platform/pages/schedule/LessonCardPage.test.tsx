import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { LessonCardPage } from './LessonCardPage';

const useLesson = vi.fn();
const useLessonHistory = vi.fn();
const useAttendanceSheet = vi.fn();
const useLessonHomework = vi.fn();

// Роль нужна карточке только ради ссылки «К расписанию»: у учителя она ведёт на его
// собственный экран, у админа — в конструктор.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ admin: { role: 'ADMIN' } }),
}));

vi.mock('@/hooks/queries', () => ({
  useLesson: (...args: unknown[]) => useLesson(...args),
  useLessonHistory: (...args: unknown[]) => useLessonHistory(...args),
  useAttendanceSheet: (...args: unknown[]) => useAttendanceSheet(...args),
  useLessonHomework: (...args: unknown[]) => useLessonHomework(...args),
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
    useAttendanceSheet.mockReset();
    useAttendanceSheet.mockReturnValue({ data: undefined, isPending: false, isError: false });
    useLessonHomework.mockReset();
    useLessonHomework.mockReturnValue({ data: [], isPending: false, isError: false });
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
  it('задания урока видны прямо на карточке, а плитка называет их число', () => {
    useLesson.mockReturnValue({
      data: lesson({ capabilities: ['VIEW_CARD', 'VIEW_STUDENTS', 'MANAGE_STRUCTURE'] }),
      isPending: false,
      isError: false,
      error: null,
    });
    useLessonHomework.mockReturnValue({
      data: [
        {
          id: 12,
          title: 'Параграф 12, упражнения 1–5',
          status: 'PUBLISHED',
          dueType: 'NEXT_LESSON',
          dueAt: null,
          lesson: { id: 6 },
          progress: { submitted: 3, total: 25 },
        },
        // Задание без привязки: к уроку его относит срок (LessonHomeworkScope).
        {
          id: 13,
          title: 'Задано из раздела',
          status: 'PUBLISHED',
          dueType: 'EXACT',
          dueAt: '2026-08-03T09:00:00Z',
          progress: { submitted: 0, total: 25 },
        },
        { id: 14, title: 'Черновик', status: 'DRAFT', dueType: 'NONE', dueAt: null, lesson: { id: 6 } },
      ],
      isPending: false,
      isError: false,
    });
    renderCard();

    expect(screen.getByText('Параграф 12, упражнения 1–5')).toBeInTheDocument();
    // Срок «до следующего урока» до публикации даты не имеет — но и «без срока» это не он.
    expect(screen.getByText('До следующего урока')).toBeInTheDocument();
    expect(screen.getByText('3 / 25')).toBeInTheDocument();
    expect(screen.getByText('3 задания · 1 в черновике')).toBeInTheDocument();

    // Привязанное к уроку показано без оговорок, пришедшее по сроку — с пояснением.
    expect(screen.getByText(/срок на этом уроке/)).toBeInTheDocument();

    // Карточку задания бэкенд отдаёт только учителю урока: у админа строка не ведёт никуда.
    expect(screen.getByRole('button', { name: /Параграф 12/ })).toBeDisabled();
  });

  it('урок без заданий говорит об этом, а не молчит', () => {
    useLesson.mockReturnValue({
      data: lesson({ capabilities: ['VIEW_CARD', 'VIEW_STUDENTS'] }),
      isPending: false,
      isError: false,
      error: null,
    });
    renderCard();
    expect(screen.getByText('К этому уроку заданий нет')).toBeInTheDocument();
    expect(screen.getByText('Заданий нет')).toBeInTheDocument();
  });

  it('без права видеть состав урока за заданиями не ходим', () => {
    useLesson.mockReturnValue({
      data: lesson({ capabilities: ['VIEW_CARD'] }),
      isPending: false,
      isError: false,
      error: null,
    });
    renderCard();

    expect(useLessonHomework).toHaveBeenCalledWith(6, false);
    expect(
      screen.getByText('Задания урока видны его учителю и администратору'),
    ).toBeInTheDocument();
  });
});
