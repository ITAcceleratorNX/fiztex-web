import type { AcademicPeriod } from '../types';

export const MOCK_PERIODS: AcademicPeriod[] = [
  {
    id: 'period-1',
    academicYearId: 'year-2026',
    name: '1 четверть',
    type: 'QUARTER',
    startDate: '2026-09-01',
    endDate: '2026-10-31',
    status: 'ACTIVE',
  },
  {
    id: 'period-2',
    academicYearId: 'year-2026',
    name: '2 четверть',
    type: 'QUARTER',
    startDate: '2026-11-09',
    endDate: '2026-12-27',
    status: 'ACTIVE',
  },
  {
    id: 'period-3',
    academicYearId: 'year-2026',
    name: '3 четверть',
    type: 'QUARTER',
    startDate: '2027-01-12',
    endDate: '2027-03-20',
    status: 'DISABLED',
  },
  {
    id: 'period-4',
    academicYearId: 'year-2026',
    name: '4 четверть',
    type: 'QUARTER',
    startDate: '2027-04-01',
    endDate: '2027-05-31',
    status: 'DISABLED',
  },
  {
    id: 'period-5',
    academicYearId: 'year-2025',
    name: '1 триместр',
    type: 'TRIMESTER',
    startDate: '2025-09-01',
    endDate: '2025-11-30',
    status: 'ARCHIVED',
  },
];
