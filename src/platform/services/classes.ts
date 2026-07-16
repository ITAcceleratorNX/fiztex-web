import { pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';
import type { CreateClassInput, ListClassesParams, SchoolClass, SchoolRecordStatus } from '../types';
import { listAcademicYears } from './academicYears';

interface SchoolClassDto {
  id: number;
  academicYearId: number;
  name: string;
  grade: string;
  letter: string;
  status: SchoolRecordStatus;
  createdAt: string;
  updatedAt?: string;
}

function mapClass(dto: SchoolClassDto, yearName = ''): SchoolClass {
  return {
    id: String(dto.id),
    name: dto.name,
    academicYearId: String(dto.academicYearId),
    academicYearName: yearName,
    studentCount: 0,
    status: dto.status,
    createdAt: dto.createdAt,
  };
}

export async function listClasses(params: ListClassesParams = {}): Promise<SchoolClass[]> {
  const yearId = params.academicYearId ?? 'ALL';
  const years = await listAcademicYears();
  const yearNameById = new Map(years.map((y) => [y.id, y.name]));

  const page = await request<Page<SchoolClassDto>>(
    `/admin/classes${pageQuery({
      academicYearId: yearId === 'ALL' ? undefined : Number(yearId),
      page: 0,
      size: 200,
    })}`,
  );

  return page.content.map((dto) =>
    mapClass(dto, yearNameById.get(String(dto.academicYearId)) ?? ''),
  );
}

export async function getClass(id: string): Promise<SchoolClass | null> {
  try {
    const dto = await request<SchoolClassDto>(`/admin/classes/${id}`);
    const years = await listAcademicYears();
    const yearName = years.find((y) => y.id === String(dto.academicYearId))?.name ?? '';
    return mapClass(dto, yearName);
  } catch {
    return null;
  }
}

export async function createClass(input: CreateClassInput): Promise<SchoolClass> {
  const name = input.name.trim();
  if (!name) throw new Error('Укажите название класса');
  if (!input.academicYearId) throw new Error('Выберите учебный год');

  const grade = input.grade?.trim();
  const letter = input.letter?.trim();
  if (!grade || !letter) {
    throw new Error('Укажите параллель (grade) и букву класса');
  }

  const dto = await request<SchoolClassDto>('/admin/classes', {
    method: 'POST',
    body: {
      academicYearId: Number(input.academicYearId),
      name,
      grade,
      letter,
    },
  });

  const years = await listAcademicYears();
  const yearName = years.find((y) => y.id === String(dto.academicYearId))?.name ?? '';
  return mapClass(dto, yearName);
}
