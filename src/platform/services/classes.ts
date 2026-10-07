import { ApiError, pageQuery, request } from '@/lib/api';
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
  /** Активные ученики класса; на ответах создания класса всегда 0. */
  studentCount?: number;
}

function mapClass(dto: SchoolClassDto, yearName = ''): SchoolClass {
  return {
    id: String(dto.id),
    name: dto.name,
    academicYearId: String(dto.academicYearId),
    academicYearName: yearName,
    studentCount: dto.studentCount ?? 0,
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
      status: params.status,
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
    return mapClass(dto);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function createClass(input: CreateClassInput): Promise<SchoolClass> {
  const name = input.name.trim();
  if (!name) throw new Error('Укажите название класса');
  if (!input.academicYearId) throw new Error('Выберите учебный год');

  const grade = input.grade?.trim();
  const letter = input.letter?.trim();
  if (!grade || !letter) {
    throw new Error('Укажите параллель и букву класса');
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

  return mapClass(dto);
}

export async function updateClass(
  id: string,
  input: { name?: string; grade?: string; letter?: string },
): Promise<SchoolClass> {
  const dto = await request<SchoolClassDto>(`/admin/classes/${id}`, {
    method: 'PATCH',
    body: {
      name: input.name?.trim() || null,
      grade: input.grade?.trim() || null,
      letter: input.letter?.trim() || null,
    },
  });
  return mapClass(dto);
}

export async function archiveClass(id: string): Promise<void> {
  await request<void>(`/admin/classes/${id}/archive`, { method: 'POST' });
}
