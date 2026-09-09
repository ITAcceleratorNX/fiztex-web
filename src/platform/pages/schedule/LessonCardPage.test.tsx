import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { LessonCardPage } from './LessonCardPage';

const useLesson = vi.fn();
const useLessonHistory = vi.fn();
const useAttendanceSheet = vi.fn();
const useLessonHomework = vi.fn();
const useLessonGradeSheet = vi.fn();
const useGradePermission = vi.fn();
const setHomeworkNotAssigned = vi.fn();

// Роль нужна карточке только ради ссылки «К расписанию»: у учителя она ведёт на его
// собственный экран, у админа — в конструктор.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ admin: { role: 'ADMIN' } }),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

// Список учителей нужен только модалке замены — она открывается по кнопке, и пустой
// страницы здесь достаточно.
vi.mock('@/platform/hooks/useTeacherAvailability', () => ({
  useTeachersList: () => ({ data: { content: [] }, isPending: false, isError: false }),
}));

/** Команды урока в карточке не вызываются — она их только показывает. */
const idleMutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
});

vi.mock('@/hooks/queries', () => ({
  useLesson: (...args: unknown[]) => useLesson(...args),
  useLessonHistory: (...args: unknown[]) => useLessonHistory(...args),
  useAttendanceSheet: (...args: unknown[]) => useAttendanceSheet(...args),
  useLessonHomework: (...args: unknown[]) => useLessonHomework(...args),
  useLessonGradeSheet: (...args: unknown[]) => useLessonGradeSheet(...args),
  useGradePermission: (...args: unknown[]) => useGradePermission(...args),
  useCancelLesson: () => idleMutation(),
  useRestoreLesson: () => idleMutation(),
  useAssignSubstitute: () => idleMutation(),
  useRemoveSubstitute: () => idleMutation(),
  useSetGradePermission: () => idleMutation(),
  useSaveLessonTopic: () => idleMutation(),
  useSaveLessonComment: () => idleMutation(),
  useSetHomeworkNotAssigned: () => ({ mutate: setHomeworkNotAssigned, isPending: false }),
}));

/** Права того, кто урок ведёт: состояние ДЗ меняет он, а не администратор. */
const TEACHING = ['VIEW_CARD', 'VIEW_STUDENTS', 'EDIT_TEACHING_PART'];

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
    useLessonGradeSheet.mockReset();
    useLessonGradeSheet.mockReturnValue({ data: undefined, isPending: false, isError: false });
    useGradePermission.mockReset();
    useGradePermission.mockReturnValue({ data: undefined, isPending: false, isError: false });
    setHomeworkNotAssigned.mockReset();
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


  /* --- состояния ДЗ (ТЗ «Статусы домашнего задания») --------------------------- */

  /**
   * Блок ДЗ отвечает не только «что задано», но и «закрыт ли вопрос»: пустой список
   * одинаков у урока, до которого не дошли руки, и у урока, на который решили не задавать.
   */
  it('говорит учителю, что действие по ДЗ не завершено, и предлагает его закрыть', async () => {
    useLesson.mockReturnValue({
      data: lesson({ capabilities: TEACHING, homeworkState: 'NOT_SPECIFIED' }),
      isPending: false,
      isError: false,
      error: null,
    });
    renderCard();

    expect(screen.getAllByText('Домашнее задание пока не указано').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'ДЗ не задано' }));
    expect(setHomeworkNotAssigned).toHaveBeenCalledWith(true, expect.anything());
  });

  it('после отметки предлагает передумать, а не отметить второй раз', async () => {
    useLesson.mockReturnValue({
      data: lesson({ capabilities: TEACHING, homeworkState: 'NOT_ASSIGNED' }),
      isPending: false,
      isError: false,
      error: null,
    });
    renderCard();

    expect(screen.getAllByText('ДЗ не задано').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Отменить отметку' }));
    expect(setHomeworkNotAssigned).toHaveBeenCalledWith(false, expect.anything());
  });

  it('не предлагает «ДЗ не задано» поверх выданного задания', () => {
    useLesson.mockReturnValue({
      data: lesson({ capabilities: TEACHING, homeworkState: 'ASSIGNED' }),
      isPending: false,
      isError: false,
      error: null,
    });
    useLessonHomework.mockReturnValue({
      data: [{ id: 12, title: 'Упражнения 1–5', status: 'PUBLISHED', lesson: { id: 6 } }],
      isPending: false,
      isError: false,
    });
    renderCard();

    // Бэкенд ответил бы 409: два финальных состояния одновременно ТЗ запрещает.
    expect(screen.queryByRole('button', { name: 'ДЗ не задано' })).toBeNull();
    expect(screen.getAllByText(/ДЗ задано/).length).toBeGreaterThan(0);
  });

  it('черновик показывает учителю как незакрытое действие', () => {
    useLesson.mockReturnValue({
      data: lesson({ capabilities: TEACHING, homeworkState: 'DRAFT' }),
      isPending: false,
      isError: false,
      error: null,
    });
    useLessonHomework.mockReturnValue({
      data: [{ id: 14, title: 'Черновик', status: 'DRAFT', lesson: { id: 6 } }],
      isPending: false,
      isError: false,
    });
    renderCard();

    expect(screen.getAllByText(/Черновик\. Не опубликовано/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'ДЗ не задано' })).toBeInTheDocument();
  });

  it('ученику состояние показывает, а действий не предлагает', () => {
    useLesson.mockReturnValue({
      data: lesson({ capabilities: ['VIEW_CARD'], homeworkState: 'NOT_ASSIGNED' }),
      isPending: false,
      isError: false,
      error: null,
    });
    renderCard();

    expect(screen.getAllByText('ДЗ не задано').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Отменить отметку' })).toBeNull();
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

  it('замену и отмену предлагает только администратор', () => {
    useLesson.mockReturnValue({
      data: lesson(),
      isPending: false,
      isError: false,
      error: null,
    });
    renderCard();

    expect(screen.getByRole('button', { name: /Назначить замену/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Отменить урок/ })).toBeInTheDocument();
  });

  it('учителю урока административных действий не предлагают', () => {
    useLesson.mockReturnValue({
      // MANAGE_STRUCTURE есть только у админа: у учителя урока — учебные права.
      data: lesson({ capabilities: ['VIEW_CARD', 'EDIT_TEACHING_PART', 'FILL_ATTENDANCE'] }),
      isPending: false,
      isError: false,
      error: null,
    });
    renderCard();

    expect(screen.queryByRole('button', { name: /Назначить замену/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Отменить урок/ })).not.toBeInTheDocument();
  });

  it('отменённый урок предлагает восстановление только после ручной отмены', () => {
    useLesson.mockReturnValue({
      data: lesson({ status: 'CANCELLED', cancellationReason: 'CALENDAR_NO_LESSONS' }),
      isPending: false,
      isError: false,
      error: null,
    });
    renderCard();

    // Календарную отмену снимает сама система, поэтому кнопка есть, но выключена.
    expect(screen.getByRole('button', { name: /Восстановить урок/ })).toBeDisabled();
    expect(
      screen.getByText('Урок отменён системой: каникулы или изменение расписания'),
    ).toBeInTheDocument();
  });

  it('при действующей замене показывает разрешение на оценки', () => {
    useLesson.mockReturnValue({
      data: lesson({
        substituteTeacher: { id: 9, fullName: 'Калиев Асылбек Асқарұлы' },
        viewerRole: 'ADMIN',
      }),
      isPending: false,
      isError: false,
      error: null,
    });
    useGradePermission.mockReturnValue({
      data: { canManageGrades: false },
      isPending: false,
      isError: false,
    });
    renderCard();

    expect(screen.getByText('Калиев Асылбек Асқарұлы ведёт этот урок')).toBeInTheDocument();
    expect(
      screen.getByText(/Само назначение замены такого права не даёт/),
    ).toBeInTheDocument();
    expect(useGradePermission).toHaveBeenCalledWith(6, true);
  });

  it('замещающий своё разрешение видит, но не меняет', () => {
    useLesson.mockReturnValue({
      data: lesson({
        substituteTeacher: { id: 9, fullName: 'Калиев Асылбек Асқарұлы' },
        viewerRole: 'SUBSTITUTE_TEACHER',
      }),
      isPending: false,
      isError: false,
      error: null,
    });
    useGradePermission.mockReturnValue({
      data: { canManageGrades: true },
      isPending: false,
      isError: false,
    });
    renderCard();

    expect(screen.getByText('Оценки разрешены')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
