import { pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';
import type {
  LinkedStudent,
  ParentProfile,
  ParentProfileDetail,
  ParentRelationType,
  SchoolRecordStatus,
  AccountStatus,
} from '../types';

interface ParentDto {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string;
  status: SchoolRecordStatus;
  accountStatus: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

interface LinkedStudentDto {
  studentProfileId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  relationType: ParentRelationType;
  linkStatus: SchoolRecordStatus;
}

interface ParentDetailDto extends ParentDto {
  linkedStudents: LinkedStudentDto[];
}

function mapParent(dto: ParentDto): ParentProfile {
  return { ...dto };
}

function mapLinked(dto: LinkedStudentDto): LinkedStudent {
  return { ...dto };
}

export async function listParents(params: {
  name?: string;
  phone?: string;
} = {}): Promise<ParentProfile[]> {
  const page = await request<Page<ParentDto>>(
    `/admin/parents${pageQuery({
      name: params.name?.trim() || undefined,
      phone: params.phone?.trim() || undefined,
      page: 0,
      size: 200,
    })}`,
  );
  return page.content.map(mapParent);
}

/** Resolves the parent profile from an account id — the account and profile are one person. */
export async function getParentByAccount(accountId: number): Promise<ParentProfileDetail> {
  const dto = await request<ParentDetailDto>(`/admin/parents/by-account/${accountId}`);
  return {
    ...mapParent(dto),
    linkedStudents: (dto.linkedStudents ?? []).map(mapLinked),
  };
}

export async function getParent(id: number): Promise<ParentProfileDetail> {
  const dto = await request<ParentDetailDto>(`/admin/parents/${id}`);
  return {
    ...mapParent(dto),
    linkedStudents: (dto.linkedStudents ?? []).map(mapLinked),
  };
}

export async function updateParent(
  id: number,
  input: {
    firstName?: string;
    lastName?: string;
    middleName?: string | null;
    phone?: string;
  },
): Promise<ParentProfile> {
  const dto = await request<ParentDto>(`/admin/parents/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return mapParent(dto);
}

export async function linkStudent(
  parentId: number,
  studentProfileId: number,
  relationType: ParentRelationType,
): Promise<LinkedStudent> {
  const dto = await request<LinkedStudentDto>(`/admin/parents/${parentId}/link-student`, {
    method: 'POST',
    body: { studentProfileId, relationType },
  });
  return mapLinked(dto);
}

export async function unlinkStudent(parentId: number, studentProfileId: number): Promise<void> {
  await request<void>(`/admin/parents/${parentId}/unlink-student`, {
    method: 'POST',
    body: { studentProfileId },
  });
}
