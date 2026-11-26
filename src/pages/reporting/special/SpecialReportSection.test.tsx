import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { SpecialReportSection } from './SpecialReportSection';

const report = vi.fn();
const download = vi.fn();

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ push: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('@/hooks/specialReportQueries', () => ({
  EXPORT_FORMATS: { assessment: ['XLSX', 'DOCX', 'PDF'], classPerformance: ['XLSX', 'PDF'], teacherPerformance: ['XLSX', 'PDF'] },
  useSpecialReport: (_owner: unknown, form: string, filter: unknown) => report(form, filter),
  downloadSpecialReport: (...args: unknown[]) => download(...args),
}));

const ok = (data: unknown) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });
const FILTER = { academicYearId: 1, academicPeriodId: 11, classId: 5, subjectId: 7 };

function work(overrides: Record<string, unknown> = {}) {
  return {
    workId: 70, lessonId: 900, lessonDate: '2026-10-12', kind: 'SOR', sorNumber: 1, title: 'СОР 1',
    schoolClass: { id: 5, name: '7А' }, subject: { id: 7, name: 'Алгебра' }, teacher: { id: 21, name: 'Петров А.А.' },
    demo: false, maxScore: 20, audienceCount: 3, resultCount: 2, withoutResultCount: 1, notTakenCount: 1,
    lowCount: 1, middleCount: 1, highCount: 0, qualityCount: 1, successCount: 1,
    qualityPercent: 50, successPercent: 50, state: 'OK', invalidResultCount: 0,
    students: [
      { studentProfileId: 31, name: 'Белов Артём', state: 'SCORED', score: 13, percent: 65, level: 'MIDDLE', excluded: false, inAudience: true },
      { studentProfileId: 32, name: 'Ахметова Дана', state: 'SCORED', score: 7, percent: 35, level: 'LOW', excluded: false, inAudience: true },
      { studentProfileId: 33, name: 'Ким Ли', state: 'NOT_TAKEN', excluded: false, inAudience: true },
    ],
    ...overrides,
  };
}

function analysisReport(w = work()) {
  return {
    methodologyVersion: 'SOR-SOCH-2026.1',
    thresholds: { lowMax: 39, middleMax: 84, qualityFrom: 65, successFrom: 40 },
    scope: { academicYear: { id: 1, name: '2026-2027' }, academicPeriod: { id: 11, name: '1 четверть' } },
    demo: false,
    subgroupOptions: [{ id: 81, name: 'Группа 1 · Английский' }],
    periods: [{ period: { id: 11, name: '1 четверть' }, works: [w] }],
  };
}

function renderSection(form: 'assessment' | 'classPerformance' | 'teacherPerformance', filter: unknown = FILTER,
  extra: Record<string, unknown> = {}) {
  const onSubgroup = vi.fn();
  render(<SpecialReportSection owner={{ kind: 'teacher' }} form={form} filter={filter as never}
    fileParts={['2026-2027', '1 четверть']} onSubgroup={onSubgroup} {...extra} />);
  return { onSubgroup };
}

describe('SpecialReportSection', () => {
  it('hides cached data and disables exports after access is revoked', () => {
    report.mockReturnValue({ ...ok(analysisReport()), isError: true, error: new ApiError(403, 'Forbidden') });
    renderSection('assessment');
    expect(screen.getByText('Нет доступа к этим данным.')).toBeInTheDocument();
    expect(screen.queryByText('Белов Артём')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Открыть анализ работы/ })).not.toBeInTheDocument();
    for (const name of ['Excel', 'Word', 'PDF']) expect(screen.getByRole('button', { name })).toBeDisabled();
  });

  beforeEach(() => {
    report.mockReset();
    download.mockReset().mockResolvedValue(undefined);
  });

  it('lists conducted works with server numbers and opens the work analysis', async () => {
    report.mockReturnValue(ok(analysisReport()));
    renderSection('assessment');

    const table = screen.getByRole('region', { name: /Работы СОР и СОЧ/ });
    expect(within(table).getByText('СОР 1')).toBeInTheDocument();
    expect(within(table).getAllByText('50,00 %')).toHaveLength(2);
    // Колонки «Анализ» и отметки «черновик» нет: учителю заполнять нечего.
    expect(within(table).queryByText('Анализ')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Выгрузка формы' })).toHaveTextContent(/Excel.*Word.*PDF/);

    await userEvent.click(screen.getByRole('button', { name: /Открыть анализ работы СОР 1/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Белов Артём/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Ким Ли — Не выполнял работу/)).toBeInTheDocument();
  });

  it('shows the work read-only: levels and numbers, nothing to fill in', async () => {
    report.mockReturnValue(ok(analysisReport()));
    renderSection('assessment');
    await userEvent.click(screen.getByRole('button', { name: /Открыть анализ работы СОР 1/ }));
    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('Ученики по уровням')).toBeInTheDocument();
    expect(within(dialog).queryByText('Педагогический анализ')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Сохранить/ })).not.toBeInTheDocument();
  });

  it('offers the class subgroups from the response and exports with the same filter', async () => {
    report.mockReturnValue(ok(analysisReport()));
    const { onSubgroup } = renderSection('assessment');

    await userEvent.click(screen.getByRole('button', { name: 'Подгруппа' }));
    await userEvent.click(screen.getByRole('option', { name: 'Группа 1 · Английский' }));
    expect(onSubgroup).toHaveBeenCalledWith(81);

    await userEvent.click(screen.getByRole('button', { name: 'Word' }));
    expect(download).toHaveBeenCalledWith({ kind: 'teacher' }, 'assessment', FILTER, 'DOCX', 'Анализ СОР и СОЧ 2026-2027 1 четверть');
  });

  it('marks the draft methodology and never prints a missing percentage as zero', () => {
    report.mockReturnValue(ok({
      form: 'CLASS',
      methodology: { version: 'PERF-10-2026.1-draft', approved: false, weightA: 100, weightB: 64, weightC: 36, weightD: 16, weightU: 7 },
      scope: {}, demo: false, subgroupOptions: [],
      rows: [
        { schoolClass: { id: 5, name: '7А' }, subject: { id: 7, name: 'Алгебра' }, teachers: [{ id: 21, name: 'Петров А.А.' }],
          state: 'INCOMPLETE', studentCount: 3, n: 3, a: 1, b: 1, c: 0, d: 0, u: 0, missing: 1, average: 8.5 },
        { schoolClass: { id: 6, name: '7Б' }, subject: { id: 9, name: 'Физкультура' }, teachers: [],
          state: 'PASS_FAIL', studentCount: 2, passed: 2, failed: 0, missing: 0, u: 0 },
      ],
    }));
    renderSection('classPerformance');

    expect(screen.getByText(/Проект методики \(PERF-10-2026.1-draft\)/)).toBeInTheDocument();
    const table = screen.getByRole('region', { name: 'Успеваемость класса по предмету' });
    expect(within(table).getAllByText('Недостаточно данных').length).toBeGreaterThanOrEqual(3);
    expect(within(table).getByText('8,50')).toBeInTheDocument();
    expect(within(table).getByText('Зачётный предмет')).toBeInTheDocument();
    expect(within(table).getByText('2 / 0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Word' })).not.toBeInTheDocument();
  });

  it('does not query until the required choice is made', () => {
    report.mockReturnValue(ok(undefined));
    renderSection('teacherPerformance', null, { blocked: { title: 'Выберите учителя', description: 'Строится по учителю.' } });

    expect(screen.getByText('Выберите учителя')).toBeInTheDocument();
    expect(report).toHaveBeenCalledWith('teacherPerformance', null);
  });
});
