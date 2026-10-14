import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MyClassStudentsTab } from './MyClassStudentsTab';

const useClassGradeDynamics = vi.fn();
const useStudentGradeDynamics = vi.fn();
const useStudentSubjectDynamics = vi.fn();

vi.mock('@/hooks/dynamicsQueries', () => ({
  useClassGradeDynamics: (...args: unknown[]) => useClassGradeDynamics(...args),
  useStudentGradeDynamics: (...args: unknown[]) => useStudentGradeDynamics(...args),
  useStudentSubjectDynamics: (...args: unknown[]) => useStudentSubjectDynamics(...args),
}));

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const quarter = { type: 'QUARTER', from: '2026-09-01', to: '2026-10-27', academicPeriodName: '1 четверть' };
const previous = { type: 'QUARTER', academicPeriodName: '4 четверти', academicYearName: '2025–2026' };
const avg = (value: number) => ({ state: 'AVAILABLE', mode: 'SCALE_AVERAGE', value });

function classView() {
  return {
    window: quarter,
    previousWindow: previous,
    classAverage: { current: avg(8.1), trend: 'GROWTH', change: 0.2 },
    students: [
      { studentProfileId: 1, displayName: 'Александрова София', overall: { current: avg(8.8), trend: 'GROWTH', change: 0.3 },
        changedSubjects: [{ subjectId: 10, subjectName: 'Математика', change: 0.6, trend: 'GROWTH' }] },
      { studentProfileId: 2, displayName: 'Белов Артём', overall: { current: avg(6.7), trend: 'DECLINE', change: -0.9 },
        changedSubjects: [
          { subjectId: 11, subjectName: 'Физика', change: -1.5, trend: 'DECLINE' },
          { subjectId: 12, subjectName: 'Английский язык', change: -0.8, trend: 'DECLINE' },
          { subjectId: 13, subjectName: 'Русский язык', change: -0.6, trend: 'DECLINE' },
          { subjectId: 14, subjectName: 'История', change: 0.3, trend: 'GROWTH' },
        ] },
      { studentProfileId: 3, displayName: 'Дмитриева Полина', overall: { current: avg(6.6), trend: 'INSUFFICIENT_DATA' }, changedSubjects: [] },
    ],
  };
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderTab(url = '/my-class') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/my-class" element={<><MyClassStudentsTab classId={18} className="8А" onForbidden={vi.fn()} /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const location = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');
const names = () => within(screen.getByRole('region', { name: 'Динамика учеников класса' }))
  .getAllByRole('rowheader').map((cell) => cell.textContent?.replace(/^[А-ЯA-Z]{2}/, ''));

describe('MyClassStudentsTab — динамика', () => {
  beforeEach(() => {
    useClassGradeDynamics.mockReset().mockReturnValue(ok(classView()));
    useStudentGradeDynamics.mockReset().mockReturnValue(ok({
      window: quarter,
      previousWindow: previous,
      overall: { current: avg(6.7), previous: avg(7.6), trend: 'DECLINE', change: -0.9 },
      subjects: [
        { subjectId: 11, subjectName: 'Физика', metric: { current: avg(5.9), trend: 'DECLINE', change: -1.5 } },
        { subjectId: 15, subjectName: 'Физкультура', metric: { current: { state: 'NO_DATA' }, previous: { state: 'NO_DATA' }, trend: 'INSUFFICIENT_DATA' } },
      ],
      series: [{ from: '2026-09-01', to: '2026-09-07', mode: 'SCALE_AVERAGE', value: 7.6 }, { from: '2026-09-08', to: '2026-09-14', mode: 'SCALE_AVERAGE', value: 6.7 }],
      classSeries: [{ from: '2026-09-01', to: '2026-09-07', mode: 'SCALE_AVERAGE', value: 7.8 }],
    }));
    useStudentSubjectDynamics.mockReset().mockReturnValue(ok({
      subjectName: 'Физика',
      window: quarter,
      previousWindow: previous,
      metric: { current: avg(5.9), previous: avg(7.4), trend: 'DECLINE', change: -1.5 },
      points: [
        { gradeId: 1, date: '2026-09-02', scaleCode: '7', gradeType: 'ORAL_ANSWER', cumulativeValue: 7 },
        { gradeId: 2, date: '2026-09-22', score: 14, maxScore: 20, gradeType: 'SUMMATIVE_SECTION', cumulativeValue: 7 },
        { gradeId: 3, date: '2026-10-24', score: 18, maxScore: 25, gradeType: 'SUMMATIVE_TERM', cumulativeValue: 5.9 },
      ],
    }));
  });

  it('shows the class average with its status, the comparison label and «+N»', async () => {
    const user = userEvent.setup();
    renderTab();

    expect(useClassGradeDynamics).toHaveBeenCalledWith(18, 'QUARTER');
    expect(screen.getByText(/Данные за 1 четверть \(01\.09 – 27\.10\) · сравнение к 4 четверти 2025–2026/)).toBeInTheDocument();
    expect(screen.getByText('Ср. балл 8,1')).toHaveTextContent('+0,2Рост');
    expect(screen.getByText('Нет данных для сравнения')).toBeInTheDocument();
    const more = screen.getByRole('button', { name: /Ещё 2: Русский язык, История/ });
    expect(more).toHaveTextContent('+2');
    await user.click(more);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Русский язык−0,6');
  });

  it('sorts by the server change and switches the period', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: /Изменение/ }));
    expect(location().get('dynSort')).toBe('decline');
    expect(names()).toEqual(['Белов Артём', 'Александрова София', 'Дмитриева Полина']);
    await user.click(screen.getByRole('button', { name: /Изменение/ }));
    expect(names()).toEqual(['Александрова София', 'Белов Артём', 'Дмитриева Полина']);

    await user.click(screen.getByRole('radio', { name: 'Неделя' }));
    expect(location().get('dynPeriod')).toBe('WEEK');
    expect(useClassGradeDynamics).toHaveBeenLastCalledWith(18, 'WEEK');
  });

  it('opens the student panel, then a subject, and returns with the same period', async () => {
    const user = userEvent.setup();
    renderTab('/my-class?dynPeriod=MONTH');

    await user.click(screen.getByRole('button', { name: 'Открыть динамику: Белов Артём' }));
    expect(location().get('dynStudent')).toBe('2');
    expect(useStudentGradeDynamics).toHaveBeenLastCalledWith(18, 2, 'MONTH');
    const panel = screen.getByRole('dialog');
    expect(within(panel).getByText(/ученик 2 из 3/)).toBeInTheDocument();
    expect(within(panel).getByRole('img', { name: /Динамика среднего балла/ })).toBeInTheDocument();
    expect(within(panel).getByText('Средний по классу (ориентир)')).toBeInTheDocument();
    expect(within(panel).getByText('Оценки не выставляются')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Физика' }));
    expect(location().get('dynSubject')).toBe('11');
    const subject = screen.getByRole('dialog');
    expect(within(subject).getByText('Оценки за период · 3')).toBeInTheDocument();
    expect(within(subject).getByLabelText('СОР 14 из 20, 22.09')).toBeInTheDocument();
    expect(within(subject).getByLabelText('СОЧ 18 из 25, 24.10')).toBeInTheDocument();
    expect(within(subject).getByText('Прошлый период: 7,4')).toBeInTheDocument();

    await user.click(within(subject).getByRole('button', { name: /Белов Артём · все предметы/ }));
    expect(location().get('dynSubject')).toBeNull();
    expect(location().get('dynStudent')).toBe('2');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Закрыть окно' }));
    expect(location().get('dynStudent')).toBeNull();
    expect(location().get('dynPeriod')).toBe('MONTH');
  });
});
