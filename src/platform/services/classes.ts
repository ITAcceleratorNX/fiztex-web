import { nextId, store } from '../mock/store';
import type { CreateClassInput, ListClassesParams, SchoolClass } from '../types';
import { mockDelay } from './delay';

export async function listClasses(params: ListClassesParams = {}): Promise<SchoolClass[]> {
  await mockDelay();
  const yearId = params.academicYearId ?? 'ALL';
  const items = yearId === 'ALL' ? store.classes : store.classes.filter((item) => item.academicYearId === yearId);
  return items.map((item) => ({ ...item }));
}

export async function getClass(id: string): Promise<SchoolClass | null> {
  await mockDelay();
  const item = store.classes.find((row) => row.id === id);
  return item ? { ...item } : null;
}

export async function createClass(input: CreateClassInput): Promise<SchoolClass> {
  await mockDelay();
  const name = input.name.trim();
  if (!name) throw new Error('Укажите название класса');
  if (!input.academicYearId) throw new Error('Выберите учебный год');

  const year = store.years.find((item) => item.id === input.academicYearId);
  if (!year) throw new Error('Учебный год не найден');

  const duplicate = store.classes.some(
    (item) =>
      item.academicYearId === input.academicYearId &&
      item.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) throw new Error(`Класс «${name}» уже есть в ${year.name}`);

  const created: SchoolClass = {
    id: nextId('class'),
    name,
    academicYearId: year.id,
    academicYearName: year.name,
    studentCount: 0,
    status: input.status ?? 'ACTIVE',
    createdAt: new Date().toISOString(),
  };
  store.classes.unshift(created);
  return { ...created };
}
