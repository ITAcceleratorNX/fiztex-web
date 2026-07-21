import { ApiError, pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';
import type {
  ClassMembership,
  LinkedParent,
  ParentRelationType,
  SchoolRecordStatus,
  StudentProfile,
  StudentProfileDetail,
  StudentProfileStatus,
  AccountStatus,
} from '../types';

interface StudentDto {
  id: number;
  accountId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  birthDate: string | null;
  status: StudentProfileStatus;
  accountStatus: AccountStatus;
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

interface LinkedParentDto {
  parentProfileId: number;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string;
  relationType: ParentRelationType;
  linkStatus: SchoolRecordStatus;
}

interface StudentDetailDto extends StudentDto {
  currentMembership: MembershipDto | null;
  membershipHistory: MembershipDto[];
  linkedParents: LinkedParentDto[];
}

function mapStudent(dto: StudentDto): StudentProfile {
  return { ...dto };
}

function mapMembership(dto: MembershipDto): ClassMembership {
  return { ...dto };
}

function mapLinkedParent(dto: LinkedParentDto): LinkedParent {
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

/** Resolves the student profile from an account id — the account and profile are one person. */
export async function getStudentByAccount(accountId: number): Promise<StudentProfileDetail> {
  const dto = await request<StudentDetailDto>(`/admin/students/by-account/${accountId}`);
  return {
    ...mapStudent(dto),
    currentMembership: dto.currentMembership ? mapMembership(dto.currentMembership) : null,
    membershipHistory: (dto.membershipHistory ?? []).map(mapMembership),
    linkedParents: (dto.linkedParents ?? []).map(mapLinkedParent),
  };
}

export async function getStudent(id: number): Promise<StudentProfileDetail> {
  const dto = await request<StudentDetailDto>(`/admin/students/${id}`);
  return {
    ...mapStudent(dto),
    currentMembership: dto.currentMembership ? mapMembership(dto.currentMembership) : null,
    membershipHistory: (dto.membershipHistory ?? []).map(mapMembership),
    linkedParents: (dto.linkedParents ?? []).map(mapLinkedParent),
  };
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

export function isDuplicateStudentError(err: unknown): boolean {
  return err instanceof ApiError && err.code === 'STUDENT_DUPLICATE_SUSPECTED';
}
