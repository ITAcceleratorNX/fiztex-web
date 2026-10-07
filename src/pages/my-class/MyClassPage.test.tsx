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

vi.mock('@/hooks/queries', () => ({
  useMyClassContext: (...args: unknown[]) => useMyClassContext(...args),
  useMyClassRoster: (...args: unknown[]) => useMyClassRoster(...args),
  useMyClassSummary: (...args: unknown[]) => useMyClassSummary(...args),
  useMyClassSubjects: (...args: unknown[]) => useMyClassSubjects(...args),
  useMyClassSubjectJournal: (...args: unknown[]) => useMyClassSubjectJournal(...args),
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
    expect(screen.getByRole('tab', { name: 'Посещаемость' })).toBeDisabled();
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
