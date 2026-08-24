import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JournalPage } from './JournalPage';

const useGradebookContext = vi.fn();
const useJournal = vi.fn();
const useClassFinals = vi.fn();
const setFinal = vi.fn();
const publishFinals = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useGradebookContext: (...args: unknown[]) => useGradebookContext(...args),
  useJournal: (...args: unknown[]) => useJournal(...args),
  useClassFinals: (...args: unknown[]) => useClassFinals(...args),
  useSetFinalGrade: () => ({ mutateAsync: setFinal, isPending: false }),
  usePublishClassFinals: () => ({ mutateAsync: publishFinals, isPending: false }),
}));

function context() {
  return {
    academicYear: { id: 5, name: '2026/2027', startDate: '2026-08-01', endDate: '2027-05-25' },
    periods: [
      {
        id: 7,
        name: '1 четверть',
        startDate: '2026-08-01',
        endDate: '2026-11-23',
        current: true,
      },
    ],
    scopes: [
      { classId: 18, className: '7 «А»', subjectId: 2, subjectName: 'Математика' },
      { classId: 18, className: '7 «А»', subjectId: 3, subjectName: 'Физика' },
    ],
  };
}

function journal() {
  return {
    classId: 18,
    subgroupId: null,
    availableSubgroups: [],
    period: { id: 7, name: '1 четверть', windowFrom: '2026-08-01', windowTo: '2026-11-23' },
    columns: [
      {
        key: 'LESSON:449',
        type: 'LESSON',
        sourceId: 449,
        date: '2026-09-09',
        lessonNumber: 1,
        active: true,
      },
      {
        key: 'LESSON:450',
        type: 'LESSON',
        sourceId: 450,
        date: '2026-09-10',
        lessonNumber: 2,
        active: false,
      },
      // Урок без оценки — та самая клетка, которая ведёт в урок.
      {
        key: 'LESSON:451',
        type: 'LESSON',
        sourceId: 451,
        date: '2026-09-11',
        lessonNumber: 3,
        active: true,
      },
    ],
    rows: [
      {
        studentProfileId: 19,
        studentName: 'Иванов Арсен',
        currentMember: true,
        average: { value: 4.33, count: 1, visibleCount: 1 },
        cells: [{ columnKey: 'LESSON:449', grades: [{ id: 1, scaleCode: '4+' }] }],
      },
    ],
  };
}

function finals(overrides: Record<string, unknown> = {}) {
  return {
    classId: 18,
    subjectId: 2,
    academicPeriodId: 7,
    academicYearId: 5,
    canManage: true,
    rows: [
      {
        studentProfileId: 19,
        studentName: 'Иванов Арсен',
        currentMember: true,
        average: 4.33,
        recommendedValue: 4,
        finalGrade: null,
        yearLocked: false,
      },
    ],
    ...overrides,
  };
}

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/grades${search}`]}>
      <Routes>
        <Route path="/grades" element={<JournalPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('JournalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGradebookContext.mockReturnValue({
      data: context(),
      isPending: false,
      isError: false,
      error: null,
    });
    useJournal.mockReturnValue({ data: journal(), isPending: false, isError: false, error: null });
    useClassFinals.mockReturnValue({
      data: finals(),
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it('открывается на текущей четверти и первой доступной паре «класс + предмет»', () => {
    renderPage();

    expect(useJournal).toHaveBeenCalledWith(
      expect.objectContaining({ classId: 18, subjectId: 2, academicPeriodId: 7 }),
    );
    expect(screen.getByRole('button', { name: 'Оценка 4+' })).toBeInTheDocument();
  });

  /** Журнал — зеркало: пустая клетка ведёт в урок, где оценку и ставят. */
  it('пустая клетка активного урока ведёт на экран оценок урока', () => {
    renderPage();

    const link = screen.getAllByRole('link').find((node) => node.textContent === '+');
    expect(link).toHaveAttribute('href', '/lesson-schedule/lessons/451/grades');
  });

  it('в режиме месяца журнал запрашивается окном дат внутри четверти', () => {
    renderPage('?window=month&month=7:2026-9');

    expect(useJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        academicPeriodId: 7,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-30',
      }),
    );
  });

  it('публикация недоступна, пока итог есть не у всех', () => {
    renderPage('?tab=finals');

    expect(screen.getByRole('button', { name: 'Опубликовать итоги четверти' })).toBeDisabled();
    expect(
      screen.getByText(/Выставьте оценку всем ученикам, чтобы опубликовать итоги четверти/),
    ).toBeInTheDocument();
  });

  it('выставляет итог выбранным значением', async () => {
    const user = userEvent.setup();
    setFinal.mockResolvedValue({ id: 3 });
    renderPage('?tab=finals');

    await user.click(screen.getByRole('button', { name: '5' }));

    expect(setFinal).toHaveBeenCalledWith({
      finalGradeId: null,
      studentProfileId: 19,
      subjectId: 2,
      academicPeriodId: 7,
      value: 5,
    });
  });

  /** §8: админ экран открывает, но выставлять не может — решает сервер, а не роль на клиенте. */
  it('без права выставления не показывает выбор оценки и кнопку публикации', () => {
    useClassFinals.mockReturnValue({
      data: finals({ canManage: false }),
      isPending: false,
      isError: false,
      error: null,
    });

    renderPage('?tab=finals');

    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Опубликовать итоги четверти' }),
    ).not.toBeInTheDocument();
  });
});
