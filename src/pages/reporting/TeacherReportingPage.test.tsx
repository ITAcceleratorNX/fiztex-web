import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReportDimension, ReportFilter, ReportOwner } from '@/hooks/reportingQueries';
import { idleQuery, metrics, ok, row } from './reportingTestData';
import { TeacherReportingPage } from './TeacherReportingPage';

const calls: { hook: string; owner: ReportOwner; filter: ReportFilter | null; dimension?: ReportDimension | null }[] = [];

function track(hook: string, owner: ReportOwner, filter: ReportFilter | null, dimension?: ReportDimension | null) {
  calls.push({ hook, owner, filter, dimension });
}

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ push: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock('@/hooks/reportingQueries', () => ({
  useTeacherReportContext: () => ok({
    years: [{ id: 1, name: '2026–2027', current: true }],
    academicYearId: 1,
    periods: [{ id: 2, name: '2 четверть', startDate: '2000-01-01', endDate: '2999-12-31' }],
    assignments: [
      { schoolClass: { id: 5, name: '8 «А»' }, subject: { id: 7, name: 'Математика' } },
      { schoolClass: { id: 6, name: '8 «Б»' }, subject: { id: 7, name: 'Математика' } },
      { schoolClass: { id: 5, name: '8 «А»' }, subject: { id: 8, name: 'Физика' } },
    ],
  }),
  useReportSummary: (owner: ReportOwner, filter: ReportFilter | null) => {
    track('summary', owner, filter);
    return filter ? ok({ metrics: metrics(), currentStudentCount: 25 }) : idleQuery();
  },
  useReportPerformance: (owner: ReportOwner, filter: ReportFilter | null) => {
    track('performance', owner, filter);
    return filter ? ok({ performance: { basis: 'CURRENT', preliminary: true, value: 4.2, state: 'AVAILABLE',
      studentsWithResult: 24, studentsExcluded: 0, temporarilyUnattestedCount: 0, notAttestedCount: 0 } }) : idleQuery();
  },
  useReportBreakdown: (owner: ReportOwner, filter: ReportFilter | null, dimension: ReportDimension | null) => {
    track('breakdown', owner, filter, dimension);
    if (!filter || !dimension) return idleQuery();
    return dimension === 'CLASS'
      ? ok({ rows: [row(5, '8 «А»', { attributes: { currentStudentCount: 25 } }), row(6, '8 «Б»', { attributes: { currentStudentCount: 24 } })], total: 2 })
      : ok({ rows: [row(31, 'Абаев Арман')], total: 1 });
  },
  useReportFinals: (_owner: ReportOwner, filter: ReportFilter | null) => filter
    ? ok([{ finalScope: 'PERIOD', value: null, resultKind: 'TEMPORARILY_UNATTESTED', student: { id: 31 }, subject: { id: 7 } }])
    : idleQuery(),
  useStudentRating: (owner: ReportOwner, filter: ReportFilter | null) => {
    track('rating', owner, filter);
    return idleQuery();
  },
  useClassRating: () => idleQuery(),
  useReportDynamics: (owner: ReportOwner, filter: ReportFilter | null) => {
    track('dynamics', owner, filter);
    return idleQuery();
  },
  downloadReportExcel: vi.fn(),
}));

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}

function renderPage(url = '/my-reporting') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/my-reporting" element={<><TeacherReportingPage /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Свой `Select` — кнопка со списком: варианты появляются после открытия. */
async function optionTexts(label: string): Promise<string[]> {
  await userEvent.click(screen.getByRole('button', { name: label }));
  const options = within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent ?? '');
  await userEvent.keyboard('{Escape}');
  return options;
}

beforeEach(() => {
  calls.length = 0;
});

describe('TeacherReportingPage', () => {
  it('offers only own subjects and classes and compares own classes without a class', async () => {
    renderPage();

    expect(await optionTexts('Предмет')).toEqual(['Математика', 'Физика']);
    expect(await optionTexts('Класс')).toEqual(['Все мои классы', '8 «А»', '8 «Б»']);

    expect(screen.getByRole('region', { name: 'Мои классы по предмету' })).toHaveTextContent('8 «Б»');
    // Без класса сводка и успеваемость не запрашиваются: сервер строит их по одному классу.
    expect(calls.filter((call) => call.hook === 'summary' || call.hook === 'performance').every((call) => call.filter == null)).toBe(true);
    const comparison = calls.find((call) => call.hook === 'breakdown' && call.dimension === 'CLASS' && call.filter);
    expect(comparison?.owner).toEqual({ kind: 'teacher' });
    expect(comparison?.filter).toMatchObject({ academicYearId: 1, academicPeriodId: 2, subjectId: 7, classId: null });
    expect(screen.getByRole('radio', { name: 'Динамика' })).toBeDisabled();
  });

  it('opens a class with its students and shows a temporary non-attestation as a word', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Открыть класс 8 «А»' }));

    expect(screen.getByTestId('location')).toHaveTextContent('classId=5');
    expect(screen.getByRole('region', { name: 'Ученики по предмету' })).toHaveTextContent('Абаев Арман');
    expect(screen.getByTitle('Временно не аттестован')).toHaveTextContent('ВНА');
    expect(screen.getByRole('region', { name: 'Сводная успеваемость' })).toHaveTextContent('4,20');
    expect(screen.getByRole('radio', { name: 'Динамика' })).toBeEnabled();
  });

  it('drops a class that does not belong to the chosen subject', () => {
    renderPage('/my-reporting?subjectId=8&classId=6');

    expect(screen.getByRole('button', { name: 'Класс' })).toHaveTextContent('Все мои классы');
    const comparison = calls.find((call) => call.hook === 'breakdown' && call.dimension === 'CLASS' && call.filter);
    expect(comparison?.filter).toMatchObject({ subjectId: 8, classId: null });
  });
});
