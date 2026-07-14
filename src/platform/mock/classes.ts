import type { SchoolClass } from '../types';

export const MOCK_CLASSES: SchoolClass[] = [
  {
    id: 'class-7a',
    name: '7А',
    academicYearId: 'year-2026',
    academicYearName: '2026/2027',
    studentCount: 24,
    status: 'ACTIVE',
    createdAt: '2026-08-15T09:00:00Z',
  },
  {
    id: 'class-7b',
    name: '7Б',
    academicYearId: 'year-2026',
    academicYearName: '2026/2027',
    studentCount: 22,
    status: 'ACTIVE',
    createdAt: '2026-08-15T09:05:00Z',
  },
  {
    id: 'class-10a',
    name: '10А',
    academicYearId: 'year-2026',
    academicYearName: '2026/2027',
    studentCount: 18,
    status: 'ACTIVE',
    createdAt: '2026-08-15T09:10:00Z',
  },
  {
    id: 'class-11a-old',
    name: '11А',
    academicYearId: 'year-2025',
    academicYearName: '2025/2026',
    studentCount: 20,
    status: 'ARCHIVED',
    createdAt: '2025-08-15T09:00:00Z',
  },
];
