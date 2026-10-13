import { pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';
import type { SchoolRecordStatus, SchoolSubject } from '../types';
import type { FormulaProfile } from '@/lib/formulaProfiles';

interface SubjectDto {
  id: number;
  name: string;
  status: SchoolRecordStatus;
  formulaProfile?: FormulaProfile;
  createdAt?: string;
  updatedAt?: string;
}

function map(dto: SubjectDto): SchoolSubject {
  return { id: dto.id, name: dto.name, status: dto.status, formulaProfile: dto.formulaProfile ?? 'GENERAL' };
}

export async function listSchoolSubjects(params: {
  status?: SchoolRecordStatus | 'ALL';
  name?: string;
} = {}): Promise<SchoolSubject[]> {
  const page = await request<Page<SubjectDto>>(
    `/admin/school-subjects${pageQuery({
      status: params.status && params.status !== 'ALL' ? params.status : undefined,
      name: params.name?.trim() || undefined,
      page: 0,
      size: 200,
    })}`,
  );
  return page.content.map(map);
}

export async function createSchoolSubject(name: string, formulaProfile?: FormulaProfile): Promise<SchoolSubject> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Укажите название предмета');
  return map(
    await request<SubjectDto>('/admin/school-subjects', {
      method: 'POST',
      body: { name: trimmed, formulaProfile },
    }),
  );
}

export async function updateSchoolSubject(id: number, name: string, formulaProfile?: FormulaProfile): Promise<SchoolSubject> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Укажите название предмета');
  return map(
    await request<SubjectDto>(`/admin/school-subjects/${id}`, {
      method: 'PATCH',
      body: { name: trimmed, formulaProfile },
    }),
  );
}

export async function archiveSchoolSubject(id: number): Promise<void> {
  await request<void>(`/admin/school-subjects/${id}/archive`, { method: 'POST' });
}
