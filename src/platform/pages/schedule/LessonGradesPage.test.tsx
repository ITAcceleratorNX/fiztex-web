import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonGradesPage } from './LessonGradesPage';

const useLesson = vi.fn();
const useLessonGradeSheet = vi.fn();
const useGradeScale = vi.fn();
const useLessonOccurrences = vi.fn();
const createGrade = vi.fn();
const updateGrade = vi.fn();
const deleteGrade = vi.fn();
const useLessonCorrections = vi.fn();
const useLessonCorrectionHistory = vi.fn();
const createCorrection = vi.fn();
const updateCorrection = vi.fn();
const completeCorrection = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useLesson: (...args: unknown[]) => useLesson(...args),
  useLessonGradeSheet: (...args: unknown[]) => useLessonGradeSheet(...args),
  useGradeScale: (...args: unknown[]) => useGradeScale(...args),
  useLessonOccurrences: (...args: unknown[]) => useLessonOccurrences(...args),
  useCreateGrade: () => ({ mutateAsync: createGrade, isPending: false }),
  useUpdateGrade: () => ({ mutateAsync: updateGrade, isPending: false }),
  useDeleteGrade: () => ({ mutateAsync: deleteGrade, isPending: false }),
  useLessonCorrections: (...args: unknown[]) => useLessonCorrections(...args),
  useLessonCorrectionHistory: (...args: unknown[]) => useLessonCorrectionHistory(...args),
  useCorrectionNextLesson: () => ({
    data: { lessonId: 7, lessonDate: '2026-10-21' },
    isSuccess: true,
  }),
  useCreateCorrection: () => ({ mutateAsync: createCorrection, isPending: false }),
  useUpdateCorrection: () => ({ mutateAsync: updateCorrection, isPending: false }),
  useCompleteCorrection: () => ({ mutateAsync: completeCorrection, isPending: false }),
}));

function correction(overrides: Record<string, unknown> = {}) {
  return {
    id: 40,
    lessonId: 6,
    studentProfileId: 2,
    status: 'REQUIRED',
    overdue: false,
    comment: 'Переписать упражнение 5',
    deadline: '2026-10-21',
    temporaryGrade: { scaleCode: '4' },
    ...overrides,
  };
}

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
    subgroupName: 'Подгруппа 1',
    room: '204',
    teacher: { fullName: 'Иванова М.В.' },
    capabilities: ['VIEW_CARD', 'VIEW_GRADES', 'EDIT_TEACHING_PART'],
    ...overrides,
  };
}

function grade(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    studentProfileId: 1,
    scaleCode: '4+',
    numericValue: 4.33,
    gradeType: null,
    authorName: 'Иванова М.В.',
    authorCapacity: 'MAIN_TEACHER',
    canEdit: true,
    ...overrides,
  };
}

function sheet(overrides: Record<string, unknown> = {}) {
  return {
    lessonId: 6,
    canManageGrades: true,
    writeState: 'ALLOWED',
    capacity: 'MAIN_TEACHER',
    maxGradesPerStudent: 3,
    students: [
      { studentProfileId: 1, fullName: 'Болатбек Дана', grades: [grade()] },
      { studentProfileId: 2, fullName: 'Абен Дарига', grades: [] },
    ],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/lesson-schedule/lessons/6/grades']}>
      <Routes>
        <Route path="/lesson-schedule/lessons/:lessonId/grades" element={<LessonGradesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LessonGradesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLesson.mockReturnValue({ data: lesson(), isPending: false, isError: false, error: null });
    useLessonGradeSheet.mockReturnValue({
      data: sheet(),
      isPending: false,
      isError: false,
      error: null,
    });
    useGradeScale.mockReturnValue({
      data: [
        { code: '4', numericValue: 4, sortOrder: 6 },
        { code: '4+', numericValue: 4.33, sortOrder: 7 },
        { code: '5', numericValue: 5, sortOrder: 9 },
      ],
    });
    useLessonOccurrences.mockReturnValue({ data: undefined, isPending: false });
    useLessonCorrections.mockReturnValue({ data: [] });
    useLessonCorrectionHistory.mockReturnValue({ data: [] });
  });

  it('оставляет ученику ровно столько свободных мест, сколько разрешил сервер', () => {
    renderPage();

    // Три места на ученика: у первого одно занято — два «+», у второго свободны все три.
    expect(screen.getAllByRole('button', { name: 'Поставить оценку' })).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Оценка 4+' })).toBeInTheDocument();
  });

  /**
   * Главная проверка экрана: права не вычисляются здесь. Лист сказал «нельзя» — и
   * пустых мест нет, сколько бы их ни разрешал лимит.
   */
  it('в режиме просмотра не предлагает ставить оценки и называет причину', () => {
    useLessonGradeSheet.mockReturnValue({
      data: sheet({ canManageGrades: false, writeState: 'NOT_TEACHING', capacity: null }),
      isPending: false,
      isError: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText('Оценки этого урока доступны только для просмотра')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Поставить оценку' })).not.toBeInTheDocument();
  });

  /** §5: чужая оценка замещающему не принадлежит — нажать на неё нельзя. */
  it('не открывает выбор для оценки, которую нельзя менять', () => {
    useLessonGradeSheet.mockReturnValue({
      data: sheet({
        capacity: 'SUBSTITUTE_TEACHER',
        students: [
          { studentProfileId: 1, fullName: 'Болатбек Дана', grades: [grade({ canEdit: false })] },
        ],
      }),
      isPending: false,
      isError: false,
      error: null,
    });

    renderPage();

    expect(screen.getByRole('button', { name: 'Оценка 4+' })).toBeDisabled();
  });

  it('создаёт оценку выбранным значением шкалы', async () => {
    const user = userEvent.setup();
    createGrade.mockResolvedValue({ id: 12 });
    renderPage();

    await user.click(screen.getAllByRole('button', { name: 'Поставить оценку' })[0]);
    await user.click(screen.getByRole('button', { name: '5' }));

    expect(createGrade).toHaveBeenCalledWith({
      studentProfileId: 1,
      scaleCode: '5',
      gradeType: null,
    });
  });

  it('отменённый урок показывает запрет вместо мест под оценки', () => {
    useLesson.mockReturnValue({
      data: lesson({ status: 'CANCELLED' }),
      isPending: false,
      isError: false,
      error: null,
    });
    useLessonGradeSheet.mockReturnValue({
      data: sheet({ canManageGrades: false, writeState: 'LESSON_CANCELLED' }),
      isPending: false,
      isError: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText('Урок отменён — оценки по нему не выставляются')).toBeInTheDocument();
  });

  describe('исправление работы', () => {
    it('флажок у ученика без оценки открывает форму, без комментария сохранить нельзя', async () => {
      const user = userEvent.setup();
      createCorrection.mockResolvedValue({ id: 41 });
      renderPage();

      // У оценённого ученика флажок неактивен — исправлять нечего.
      const flags = screen.getAllByRole('button', { name: 'Отметить исправление' });
      expect(flags[0]).toBeDisabled();
      await user.click(flags[1]);

      const save = screen.getByRole('button', { name: 'Сохранить' });
      await user.click(screen.getByRole('button', { name: 'До следующего урока' }));
      expect(save).toBeDisabled();

      await user.type(screen.getByPlaceholderText('Что нужно исправить'), 'Исправить задачу 3');
      await user.click(screen.getByRole('button', { name: '+ Добавить временную оценку' }));
      await user.click(screen.getByRole('button', { name: '4', pressed: false }));
      await user.click(save);

      expect(createCorrection).toHaveBeenCalledWith({
        studentProfileId: 2,
        comment: 'Исправить задачу 3',
        deadline: '2026-10-21',
        temporaryGrade: { scaleCode: '4' },
      });
    });

    it('активное исправление: бейдж со сроком и временная оценка пунктиром, итоговая закрывает', async () => {
      const user = userEvent.setup();
      useLessonCorrections.mockReturnValue({ data: [correction()] });
      completeCorrection.mockResolvedValue({ id: 40, status: 'COMPLETED' });
      renderPage();

      expect(screen.getByText('Требуется исправление · до 21 окт')).toBeInTheDocument();
      // Временная — не обычная оценка: у неё своя кнопка, а не «Оценка 4».
      await user.click(screen.getByRole('button', { name: 'Временная оценка 4' }));
      await user.click(screen.getByRole('button', { name: '5' }));

      expect(completeCorrection).toHaveBeenCalledWith({
        correctionId: 40,
        scaleCode: '5',
        gradeType: null,
      });
    });

    it('правка активного отправляет только изменённое', async () => {
      const user = userEvent.setup();
      useLessonCorrections.mockReturnValue({ data: [correction()] });
      updateCorrection.mockResolvedValue({ id: 40 });
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Открыть исправление' }));
      const comment = screen.getByPlaceholderText('Что нужно исправить');
      expect(comment).toHaveValue('Переписать упражнение 5');
      await user.clear(comment);
      await user.type(comment, 'Переписать упражнения 5 и 6');
      await user.click(screen.getByRole('button', { name: 'Сохранить' }));

      expect(updateCorrection).toHaveBeenCalledWith({
        correctionId: 40,
        comment: 'Переписать упражнения 5 и 6',
      });
    });

    it('просроченное: «Срок истёк», продление новым сроком', async () => {
      const user = userEvent.setup();
      useLessonCorrections.mockReturnValue({ data: [correction({ status: 'OVERDUE', overdue: true })] });
      updateCorrection.mockResolvedValue({ id: 40 });
      renderPage();

      expect(screen.getByText('Срок истёк · было до 21 окт')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Срок исправления истёк' }));
      expect(screen.getByText('21 октября')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Продлить срок' }));
      await user.click(screen.getByRole('button', { name: 'До следующего урока' }));
      await user.click(screen.getByRole('button', { name: 'Сохранить' }));

      expect(updateCorrection).toHaveBeenCalledWith({ correctionId: 40, deadline: '2026-10-21' });
    });

    it('история показывает события сервера, включая «Срок истёк» от системы', () => {
      useLessonCorrectionHistory.mockReturnValue({
        data: [
          {
            id: 1,
            correctionId: 40,
            studentName: 'Абен Дарига',
            action: 'CREATED',
            actorName: 'Иванова М.В.',
            after: { comment: 'Переписать упражнение 5', deadline: '2026-10-21', temporaryScaleCode: '4' },
            createdAt: '2026-10-14T04:12:00Z',
          },
          {
            correctionId: 40,
            studentName: 'Абен Дарига',
            action: 'EXPIRED',
            after: { deadline: '2026-10-21' },
            createdAt: '2026-10-21T19:00:00Z',
          },
          {
            id: 2,
            correctionId: 40,
            studentName: 'Абен Дарига',
            action: 'COMPLETED',
            actorName: 'Иванова М.В.',
            after: { finalGradeValue: '5' },
            createdAt: '2026-10-27T06:00:00Z',
          },
        ],
      });
      renderPage();

      expect(screen.getByText('История изменений (3)')).toBeInTheDocument();
      expect(
        screen.getByText(/Отмечено исправление: «Переписать упражнение 5», срок до 21 окт; временная оценка: 4/),
      ).toBeInTheDocument();
      expect(screen.getByText('Система')).toBeInTheDocument();
      expect(screen.getByText(/Выставлена итоговая оценка: 5, исправление завершено/)).toBeInTheDocument();
    });
  });
});
