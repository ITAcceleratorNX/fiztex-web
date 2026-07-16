import { ApiError, pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';
import { createUser } from './users';
import type {
  ClassMembership,
  StudentProfile,
  StudentProfileDetail,
  StudentProfileStatus,
} from '../types';

interface StudentDto {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  birthDate: string | null;
  status: StudentProfileStatus;
  createdAt: string;
  updatedAt: string;
}

interface MembershipDto {
  id: number;
  academicYearId: number;
  academicYearName: string;
  classId: number;
  className: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
}

interface StudentDetailDto extends StudentDto {
  currentMembership: MembershipDto | null;
  membershipHistory: MembershipDto[];
}

function mapStudent(dto: StudentDto): StudentProfile {
  return { ...dto };
}

function mapMembership(dto: MembershipDto): ClassMembership {
  return { ...dto };
}

export async function listStudents(params: {
  classId?: number;
  academicYearId?: number;
  status?: StudentProfileStatus;
  name?: string;
} = {}): Promise<StudentProfile[]> {
  const page = await request<Page<StudentDto>>(
    `/admin/students${pageQuery({
      classId: params.classId,
      academicYearId: params.academicYearId,
      status: params.status,
      name: params.name?.trim() || undefined,
      page: 0,
      size: 200,
    })}`,
  );
  return page.content.map(mapStudent);
}

export async function getStudent(id: number): Promise<StudentProfileDetail> {
  const dto = await request<StudentDetailDto>(`/admin/students/${id}`);
  return {
    ...mapStudent(dto),
    currentMembership: dto.currentMembership ? mapMembership(dto.currentMembership) : null,
    membershipHistory: (dto.membershipHistory ?? []).map(mapMembership),
  };
}

export async function archiveStudent(id: number): Promise<void> {
  await request<void>(`/admin/students/${id}/archive`, { method: 'POST' });
}

export async function updateStudent(
  id: number,
  input: {
    firstName?: string;
    lastName?: string;
    middleName?: string | null;
    birthDate?: string | null;
  },
): Promise<StudentProfile> {
  const dto = await request<StudentDto>(`/admin/students/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return mapStudent(dto);
}

export async function addClassMembership(
  studentId: number,
  classId: number,
  opts: { transfer?: boolean; force?: boolean } = {},
): Promise<ClassMembership> {
  const dto = await request<MembershipDto>(
    `/admin/students/${studentId}/class-memberships${pageQuery({
      transfer: opts.transfer ?? false,
      force: opts.force ?? false,
    })}`,
    { method: 'POST', body: { classId } },
  );
  return mapMembership(dto);
}

/** Create STUDENT account (provisions school profile) and optionally add to class. */
export async function createStudentWithAccount(input: {
  fullName: string;
  classId?: number | null;
}): Promise<{ profileId: number; issuedCode: string | null }> {
  const created = await createUser({
    fullName: input.fullName,
    role: 'STUDENT',
  });
  const profileId = created.schoolProfileId;
  if (profileId == null) {
    throw new Error('Сервер не вернул schoolProfileId для ученика');
  }
  if (input.classId != null) {
    try {
      await addClassMembership(profileId, input.classId);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'STUDENT_DUPLICATE_SUSPECTED') {
        await addClassMembership(profileId, input.classId, { force: true });
      } else {
        throw err;
      }
    }
  }
  return { profileId, issuedCode: created.issuedCode ?? null };
}

export function isDuplicateStudentError(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'STUDENT_DUPLICATE_SUSPECTED';
}
