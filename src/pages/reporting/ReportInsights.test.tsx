import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ClassRating, DynamicsPoint, StudentRating } from '@/lib/reportingModel';
import { ClassRatingTable, decliningRows, DynamicsPanel, PerformanceStrip, StudentRatingTable } from './ReportInsights';

vi.mock('@/context/ToastContext', () => ({ useToast: () => ({ push: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock('@/components/dynamics/DynamicsChart', () => ({ DynamicsChart: () => <div data-testid="chart" /> }));

const rating: StudentRating = {
  basis: 'CURRENT',
  preliminary: true,
  previousPeriod: { id: 1, name: '1 четверть' },
  rankedCount: 2,
  unrankedCount: 2,
  temporarilyUnattestedCount: 1,
  notAttestedCount: 0,
  items: [
    { place: 1, student: { id: 11, name: 'Абаев Арман' }, schoolClass: { id: 5, name: '8 «А»' }, value: 4.5, change: 0.3,
      state: 'RANKED', subjectsWithResult: 2, subjectsExpected: 2, temporarilyUnattestedCount: 0, notAttestedCount: 0 },
    { place: 1, student: { id: 12, name: 'Беков Бауыржан' }, schoolClass: { id: 5, name: '8 «А»' }, value: 4.5, change: -0.5,
      state: 'RANKED', subjectsWithResult: 2, subjectsExpected: 2, temporarilyUnattestedCount: 0, notAttestedCount: 0 },
    { place: null, student: { id: 13, name: 'Вахитова Вера' }, schoolClass: { id: 5, name: '8 «А»' }, value: 5, change: -0.1,
      state: 'MISSING_SUBJECTS', subjectsWithResult: 1, subjectsExpected: 2, temporarilyUnattestedCount: 0, notAttestedCount: 0 },
    { place: null, student: { id: 14, name: 'Галиев Ғани' }, schoolClass: { id: 5, name: '8 «А»' }, value: 3, change: null,
      state: 'ATTESTATION_STATUS', subjectsWithResult: 2, subjectsExpected: 2, temporarilyUnattestedCount: 1, notAttestedCount: 0 },
  ],
};

describe('StudentRatingTable', () => {
  it('shows the full rating with shared places and no fictitious place for incomplete rows', () => {
    render(<StudentRatingTable rating={rating} pending={false} error={null} onRetry={vi.fn()} showClass={false} />);

    expect(screen.getByText('Текущая успеваемость · Предварительно')).toBeInTheDocument();
    expect(screen.getByText(/Без места: 2/)).toBeInTheDocument();
    expect(screen.getByText(/ВНА\/НА: 1 — показаны отдельно, не нулём/)).toBeInTheDocument();
    const table = screen.getByRole('region', { name: 'Рейтинг учеников' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    expect(within(rows[0]).getAllByRole('cell')[0]).toHaveTextContent('1');
    expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent('1');
    expect(within(rows[2]).getAllByRole('cell')[0]).toHaveTextContent('—');
    expect(rows[2]).toHaveTextContent('Результаты по 1 из 2 предметов');
    expect(rows[3]).toHaveTextContent('ВНА: 1');
    // Изменение без сравнения — прочерк, а не «+0,00».
    expect(within(rows[3]).getAllByRole('cell')[2]).toHaveTextContent('—');
  });

  it('lists declining students, the sharpest drop first', async () => {
    render(<StudentRatingTable rating={rating} pending={false} error={null} onRetry={vi.fn()} showClass={false} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Снижение результатов' }));

    const rows = within(screen.getByRole('region', { name: 'Рейтинг учеников' })).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Беков Бауыржан'),
      expect.stringContaining('Вахитова Вера'),
    ]);
    expect(decliningRows(rating.items ?? []).map((row) => row.student?.id)).toEqual([12, 13]);
  });
});

describe('ClassRatingTable', () => {
  const classes: ClassRating = {
    basis: 'PUBLISHED', preliminary: false, comparable: false, leaderClassId: null,
    items: [
      { place: 1, schoolClass: { id: 5, name: '8 «А»' }, value: 4.6, currentStudentCount: 25, studentsWithResult: 25,
        rankedStudentCount: 25, temporarilyUnattestedCount: 0, notAttestedCount: 0, complete: true },
      { place: 2, schoolClass: { id: 6, name: '8 «Б»' }, value: 4.2, currentStudentCount: 24, studentsWithResult: 20,
        rankedStudentCount: 19, temporarilyUnattestedCount: 1, notAttestedCount: 0, complete: false },
    ],
  };

  it('warns about an incomplete comparison and names no winner', () => {
    render(<ClassRatingTable rating={classes} pending={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByRole('note')).toHaveTextContent('Сравнение неполное');
    expect(screen.queryByText(/Лучший класс/)).not.toBeInTheDocument();
    expect(screen.getByText('20 из 24')).toBeInTheDocument();
    expect(screen.getByText('Неполные')).toBeInTheDocument();
  });

  it('names the leader only when the server did', () => {
    render(<ClassRatingTable rating={{ ...classes, comparable: true, leaderClassId: 5 }} pending={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText(/Лучший класс: 8 «А»/)).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});

describe('DynamicsPanel', () => {
  const points: DynamicsPoint[] = [
    { period: { id: 1, name: '1 четверть', startDate: '2026-09-01', endDate: '2026-10-31' }, started: true,
      performance: { basis: 'CURRENT', preliminary: false, value: 4.1, state: 'AVAILABLE' }, performanceChange: null,
      attendancePercent: { value: 96.5, state: 'AVAILABLE' }, attendanceChange: null },
    { period: { id: 2, name: '2 четверть', startDate: '2026-11-08', endDate: '2026-12-28' }, started: true,
      performance: { basis: 'CURRENT', preliminary: true, value: 4.3, state: 'AVAILABLE' }, performanceChange: 0.2,
      attendancePercent: { value: null, state: 'NO_DATA' }, attendanceChange: null },
    { period: { id: 3, name: '3 четверть', startDate: '2027-01-10', endDate: '2027-03-20' }, started: false,
      performance: { basis: 'CURRENT', preliminary: true, value: null, state: 'NO_DATA' }, performanceChange: null,
      attendancePercent: { value: null, state: 'NO_DATA' }, attendanceChange: null },
  ];

  it('compares periods and leaves missing data empty rather than zero', () => {
    render(<DynamicsPanel points={points} pending={false} error={null} onRetry={vi.fn()} />);

    const rows = within(screen.getByRole('region', { name: 'Динамика по периодам' })).getAllByRole('row').slice(1);
    expect(rows[1]).toHaveTextContent('4,30');
    expect(rows[1]).toHaveTextContent('+0,20');
    expect(rows[1]).toHaveTextContent('Предварительно');
    expect(rows[2]).toHaveTextContent('Не начался');
    expect(rows[2]).not.toHaveTextContent('0,00');
    expect(screen.getByTestId('chart')).toBeInTheDocument();
  });
});

describe('PerformanceStrip', () => {
  it('labels the basis and counts attestation statuses separately', () => {
    render(<PerformanceStrip pending={false} failed={false}
      performance={{ basis: 'PUBLISHED', preliminary: false, value: 4.42, state: 'AVAILABLE',
        studentsWithResult: 24, studentsExcluded: 1, temporarilyUnattestedCount: 1, notAttestedCount: 0 }} />);

    const region = screen.getByRole('region', { name: 'Сводная успеваемость' });
    expect(region).toHaveTextContent('4,42');
    expect(region).toHaveTextContent('Опубликованные итоги');
    expect(region).toHaveTextContent('Ещё 1 — с неполными данными или ВНА/НА');
    expect(region).toHaveTextContent('1 / 0');
  });
});
