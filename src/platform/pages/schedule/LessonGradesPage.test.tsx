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

vi.mock('@/hooks/queries', () => ({
  useLesson: (...args: unknown[]) => useLesson(...args),
  useLessonGradeSheet: (...args: unknown[]) => useLessonGradeSheet(...args),
  useGradeScale: (...args: unknown[]) => useGradeScale(...args),
  useLessonOccurrences: (...args: unknown[]) => useLessonOccurrences(...args),
  useCreateGrade: () => ({ mutateAsync: createGrade, isPending: false }),
  useUpdateGrade: () => ({ mutateAsync: updateGrade, isPending: false }),
  useDeleteGrade: () => ({ mutateAsync: deleteGrade, isPending: false }),
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
});
