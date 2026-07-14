import type { AcademicYear } from '../types';

export const MOCK_ACADEMIC_YEARS: AcademicYear[] = [
  {
    id: 'year-2026',
    name: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-05-31',
    status: 'ACTIVE',
    createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'year-2025',
    name: '2025/2026',
    startDate: '2025-09-01',
    endDate: '2026-05-31',
    status: 'ARCHIVED',
    createdAt: '2025-06-01T10:00:00Z',
  },
  {
    id: 'year-2027',
    name: '2027/2028',
    startDate: '2027-09-01',
    endDate: '2028-05-31',
    status: 'DRAFT',
    createdAt: '2026-07-01T10:00:00Z',
  },
];
