import { pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';
import type {
  AcademicYear,
  AcademicYearStatus,
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
} from '../types';

interface AcademicYearDto {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: AcademicYearStatus;
  createdAt: string;
  updatedAt?: string;
}

function mapYear(dto: AcademicYearDto): AcademicYear {
  return {
    id: String(dto.id),
    name: dto.name,
    startDate: dto.startDate,
    endDate: dto.endDate,
    status: dto.status,
    createdAt: dto.createdAt,
  };
}

export async function listAcademicYears(): Promise<AcademicYear[]> {
  const page = await request<Page<AcademicYearDto>>(
    `/admin/academic-years${pageQuery({ page: 0, size: 100 })}`,
  );
  return page.content.map(mapYear);
}

export async function getAcademicYear(id: string): Promise<AcademicYear | null> {
  try {
    const dto = await request<AcademicYearDto>(`/admin/academic-years/${id}`);
    return mapYear(dto);
  } catch {
    return null;
  }
}

export async function createAcademicYear(input: CreateAcademicYearInput): Promise<AcademicYear> {
  const name = input.name.trim();
  if (!name) throw new Error('Укажите название учебного года');
  if (!input.startDate || !input.endDate) throw new Error('Укажите даты начала и окончания');
  if (input.endDate < input.startDate) throw new Error('Дата окончания раньше даты начала');

  let created = mapYear(
    await request<AcademicYearDto>('/admin/academic-years', {
      method: 'POST',
      body: { name, startDate: input.startDate, endDate: input.endDate },
    }),
  );

  const desired = input.status ?? 'DRAFT';
  if (desired === 'ACTIVE') {
    created = mapYear(
      await request<AcademicYearDto>(`/admin/academic-years/${created.id}/activate`, {
        method: 'POST',
      }),
    );
  } else if (desired === 'ARCHIVED') {
    await request<void>(`/admin/academic-years/${created.id}/archive`, { method: 'POST' });
    created = { ...created, status: 'ARCHIVED' };
  }

  return created;
}

export async function activateAcademicYear(id: string): Promise<AcademicYear> {
  return mapYear(
    await request<AcademicYearDto>(`/admin/academic-years/${id}/activate`, { method: 'POST' }),
  );
}

export async function archiveAcademicYear(id: string): Promise<void> {
  await request<void>(`/admin/academic-years/${id}/archive`, { method: 'POST' });
}

export async function updateAcademicYear(
  id: string,
  input: UpdateAcademicYearInput,
): Promise<AcademicYear> {
  const current = await getAcademicYear(id);
  if (!current) throw new Error('Учебный год не найден');

  const startDate = input.startDate ?? current.startDate;
  const endDate = input.endDate ?? current.endDate;
  if (endDate < startDate) throw new Error('Дата окончания раньше даты начала');

  let updated = mapYear(
    await request<AcademicYearDto>(`/admin/academic-years/${id}`, {
      method: 'PATCH',
      body: {
        name: input.name?.trim() ?? current.name,
        startDate,
        endDate,
      },
    }),
  );

  const desired = input.status;
  if (desired && desired !== updated.status) {
    if (desired === 'ACTIVE') {
      updated = mapYear(
        await request<AcademicYearDto>(`/admin/academic-years/${id}/activate`, { method: 'POST' }),
      );
    } else if (desired === 'ARCHIVED') {
      await request<void>(`/admin/academic-years/${id}/archive`, { method: 'POST' });
      updated = { ...updated, status: 'ARCHIVED' };
    }
  }

  return updated;
}
