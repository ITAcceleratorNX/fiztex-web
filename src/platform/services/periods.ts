import { request } from '@/lib/api';
import type {
  AcademicPeriod,
  AcademicPeriodStatus,
  CreatePeriodInput,
  UpdatePeriodInput,
} from '../types';

interface AcademicPeriodDto {
  id: number;
  academicYearId: number;
  name: string;
  type: AcademicPeriod['type'];
  startDate: string;
  endDate: string;
  status: AcademicPeriodStatus;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

function mapPeriod(dto: AcademicPeriodDto): AcademicPeriod {
  return {
    id: String(dto.id),
    academicYearId: String(dto.academicYearId),
    name: dto.name,
    type: dto.type,
    startDate: dto.startDate,
    endDate: dto.endDate,
    status: dto.status,
  };
}

export async function listPeriods(academicYearId?: string): Promise<AcademicPeriod[]> {
  if (!academicYearId) return [];
  const list = await request<AcademicPeriodDto[]>(`/admin/academic-years/${academicYearId}/periods`);
  return list.map(mapPeriod);
}

export async function createPeriod(input: CreatePeriodInput): Promise<AcademicPeriod> {
  const name = input.name.trim();
  if (!name) throw new Error('Укажите название периода');
  if (!input.academicYearId) throw new Error('Выберите учебный год');
  if (!input.startDate || !input.endDate) throw new Error('Укажите даты начала и окончания');
  if (input.endDate < input.startDate) throw new Error('Дата окончания раньше даты начала');

  const created = mapPeriod(
    await request<AcademicPeriodDto>(`/admin/academic-years/${input.academicYearId}/periods`, {
      method: 'POST',
      body: {
        name,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    }),
  );

  if (input.status === 'DISABLED') {
    await request<void>(`/admin/academic-periods/${created.id}/disable`, { method: 'POST' });
    return { ...created, status: 'DISABLED' };
  }
  if (input.status === 'ARCHIVED') {
    await request<void>(`/admin/academic-periods/${created.id}/archive`, { method: 'POST' });
    return { ...created, status: 'ARCHIVED' };
  }
  return created;
}

export async function updatePeriod(id: string, input: UpdatePeriodInput): Promise<AcademicPeriod> {
  let updated = mapPeriod(
    await request<AcademicPeriodDto>(`/admin/academic-periods/${id}`, {
      method: 'PATCH',
      body: {
        name: input.name?.trim(),
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    }),
  );

  if (input.status && input.status !== updated.status) {
    if (input.status === 'DISABLED') {
      await request<void>(`/admin/academic-periods/${id}/disable`, { method: 'POST' });
      updated = { ...updated, status: 'DISABLED' };
    } else if (input.status === 'ARCHIVED') {
      await request<void>(`/admin/academic-periods/${id}/archive`, { method: 'POST' });
      updated = { ...updated, status: 'ARCHIVED' };
    }
  }

  return updated;
}
