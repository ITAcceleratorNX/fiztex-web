import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportDimension, ReportFilter } from '@/hooks/reportingQueries';
import { AdminReportingPage } from './AdminReportingPage';
import { EMPTY, metrics, NO_GRADES, ok, row } from './reportingTestData';

const summary = vi.fn();
const breakdown = vi.fn();

vi.mock('@/hooks/reportingQueries', () => ({
  useReportYears: () => ok({ content: [{ id: 1, name: '2026-2027', status: 'ACTIVE', startDate: '2026-09-01', endDate: '2027-05-31' }] }),
  useReportPeriods: () => ok([
    { id: 11, name: '1 четверть', status: 'ACTIVE', startDate: '2026-09-01', endDate: '2026-10-31' },
    { id: 12, name: '2 четверть', status: 'ACTIVE', startDate: '2026-11-10', endDate: '2026-12-28' },
  ]),
  useReportClasses: () => ok({ content: [{ id: 5, name: '8 «А»' }, { id: 6, name: '1 «А»' }] }),
  useReportSubjects: () => ok({ content: [{ id: 7, name: 'Математика' }] }),
  useReportSummary: (_owner: unknown, filter: ReportFilter | null) => summary(filter),
  useReportBreakdown: (_owner: unknown, filter: ReportFilter | null, dimension: ReportDimension | null) => breakdown(filter, dimension),
  useReportDimensionTotal: () => ok(3),
  useReportFinals: () => ok([{ finalScope: 'PERIOD', value: 5, student: { id: 31 }, subject: { id: 7 } }]),
}));

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderPage(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reporting" element={<><AdminReportingPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const location = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');

describe('AdminReportingPage', () => {
  beforeEach(() => {
    summary.mockReset().mockImplementation(() => ok({ metrics: metrics(), currentStudentCount: 48 }));
    breakdown.mockReset().mockImplementation((_filter: ReportFilter | null, dimension: ReportDimension | null) => {
      if (dimension === 'TEACHER') return ok({ rows: [row(21, 'Петров А.А.', { attributes: { subjects: [{ id: 7, name: 'Математика' }], classCount: 2 } })], total: 1 });
      if (dimension === 'CLASS') {
        return ok({ rows: [
          row(5, '8 «А»', { attributes: { homeroomTeacher: { id: 21, name: 'Петров А.А.' }, currentStudentCount: 24 } }),
          row(6, '1 «А»', { metrics: NO_GRADES, attributes: { currentStudentCount: 24 } }),
        ], total: 2 });
      }
      if (dimension === 'SUBJECT') return ok({ rows: [row(7, 'Математика', { attributes: { teachers: [{ id: 21, name: 'Петров А.А.' }] } })], total: 1 });
      return ok({ rows: [row(31, 'Белов Артём'), row(32, 'Александрова София')], total: 2 });
    });
  });

  it('shows the school by classes with the server total and explains missing values', async () => {
    renderPage('/reporting?period=11');

    expect(screen.getByText(/^Данные за/)).toHaveTextContent('Данные за 1 четверть (01.09 – 31.10) · 2026–2027 · Вся школа');
    const table = screen.getByRole('region', { name: 'Отчётность по классам' });
    const total = within(table).getByRole('rowheader', { name: /Вся школа/ }).closest('tr')!;
    expect(within(total).getByText('48')).toBeInTheDocument();
    expect(within(total).getByText('1 кл. руководитель')).toBeInTheDocument();
    expect(within(total).getByText('8,10')).toBeInTheDocument();

    const empty = within(table).getByRole('button', { name: 'Открыть класс 1 «А»' }).closest('tr')!;
    expect(within(empty).getByLabelText('Нет значения. За период оценки не выставлялись')).toBeInTheDocument();
    expect(within(empty).queryByText('0')).not.toBeInTheDocument();
    expect(within(empty).getByText('Не назначен')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Для части классов данные отсутствуют');
    // Успеваемость системой не считается — прочерк, а не ноль.
    expect(within(total).getByLabelText(/Показатель успеваемости пока не рассчитывается/)).toBeInTheDocument();
  });

  it('drills down into a class and keeps the year and period', async () => {
    const user = userEvent.setup();
    renderPage('/reporting?period=11');

    await user.click(screen.getByRole('button', { name: 'Открыть класс 8 «А»' }));

    expect(location().get('classId')).toBe('5');
    expect(location().get('period')).toBe('11');
    expect(screen.getByRole('heading', { name: '8 «А» класс' })).toBeInTheDocument();
    expect(screen.getByText(/Кл\. руководитель Петров А\.А\. · 48 учеников · 186 уроков/)).toBeInTheDocument();
    expect(breakdown).toHaveBeenCalledWith(expect.objectContaining({ classId: 5, academicPeriodId: 11 }), 'SUBJECT');

    await user.click(screen.getByRole('radio', { name: 'По ученикам' }));
    expect(location().get('view')).toBe('students');
    await user.click(screen.getByRole('button', { name: 'Открыть карточку: Белов Артём' }));
    expect(location().get('student')).toBe('31');
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByText(/ученик 2 из 2/)).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Закрыть окно' }));
    expect(location().get('student')).toBeNull();
    expect(location().get('view')).toBe('students');

    await user.click(screen.getByRole('button', { name: 'К отчётности по школе' }));
    expect(location().get('classId')).toBeNull();
    expect(location().get('period')).toBe('11');
  });

  it('shows class students by subject with the published period final', () => {
    renderPage('/reporting?period=11&classId=5&subjectId=7');

    expect(screen.getByRole('heading', { name: 'Математика · 8 «А»' })).toBeInTheDocument();
    const table = screen.getByRole('region', { name: 'Ученики по предмету' });
    const belov = within(table).getByRole('button', { name: 'Открыть карточку: Белов Артём' }).closest('tr')!;
    expect(within(belov).getByRole('button', { name: 'Оценка 5' })).toBeInTheDocument();
    // Учитель определяется классом и предметом.
    expect(screen.getByLabelText('Учитель')).toBeDisabled();
    expect(screen.getByText('Определяется классом и предметом')).toBeInTheDocument();
  });

  it('shows the empty state instead of zeros and offers the previous period', async () => {
    const user = userEvent.setup();
    summary.mockImplementation(() => ok({ metrics: EMPTY, currentStudentCount: 24 }));
    renderPage('/reporting?period=12&classId=6');

    expect(screen.getByText('Нет данных за выбранный период')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Отчётность/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Показать 1 четверть' }));
    expect(location().get('period')).toBe('11');
    await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    expect(location().get('classId')).toBeNull();
  });
});
