import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClass, updateClass } from './classes';

const api = vi.hoisted(() => ({
  request: vi.fn(),
  listAcademicYears: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/api')>(),
  request: api.request,
}));
vi.mock('./academicYears', () => ({ listAcademicYears: api.listAcademicYears }));

const classResponse = {
  id: 7, academicYearId: 1, name: '10Қ', grade: '10', letter: 'Қ',
  status: 'ACTIVE', createdAt: '2026-10-07T09:00:00Z', studentCount: 0,
};

beforeEach(() => {
  api.request.mockReset();
  api.listAcademicYears.mockReset();
  api.request.mockResolvedValue(classResponse);
  api.listAcademicYears.mockRejectedValue(new Error('Academic years unavailable'));
});

describe('class writes', () => {
  it('reports a successful create even if the academic-year directory is unavailable', async () => {
    const created = await createClass({ academicYearId: '1', name: '10Қ', grade: '10', letter: 'Қ' });

    expect(created.id).toBe('7');
    expect(created.name).toBe('10Қ');
    expect(api.listAcademicYears).not.toHaveBeenCalled();
  });

  it('reports a successful edit even if the academic-year directory is unavailable', async () => {
    const updated = await updateClass('7', { name: '10Қ' });

    expect(updated.id).toBe('7');
    expect(api.listAcademicYears).not.toHaveBeenCalled();
  });
});
