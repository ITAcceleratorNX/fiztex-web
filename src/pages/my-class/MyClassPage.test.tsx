import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { MyClassPage } from './MyClassPage';

const useMyClassContext = vi.fn();
const useMyClassRoster = vi.fn();
const useMyClassSummary = vi.fn();
const useMyClassSubjects = vi.fn();
const useMyClassSubjectJournal = vi.fn();
const useMyClassAttendanceJournal = vi.fn();
const useMyClassWeekSchedule = vi.fn();

vi.mock('@/hooks/queries', () => ({
  useMyClassContext: (...args: unknown[]) => useMyClassContext(...args),
  useMyClassRoster: (...args: unknown[]) => useMyClassRoster(...args),
  useMyClassSummary: (...args: unknown[]) => useMyClassSummary(...args),
  useMyClassSubjects: (...args: unknown[]) => useMyClassSubjects(...args),
  useMyClassSubjectJournal: (...args: unknown[]) => useMyClassSubjectJournal(...args),
  useMyClassAttendanceJournal: (...args: unknown[]) => useMyClassAttendanceJournal(...args),
  useMyClassWeekSchedule: (...args: unknown[]) => useMyClassWeekSchedule(...args),
}));

const refetch = vi.fn(() => Promise.resolve({ data: context() }));

function context() {
  return {
    state: 'READY',
    schoolDate: '2026-10-07',
    yearStartDate: '2026-08-01',
    yearEndDate: '2027-05-25',
    defaultClassId: 18,
    defaultPeriodId: 7,
    classes: [{ id: 18, name: '8А', homeroomAssignmentId: 1 }],
    periods: [{ id: 7, name: '1 четверть', type: 'QUARTER', startDate: '2026-09-01', endDate: '2026-10-27' }],
  };
}

function journal(overrides: Record<string, unknown> = {}) {
  return {
    students: [
      { studentProfileId: 10, displayName: 'Александров Дмитрий Сергеевич' },
      { studentProfileId: 11, displayName: 'Белов Арман' },
    ],
    grades: [
      { gradeId: 1, studentProfileId: 10, sourceType: 'LESSON', sourceId: 100, sourceDate: '2026-09-02', scaleCode: '9', gradeType: 'FORMATIVE' },
      { gradeId: 2, studentProfileId: 10, sourceType: 'LESSON', sourceId: 101, sourceDate: '2026-09-26', score: 15, maxScore: 20, gradeType: 'SUMMATIVE_SECTION' },
      { gradeId: 3, studentProfileId: 11, sourceType: 'LESSON', sourceId: 102, sourceDate: '2026-10-03', scaleCode: '7', gradeType: 'FORMATIVE' },
    ],
    finals: [{ finalGradeId: 5, studentProfileId: 10, value: 5 }],
    results: {
      policy: null,
      items: [
        { studentProfileId: 10, averageGrade: 8.8, scaleGradeCount: 1 },
        { studentProfileId: 11, averageGrade: null, scaleGradeCount: 0 },
      ],
    },
    ...overrides,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}

function renderPage(url = '/my-class?tab=grades') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/my-class" element={<><MyClassPage /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyClassPage — вкладка «Оценки»', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMyClassContext.mockReturnValue({ isPending: false, isError: false, data: context(), refetch });
    useMyClassRoster.mockReturnValue({ isPending: false, data: { pages: [{ totalItems: 2, items: [] }] }, refetch });
    useMyClassSummary.mockReturnValue({ isPending: false, data: { averageGrade: 8.1, monthlyAttendancePercent: 94 }, refetch });
    useMyClassSubjects.mockReturnValue({
      isPending: false,
      isError: false,
      data: { items: [
        { subjectId: 2, subjectName: 'Алгебра', gradeCount: 0 },
        { subjectId: 3, subjectName: 'Английский язык', gradeCount: 2 },
      ] },
    });
    useMyClassSubjectJournal.mockReturnValue({ isPending: false, isError: false, data: journal() });
  });

  it('shows the subject journal with summative columns, average and published final', () => {
    renderPage();

    expect(screen.getByRole('tab', { name: 'Оценки' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Расписание' })).not.toBeDisabled();
    expect(useMyClassSubjectJournal).toHaveBeenLastCalledWith(18, 7, 3);
    expect(screen.getByLabelText('Предмет')).toHaveTextContent('Английский язык');
    expect(screen.getByLabelText('Период')).toHaveTextContent('1 четверть (01.09 – 27.10)');
    expect(screen.getByRole('radio', { name: 'Месяц' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Четверть' })).toHaveAttribute('aria-checked', 'true');

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: /26\.09\s*СОР/ })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Итог за четверть' })).toBeInTheDocument();
    const first = within(table).getByRole('row', { name: /Александров Д\.С\./ });
    expect(within(first).getByRole('button', { name: 'Оценка 9' })).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Оценка 15/20' })).toBeInTheDocument();
    expect(within(first).getByText('8.8')).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Оценка 5' })).toBeInTheDocument();
    const second = within(table).getByRole('row', { name: /Белов А\./ });
    expect(within(second).getAllByText('—')).toHaveLength(4);
    expect(within(second).getByRole('button', { name: 'Оценка 7' })).toBeInTheDocument();
  });

  it('keeps the chosen subject in the address', async () => {
    renderPage();

    await userEvent.click(screen.getByLabelText('Предмет'));
    await userEvent.click(screen.getByRole('option', { name: 'Алгебра' }));

    expect(screen.getByTestId('location')).toHaveTextContent('subjectId=2');
    expect(useMyClassSubjectJournal).toHaveBeenLastCalledWith(18, 7, 2);
  });

  it('says so when the subject has no grades or finals for the period', () => {
    useMyClassSubjectJournal.mockReturnValue({
      isPending: false,
      isError: false,
      data: journal({ grades: [], finals: [] }),
    });
    renderPage();

    expect(screen.getByText('По предмету пока нет оценок за этот период')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says so when the class has no subjects for the period', () => {
    useMyClassSubjects.mockReturnValue({ isPending: false, isError: false, data: { items: [] } });
    renderPage();

    expect(screen.getByText('У класса пока нет предметов за этот период')).toBeInTheDocument();
    expect(useMyClassSubjectJournal).toHaveBeenLastCalledWith(18, 7, null);
  });

  it('offers a retry when grades fail to load', async () => {
    const retry = vi.fn();
    useMyClassSubjectJournal.mockReturnValue({ isPending: false, isError: true, error: new Error('boom'), refetch: retry });
    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить оценки.');
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(retry).toHaveBeenCalled();
  });

  it('retries the subjects and the journal with one click after both failed', async () => {
    const retrySubjects = vi.fn();
    const retryJournal = vi.fn();
    useMyClassSubjects.mockReturnValue({
      isPending: false,
      isError: true,
      error: new Error('offline'),
      data: { items: [{ subjectId: 3, subjectName: 'Английский язык', gradeCount: 2 }] },
      refetch: retrySubjects,
    });
    useMyClassSubjectJournal.mockReturnValue({ isPending: false, isError: true, error: new Error('offline'), refetch: retryJournal });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(retrySubjects).toHaveBeenCalled();
    expect(retryJournal).toHaveBeenCalled();
  });

  it('hides the class data and rereads the context after 403', async () => {
    useMyClassSubjectJournal.mockReturnValue({
      isPending: false,
      isError: true,
      error: new ApiError(403, 'Класс недоступен', 'MY_CLASS_NOT_ACCESSIBLE'),
      refetch,
    });
    renderPage();

    expect(await screen.findByText('Доступ к классу изменился. Обновите список классов.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(refetch).toHaveBeenCalled();
  });

  it('shows the policy percent instead of the average when the period has a grading policy', () => {
    useMyClassSubjectJournal.mockReturnValue({
      isPending: false,
      isError: false,
      data: journal({
        results: {
          policy: { policyId: 1, components: [{ code: 'FORMATIVE', weightPercent: 25 }] },
          items: [{ studentProfileId: 10, averageGrade: 9, scaleGradeCount: 1, result: { status: 'CALCULATED', roundedPercent: 84 } }],
        },
      }),
    });
    renderPage();

    expect(screen.getByRole('columnheader', { name: 'Итог, %' })).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Александров/ })).getByText('84%')).toBeInTheDocument();
  });

  it('opens the month of the address with its lessons, the period average and no final column', () => {
    renderPage('/my-class?tab=grades&view=month&month=2026-09');

    expect(screen.getByRole('radio', { name: 'Месяц' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Период')).toHaveTextContent('Сентябрь 2026');
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'ФИО ученика', '02.09Урок', '26.09СОР', 'Ср. баллза четверть',
    ]);
    expect(within(table).queryByText('Итог за четверть')).not.toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /Александров/ })).toHaveTextContent('8.8');
  });

  it('switches to the current school month and back to the period', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('radio', { name: 'Месяц' }));
    expect(screen.getByTestId('location')).toHaveTextContent('view=month');
    expect(screen.getByTestId('location')).toHaveTextContent('month=2026-10');
    expect(screen.getByLabelText('Период')).toHaveTextContent('Октябрь 2026');
    expect(within(screen.getByRole('table')).getByRole('columnheader', { name: /03\.10/ })).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Период'));
    await userEvent.click(screen.getByRole('option', { name: 'Сентябрь 2026' }));
    expect(screen.getByTestId('location')).toHaveTextContent('month=2026-09');
    expect(screen.getByTestId('location')).toHaveTextContent('periodId=7');

    await userEvent.click(screen.getByRole('radio', { name: 'Четверть' }));
    expect(screen.getByTestId('location')).not.toHaveTextContent('month=');
    expect(screen.getByTestId('location')).not.toHaveTextContent('view=');
    expect(screen.getByRole('columnheader', { name: 'Итог за четверть' })).toBeInTheDocument();
  });

  it('says so when the month has no grades and repairs a month outside the period', () => {
    useMyClassSubjectJournal.mockReturnValue({
      isPending: false,
      isError: false,
      data: journal({ grades: [] }),
    });
    renderPage('/my-class?tab=grades&view=month&month=2027-01');

    expect(screen.getByText('По предмету пока нет оценок за этот месяц')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('month=2026-10');
  });
});

describe('MyClassPage — вкладка «Посещаемость»', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMyClassContext.mockReturnValue({ isPending: false, isError: false, data: context(), refetch });
    useMyClassRoster.mockReturnValue({ isPending: false, data: { pages: [{ totalItems: 2, items: [] }] }, refetch });
    useMyClassSummary.mockReturnValue({ isPending: false, data: { averageGrade: 8.1, monthlyAttendancePercent: 94 }, refetch });
    useMyClassSubjects.mockReturnValue({
      isPending: false,
      isError: false,
      data: { items: [
        { subjectId: 2, subjectName: 'Алгебра', gradeCount: 0 },
        { subjectId: 3, subjectName: 'Английский язык', gradeCount: 2 },
      ] },
    });
    useMyClassAttendanceJournal.mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        lessons: [
          { lessonId: 1, date: '2026-09-02', startTime: '09:00:00', status: 'ACTIVE' },
          { lessonId: 2, date: '2026-09-05', startTime: '09:00:00', status: 'ACTIVE', subgroupId: 7, subgroupName: 'Группа 1' },
          { lessonId: 3, date: '2026-09-09', startTime: '09:00:00', status: 'CANCELLED' },
        ],
        rows: [
          { studentProfileId: 10, studentName: 'Александрова Светлана', cells: [
            { lessonId: 1, state: 'PRESENT' }, { lessonId: 2, state: 'NOT_PUBLISHED' }, { lessonId: 3, state: 'CANCELLED' },
          ] },
          { studentProfileId: 11, studentName: 'Белов Арман', cells: [
            { lessonId: 1, state: 'ABSENT' }, { lessonId: 3, state: 'CANCELLED' },
          ] },
        ],
      },
    });
  });

  it('shows the legend and a dot per lesson the student belongs to, keeping the subject from the grades tab', () => {
    renderPage('/my-class?tab=attendance&subjectId=2');

    expect(screen.getByRole('tab', { name: 'Посещаемость' })).toHaveAttribute('aria-selected', 'true');
    expect(useMyClassAttendanceJournal).toHaveBeenLastCalledWith(18, 7, 2);
    expect(screen.getByLabelText('Предмет')).toHaveTextContent('Алгебра');
    expect(screen.getByLabelText('Период')).toHaveTextContent('1 четверть (01.09 – 27.10)');
    for (const label of ['Без замечаний', 'Пропуски', 'Опоздания', 'Освобождение', 'Не опубликовано', 'Нет урока / отменён']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'ФИО ученика', '02.09Урок', '05.09Группа 1', '09.09Отменён',
    ]);
    const first = within(table).getByRole('row', { name: /Александрова С\./ });
    expect(within(first).getByText('02.09 · 09:00 — Присутствовал')).toBeInTheDocument();
    expect(within(first).getByText('05.09 · 09:00 · Группа 1 — Не опубликовано')).toBeInTheDocument();
    const second = within(table).getByRole('row', { name: /Белов А\./ });
    expect(within(second).getByText('02.09 · 09:00 — Пропустил')).toBeInTheDocument();
    expect(within(second).queryByText(/Группа 1/)).not.toBeInTheDocument();
  });

  it('says so when the subject has no lessons yet and offers a retry on failure', async () => {
    useMyClassAttendanceJournal.mockReturnValue({
      isPending: false,
      isError: false,
      data: { lessons: [], rows: [{ studentProfileId: 10, studentName: 'Белов Арман', cells: [] }] },
    });
    const { unmount } = renderPage('/my-class?tab=attendance');
    expect(screen.getByText('По предмету пока нет уроков за этот период')).toBeInTheDocument();
    unmount();

    const retry = vi.fn();
    useMyClassAttendanceJournal.mockReturnValue({ isPending: false, isError: true, error: new Error('offline'), refetch: retry });
    renderPage('/my-class?tab=attendance');
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить посещаемость.');
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(retry).toHaveBeenCalled();
  });

  it('hides the class after 403 from the attendance journal', async () => {
    useMyClassAttendanceJournal.mockReturnValue({
      isPending: false,
      isError: true,
      error: new ApiError(403, 'Класс недоступен', 'MY_CLASS_NOT_ACCESSIBLE'),
      refetch,
    });
    renderPage('/my-class?tab=attendance');

    expect(await screen.findByText('Доступ к классу изменился. Обновите список классов.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('MyClassPage — вкладка «Расписание»', () => {
  const fact = {
    lessonId: 10, date: '2026-10-07', startTime: '08:00:00', endTime: '08:45:00', lessonNumber: 1,
    status: 'ACTIVE', subjectName: 'Физика', teacherName: 'Сидоров Сергей Сергеевич', room: '101', canOpen: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useMyClassContext.mockReturnValue({ isPending: false, isError: false, data: context(), refetch });
    useMyClassRoster.mockReturnValue({ isPending: false, data: { pages: [{ totalItems: 2, items: [] }] }, refetch });
    useMyClassSummary.mockReturnValue({ isPending: false, data: { averageGrade: 8.1, monthlyAttendancePercent: 94 }, refetch });
    useMyClassWeekSchedule.mockReturnValue({
      isPending: false,
      isError: false,
      data: [{
        from: '2026-10-05', to: '2026-10-11', factState: 'FACTS_AVAILABLE_COVERAGE_UNKNOWN', planState: 'PUBLISHED',
        facts: [
          fact,
          { ...fact, lessonId: 11, date: '2026-10-08', subjectName: 'Химия', canOpen: false,
            substituteTeacherName: 'Иванова Мария Викторовна' },
        ],
      }],
    });
  });

  it('opens the school week, links only lessons the card opens and states the coverage', () => {
    renderPage('/my-class?tab=schedule');

    expect(useMyClassWeekSchedule).toHaveBeenLastCalledWith(18, '2026-10-05',
      [{ periodId: 7, from: '2026-10-05', to: '2026-10-11' }]);
    expect(screen.getByRole('group', { name: 'Неделя' })).toHaveTextContent('5 – 9 октября 2026');
    expect(screen.getByText('Показаны уроки, уже сформированные в системе. Расписание может быть неполным.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Физика/ })).toHaveAttribute('href', '/lesson-schedule/lessons/10');
    expect(screen.queryByRole('link', { name: /Химия/ })).not.toBeInTheDocument();
    expect(screen.getByText('Замена: Иванова М.В.')).toBeInTheDocument();
  });

  it('steps weeks through the address and repairs a date that is not a Monday', async () => {
    renderPage('/my-class?tab=schedule&week=2026-10-08');
    expect(screen.getByTestId('location')).toHaveTextContent('week=2026-10-05');

    await userEvent.click(screen.getByRole('button', { name: 'Следующая неделя' }));
    expect(screen.getByTestId('location')).toHaveTextContent('week=2026-10-12');
    expect(useMyClassWeekSchedule).toHaveBeenLastCalledWith(18, '2026-10-12',
      [{ periodId: 7, from: '2026-10-12', to: '2026-10-18' }]);
  });

  it('marks the plan as a plan and says when the week is outside periods or failed', async () => {
    useMyClassWeekSchedule.mockReturnValue({
      isPending: false,
      isError: false,
      data: [{ from: '2026-10-19', to: '2026-10-25', factState: 'NO_FACTS_AVAILABLE', planState: 'PUBLISHED', facts: [],
        plan: { slots: [{ scheduleLessonId: 1, weekday: 'MONDAY', lessonNumber: 1, startTime: '08:00:00', subjectName: 'Химия' }] } }],
    });
    const { unmount } = renderPage('/my-class?tab=schedule&week=2026-10-19');
    expect(screen.getByText('Уроки на эту неделю ещё не сформированы — показана плановая сетка расписания.')).toBeInTheDocument();
    expect(screen.getByText('Химия')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Химия/ })).not.toBeInTheDocument();
    unmount();

    useMyClassWeekSchedule.mockReturnValue({ isPending: false, isError: false, data: [] });
    const outside = renderPage('/my-class?tab=schedule&week=2026-11-02');
    expect(screen.getByText('Эта неделя вне учебных периодов')).toBeInTheDocument();
    outside.unmount();

    const retry = vi.fn();
    useMyClassWeekSchedule.mockReturnValue({ isPending: false, isError: true, error: new Error('offline'), refetch: retry });
    renderPage('/my-class?tab=schedule');
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить расписание.');
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(retry).toHaveBeenCalled();
  });
});
