import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportDimension, ReportFilter, ReportOwner } from '@/hooks/reportingQueries';
import { metrics, NO_GRADES, ok, row } from '../reporting/reportingTestData';
import { MyClassReportTab } from './MyClassReportTab';

const summary = vi.fn();
const breakdown = vi.fn();
const owners: ReportOwner[] = [];

vi.mock('@/hooks/reportingQueries', () => ({
  useReportSummary: (owner: ReportOwner, filter: ReportFilter | null) => {
    owners.push(owner);
    return summary(filter);
  },
  useReportBreakdown: (_owner: ReportOwner, filter: ReportFilter | null, dimension: ReportDimension | null) => breakdown(filter, dimension),
  useReportFinals: () => ok([{ finalScope: 'PERIOD', value: 4, student: { id: 31 }, subject: { id: 7 } }]),
}));

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

const onForbidden = vi.fn();

function renderTab(url = '/my-class?tab=report') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/my-class" element={(
          <>
            <MyClassReportTab
              classId={18}
              className="8А"
              academicYearId={1}
              yearName="2026/2027"
              periods={[{ id: 7, name: '1 четверть', startDate: '2026-09-01', endDate: '2026-10-27' }]}
              periodId={7}
              onSelectPeriod={() => undefined}
              onForbidden={onForbidden}
            />
            <LocationProbe />
          </>
        )} />
      </Routes>
    </MemoryRouter>,
  );
}

const location = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');

describe('MyClassReportTab', () => {
  beforeEach(() => {
    owners.length = 0;
    summary.mockReset().mockImplementation(() => ok({ metrics: metrics(), currentStudentCount: 24 }));
    breakdown.mockReset().mockImplementation((_filter: ReportFilter | null, dimension: ReportDimension | null) => {
      if (dimension === 'SUBJECT') {
        return ok({ rows: [
          row(7, 'Математика', { attributes: { teachers: [{ id: 21, name: 'Петров А.А.' }] } }),
          row(8, 'Физкультура', { metrics: NO_GRADES, attributes: { teachers: [{ id: 22, name: 'Гордеев Ф.С.' }] } }),
        ], total: 2 });
      }
      if (dimension === 'STUDENT') return ok({ rows: [row(31, 'Белов Артём'), row(32, 'Александрова София')], total: 2 });
      return ok(undefined);
    });
  });

  it('reads only its own class report and shows subjects with the class total', () => {
    renderTab();

    expect(owners.every((owner) => owner.kind === 'homeroom' && owner.classId === 18)).toBe(true);
    const table = screen.getByRole('region', { name: 'Отчётность по предметам' });
    const total = within(table).getByRole('rowheader', { name: /Весь класс/ }).closest('tr')!;
    expect(within(total).getByText('2 предмета')).toBeInTheDocument();
    expect(within(total).getByText('8,10')).toBeInTheDocument();
    const pe = within(table).getByRole('button', { name: 'Открыть предмет Физкультура' }).closest('tr')!;
    expect(within(pe).getByText('Гордеев Ф.С.')).toBeInTheDocument();
    expect(within(pe).getByLabelText('Нет значения. За период оценки не выставлялись')).toBeInTheDocument();
  });

  it('opens a subject with its students, final grades and the student card without losing filters', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('button', { name: 'Открыть предмет Математика' }));
    expect(location().get('reportSubject')).toBe('7');
    expect(screen.getByRole('heading', { name: 'Математика' })).toBeInTheDocument();
    expect(breakdown).toHaveBeenCalledWith(expect.objectContaining({ subjectId: 7, academicPeriodId: 7 }), 'STUDENT');
    const students = screen.getByRole('region', { name: 'Ученики по предмету' });
    // Строки — по алфавиту: порядок показа, не расчёт.
    const names = within(students).getAllByRole('rowheader').map((cell) => cell.textContent);
    expect(names[0]).toContain('Александрова София');
    expect(within(students).getByRole('button', { name: 'Оценка 4' })).toBeInTheDocument();

    await user.click(within(students).getByRole('button', { name: 'Открыть карточку: Белов Артём' }));
    expect(location().get('reportStudent')).toBe('31');
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByText(/ученик 2 из 2/)).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Предыдущий ученик' }));
    expect(location().get('reportStudent')).toBe('32');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Закрыть окно' }));
    expect(location().get('reportStudent')).toBeNull();
    expect(location().get('reportSubject')).toBe('7');

    await user.click(screen.getByRole('button', { name: /Ко всем предметам/ }));
    expect(location().get('reportSubject')).toBeNull();
  });

  it('switches to students with absences and lateness', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole('radio', { name: 'По ученикам' }));
    expect(location().get('reportView')).toBe('students');
    const table = screen.getByRole('region', { name: 'Отчётность по ученикам' });
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent))
      .toEqual(expect.arrayContaining(['Пропуски', 'Опоздания', 'Посещаемость']));
  });
});
