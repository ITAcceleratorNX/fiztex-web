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
const useLessonTextbooks = vi.fn();
const useLessonSummary = vi.fn();
const useKspContext = vi.fn();
const session = vi.hoisted(() => ({ role: 'ADMIN' }));

// Роль нужна карточке только ради ссылки «К расписанию»: у учителя она ведёт на его
// собственный экран, у админа — в конструктор.
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ admin: { role: session.role } }),
}));

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

// Список учителей нужен только модалке замены — она открывается по кнопке, и пустой
// страницы здесь достаточно.
vi.mock('@/platform/hooks/useTeacherAvailability', () => ({
  useTeachersList: () => ({ data: { content: [] }, isPending: false, isError: false }),
}));

// Окна «Использовать повторно» проверяются своими тестами; здесь — только кто и откуда их открывает.
vi.mock('./CopyLessonPreparationModal', () => ({
  CopyLessonPreparationModal: () => <p>Перенос подготовки</p>,
}));

/** Команды урока в карточке не вызываются — она их только показывает. */
const idleMutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
});

vi.mock('@/hooks/queries', () => ({
  useKtpTeaching: () => ({ data: {}, isPending: false }),
  useKtpTeachingHistory: () => ({ data: undefined, isPending: false }),
  useKtpProgress: () => ({ data: undefined, isPending: false }),
  useLessonSummary: (...args: unknown[]) => useLessonSummary(...args),
  useKspContext: (...args: unknown[]) => useKspContext(...args),
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
  useLessonTextbooks: (...args: unknown[]) => useLessonTextbooks(...args),
}));

/** Учебник урока в том виде, в каком его отдаёт GET /api/lessons/{id}/textbooks. */
function textbook(overrides: Record<string, unknown> = {}) {
  return {
    bindingId: 7,
    textbookId: 3,
    title: 'Spotlight 5. Student’s Book',
    format: 'PDF',
    pageCount: 142,
    pageNavigation: true,
    pageFrom: null,
    pageTo: null,
    active: true,
    ...overrides,
  };
}

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

function renderCard(url = '/lesson-schedule/lessons/6') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/lesson-schedule/lessons/:lessonId" element={<LessonCardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LessonCardPage', () => {
  beforeEach(() => {
    session.role = 'ADMIN';
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
    useLessonTextbooks.mockReset();
    useLessonTextbooks.mockReturnValue({
      data: { canSelect: false, selected: null, available: [] },
      isPending: false,
      isError: false,
    });
    useLessonSummary.mockReset();
    useLessonSummary.mockReturnValue({ data: { canEdit: true }, isPending: false });
    useKspContext.mockReset();
    useKspContext.mockReturnValue({ data: undefined, isPending: true, isError: false });
  });

  it('возвращает учителя к неделе, с которой открыта карточка', () => {
    session.role = 'TEACHER';
    useLesson.mockReturnValue({ data: lesson(), isPending: false, isError: false, error: null });
    renderCard('/lesson-schedule/lessons/6?week=2026-09-28');

    expect(screen.getByRole('link', { name: 'К расписанию' })).toHaveAttribute(
      'href',
      '/my-schedule?week=2026-09-28',
    );
  });

  describe('КСП и материалы (KSP-FE-001)', () => {
    it('учитель урока видит карточку КСП в состоянии с сервера, она ведёт на страницу КСП', () => {
      session.role = 'TEACHER';
      useLesson.mockReturnValue({
        data: lesson({ capabilities: [...TEACHING, 'VIEW_TEACHER_HISTORY'] }), isPending: false, isError: false, error: null,
      });
      useKspContext.mockReturnValue({ data: { entryState: 'UNSAVED' }, isPending: false, isError: false });
      renderCard();

      const card = screen.getByRole('link', { name: /Поурочный план \(КСП\)/ });
      expect(card).toHaveAttribute('href', '/lesson-schedule/lessons/6/ksp');
      expect(card).toHaveTextContent('Результат готов, но не сохранён. Проверьте и сохраните');
    });

    it('администратору карточки КСП нет и КСП не спрашивается', () => {
      useLesson.mockReturnValue({ data: lesson(), isPending: false, isError: false, error: null });
      renderCard();

      expect(screen.queryByRole('link', { name: /Поурочный план/ })).not.toBeInTheDocument();
      expect(useKspContext).not.toHaveBeenCalled();
    });

    it('учебника и конспекта на карточке нет — плитка «Материалы» называет, что внутри', () => {
      session.role = 'TEACHER';
      useLesson.mockReturnValue({
        data: lesson({ capabilities: TEACHING, materialCount: 2 }), isPending: false, isError: false, error: null,
      });
      useLessonTextbooks.mockReturnValue({
        data: { canSelect: true, selected: textbook(), available: [textbook()] }, isPending: false, isError: false,
      });
      useLessonSummary.mockReturnValue({ data: { canEdit: true, content: { title: 'Конспект' } }, isPending: false });
      renderCard();

      expect(screen.queryByRole('button', { name: 'Учебник' })).not.toBeInTheDocument();
      expect(screen.queryByText('Конспект урока')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Материалы/ })).toHaveTextContent('Учебник, конспект, 2 файла');
    });
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
  /*
   * Список заданий, состояние ДЗ и «Использовать повторно» у задания переехали в «Материалы урока»
   * (`LessonHomeworkSection`, тесты в LessonMaterialsPage.test). На карточке остаётся плитка.
   */
  it('задания урока на карточке — только плиткой с их числом', () => {
    useLesson.mockReturnValue({
      data: lesson({ capabilities: ['VIEW_CARD', 'VIEW_STUDENTS', 'MANAGE_STRUCTURE'] }),
      isPending: false,
      isError: false,
      error: null,
    });
    useLessonHomework.mockReturnValue({
      data: [
        { id: 12, title: 'Параграф 12, упражнения 1–5', status: 'PUBLISHED', lesson: { id: 6 } },
        { id: 13, title: 'Задано из раздела', status: 'PUBLISHED' },
        { id: 14, title: 'Черновик', status: 'DRAFT', lesson: { id: 6 } },
      ],
      isPending: false,
      isError: false,
    });
    renderCard();

    expect(screen.queryByText('Параграф 12, упражнения 1–5')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Домашнее задание/ })).toHaveTextContent('3 задания · 1 в черновике');
  });

  it('учитель урока использует повторно подготовку урока', async () => {
    session.role = 'TEACHER';
    useLesson.mockReturnValue({ data: lesson({ capabilities: TEACHING }), isPending: false, isError: false, error: null });
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: 'Использовать повторно' }));
    expect(screen.getByText('Перенос подготовки')).toBeInTheDocument();
  });

  it('администратору повторное использование не предлагают', () => {
    useLesson.mockReturnValue({
      data: lesson({ capabilities: ['VIEW_CARD', 'VIEW_STUDENTS', 'MANAGE_STRUCTURE'] }),
      isPending: false, isError: false, error: null,
    });
    renderCard();
    expect(screen.queryByRole('button', { name: /Использовать повторно/ })).not.toBeInTheDocument();
  });

  it('плитка ДЗ называет состояние урока, а «ДЗ не задано» на карточке больше не ставится', () => {
    useLesson.mockReturnValue({
      data: lesson({ capabilities: TEACHING, homeworkState: 'NOT_SPECIFIED' }),
      isPending: false,
      isError: false,
      error: null,
    });
    renderCard();

    expect(screen.getByRole('button', { name: /Домашнее задание/ })).toHaveTextContent('Домашнее задание пока не указано');
    expect(screen.queryByRole('button', { name: 'ДЗ не задано' })).toBeNull();
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
