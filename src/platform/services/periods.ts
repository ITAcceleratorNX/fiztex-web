import { nextId, store } from '../mock/store';
import type { AcademicPeriod, CreatePeriodInput, UpdatePeriodInput } from '../types';
import { mockDelay } from './delay';

export async function listPeriods(academicYearId?: string): Promise<AcademicPeriod[]> {
  await mockDelay();
  const items = academicYearId
    ? store.periods.filter((period) => period.academicYearId === academicYearId)
    : store.periods;
  return items.map((period) => ({ ...period }));
}

export async function createPeriod(input: CreatePeriodInput): Promise<AcademicPeriod> {
  await mockDelay();
  const name = input.name.trim();
  if (!name) throw new Error('Укажите название периода');
  if (!input.academicYearId) throw new Error('Выберите учебный год');
  if (!input.startDate || !input.endDate) throw new Error('Укажите даты начала и окончания');
  if (input.endDate < input.startDate) throw new Error('Дата окончания раньше даты начала');

  const year = store.years.find((item) => item.id === input.academicYearId);
  if (!year) throw new Error('Учебный год не найден');

  const created: AcademicPeriod = {
    id: nextId('period'),
    academicYearId: input.academicYearId,
    name,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status ?? 'ACTIVE',
  };
  store.periods.unshift(created);
  return { ...created };
}

export async function updatePeriod(id: string, input: UpdatePeriodInput): Promise<AcademicPeriod> {
  await mockDelay();
  const index = store.periods.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('Период не найден');
  const current = store.periods[index]!;
  const startDate = input.startDate ?? current.startDate;
  const endDate = input.endDate ?? current.endDate;
  if (endDate < startDate) throw new Error('Дата окончания раньше даты начала');

  const updated: AcademicPeriod = {
    ...current,
    name: input.name?.trim() ?? current.name,
    type: input.type ?? current.type,
    startDate,
    endDate,
    status: input.status ?? current.status,
  };
  store.periods[index] = updated;
  return { ...updated };
}
