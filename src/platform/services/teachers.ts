import { pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';
import { createUser } from './users';
import { listSchoolSubjects as listSchoolSubjectsBase } from './schoolSubjects';
import type {
  AccountStatus,
  SchoolRecordStatus,
  SchoolSubject,
  TeacherAssignment,
  TeacherProfile,
  TeacherProfileDetail,
  TeacherTodayLesson,
} from '../types';

interface TeacherDto {
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

interface AssignmentDto {
  id: number;
  teacherProfileId: number;
  teacherName: string;
  schoolSubjectId: number;
  schoolSubjectName: string;
  classId: number;
  className: string;
  academicYearId: number;
  academicYearName: string;
  status: SchoolRecordStatus;
  createdAt: string;
  updatedAt: string;
  studentCount: number;
}

interface TeacherDetailDto extends TeacherDto {
  assignments: AssignmentDto[];
  email: string | null;
  lastLoginAt: string | null;
}

interface TeacherTodayLessonDto {
  lessonId: number;
  startTime: string;
  endTime: string;
  subjectId: number;
  subjectName: string;
  classId: number;
  className: string;
  room: string | null;
}

interface WorkingTimeDto {
  id: number;
  teacherProfileId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  type: string;
  approvalStatus: string;
  status: SchoolRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeacherWorkingTime {
  id: number;
  teacherProfileId: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  type: string;
  approvalStatus: string;
  status: SchoolRecordStatus;
}

function mapTeacher(dto: TeacherDto): TeacherProfile {
  return { ...dto };
}

function mapAssignment(dto: AssignmentDto): TeacherAssignment {
  return { ...dto };
}

function mapTodayLesson(dto: TeacherTodayLessonDto): TeacherTodayLesson {
  return { ...dto };
}

/** ACTIVE subjects for selectors (assignments / subgroups). */
export async function listActiveSchoolSubjects(): Promise<SchoolSubject[]> {
  return listSchoolSubjectsBase({ status: 'ACTIVE' });
}

export async function listTeachers(params: {
  name?: string;
  phone?: string;
} = {}): Promise<TeacherProfile[]> {
  const page = await request<Page<TeacherDto>>(
    `/admin/teachers${pageQuery({
      name: params.name?.trim() || undefined,
      phone: params.phone?.trim() || undefined,
      page: 0,
      size: 200,
    })}`,
  );
  return page.content.map(mapTeacher);
}

/** Resolves the teacher profile from an account id — the account and profile are one person. */
export async function getTeacherByAccount(accountId: number): Promise<TeacherProfileDetail> {
  const dto = await request<TeacherDetailDto>(`/admin/teachers/by-account/${accountId}`);
  return {
    ...mapTeacher(dto),
    assignments: (dto.assignments ?? []).map(mapAssignment),
    email: dto.email,
    lastLoginAt: dto.lastLoginAt,
  };
}

export async function getTeacher(id: number): Promise<TeacherProfileDetail> {
  const dto = await request<TeacherDetailDto>(`/admin/teachers/${id}`);
  return {
    ...mapTeacher(dto),
    assignments: (dto.assignments ?? []).map(mapAssignment),
    email: dto.email,
    lastLoginAt: dto.lastLoginAt,
  };
}

export async function updateTeacher(
  id: number,
  input: {
    firstName?: string;
    lastName?: string;
    middleName?: string | null;
    phone?: string;
  },
): Promise<TeacherProfile> {
  const dto = await request<TeacherDto>(`/admin/teachers/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return mapTeacher(dto);
}

export async function archiveTeacher(id: number): Promise<void> {
  await request<void>(`/admin/teachers/${id}/archive`, { method: 'POST' });
}

export async function getTeacherTodayLessons(teacherId: number): Promise<TeacherTodayLesson[]> {
  const list = await request<TeacherTodayLessonDto[]>(`/admin/teachers/${teacherId}/lessons/today`);
  return list.map(mapTodayLesson);
}

export async function createTeacherAssignment(input: {
  teacherProfileId: number;
  schoolSubjectId: number;
  classId: number;
  academicYearId: number;
}): Promise<TeacherAssignment> {
  const dto = await request<AssignmentDto>('/admin/teacher-assignments', {
    method: 'POST',
    body: input,
  });
  return mapAssignment(dto);
}

export async function archiveTeacherAssignment(id: number): Promise<void> {
  await request<void>(`/admin/teacher-assignments/${id}/archive`, { method: 'POST' });
}

export async function listTeacherWorkingTime(teacherId: number): Promise<TeacherWorkingTime[]> {
  const list = await request<WorkingTimeDto[]>(`/admin/teachers/${teacherId}/working-time`);
  return list.map((dto) => ({
    id: dto.id,
    teacherProfileId: dto.teacherProfileId,
    dayOfWeek: dto.dayOfWeek,
    startTime: dto.startTime,
    endTime: dto.endTime,
    type: dto.type,
    approvalStatus: dto.approvalStatus,
    status: dto.status,
  }));
}

export async function createTeacherWorkingTime(
  teacherId: number,
  input: { dayOfWeek: string; startTime: string; endTime: string },
): Promise<TeacherWorkingTime> {
  const dto = await request<WorkingTimeDto>(`/admin/teachers/${teacherId}/working-time`, {
    method: 'POST',
    body: input,
  });
  return {
    id: dto.id,
    teacherProfileId: dto.teacherProfileId,
    dayOfWeek: dto.dayOfWeek,
    startTime: dto.startTime,
    endTime: dto.endTime,
    type: dto.type,
    approvalStatus: dto.approvalStatus,
    status: dto.status,
  };
}

export async function archiveTeacherWorkingTime(id: number): Promise<void> {
  await request<void>(`/admin/teacher-working-time/${id}/archive`, { method: 'POST' });
}

export async function createTeacherWithAccount(input: {
  fullName: string;
  phone: string;
}): Promise<{ profileId: number; issuedCode: string | null }> {
  const created = await createUser({
    fullName: input.fullName,
    role: 'TEACHER',
    phone: input.phone,
  });
  if (created.schoolProfileId == null) {
    throw new Error('Сервер не вернул schoolProfileId для учителя');
  }
  return { profileId: created.schoolProfileId, issuedCode: created.issuedCode ?? null };
}
