import { nextId, store } from '../mock/store';
import type {
  AcademicYear,
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
} from '../types';
import { mockDelay } from './delay';

export async function listAcademicYears(): Promise<AcademicYear[]> {
  await mockDelay();
  return store.years.map((year) => ({ ...year }));
}

export async function getAcademicYear(id: string): Promise<AcademicYear | null> {
  await mockDelay();
  const year = store.years.find((item) => item.id === id);
  return year ? { ...year } : null;
}

export async function createAcademicYear(input: CreateAcademicYearInput): Promise<AcademicYear> {
  await mockDelay();
  const name = input.name.trim();
  if (!name) throw new Error('Укажите название учебного года');
  if (!input.startDate || !input.endDate) throw new Error('Укажите даты начала и окончания');
  if (input.endDate < input.startDate) throw new Error('Дата окончания раньше даты начала');

  const created: AcademicYear = {
    id: nextId('year'),
    name,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status ?? 'DRAFT',
    createdAt: new Date().toISOString(),
  };
  store.years.unshift(created);
  return { ...created };
}

export async function updateAcademicYear(
  id: string,
  input: UpdateAcademicYearInput,
): Promise<AcademicYear> {
  await mockDelay();
  const index = store.years.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Учебный год не найден');
  const current = store.years[index]!;
  const startDate = input.startDate ?? current.startDate;
  const endDate = input.endDate ?? current.endDate;
  if (endDate < startDate) throw new Error('Дата окончания раньше даты начала');

  const updated: AcademicYear = {
    ...current,
    name: input.name?.trim() ?? current.name,
    startDate,
    endDate,
    status: input.status ?? current.status,
  };
  store.years[index] = updated;

  // Keep class year labels in sync
  for (const schoolClass of store.classes) {
    if (schoolClass.academicYearId === id) {
      schoolClass.academicYearName = updated.name;
    }
  }

  return { ...updated };
}
