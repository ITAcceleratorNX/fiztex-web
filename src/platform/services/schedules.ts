import { pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';
import type { Weekday } from '@/lib/scheduleSettingsTypes';

export type ScheduleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ScheduleLessonTarget = 'CLASS' | 'SUBGROUP';

export interface ClassSchedule {
  id: number;
  academicYearId: number;
  academicPeriodId: number;
  classId: number;
  bellTemplateId: number;
  bellTemplateName: string;
  status: ScheduleStatus;
  copiedFromScheduleId: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ScheduleLessonWarning {
  code: string;
  message: string;
}

export interface ScheduleLesson {
  id: number;
  scheduleId: number;
  weekday: string;
  lessonPeriodId: number;
  lessonNumber: number;
  startTime: string;
  endTime: string;
  subjectId: number;
  subjectName: string;
  teacherId: number;
  teacherFullName: string;
  targetType: ScheduleLessonTarget;
  subgroupId: number | null;
  subgroupName: string | null;
  room: string | null;
  warnings?: ScheduleLessonWarning[] | null;
}

export interface ScheduleHistoryRow {
  id: number;
  actionType: string;
  payload: string;
  createdAt: string;
}

export interface LessonPeriodSlot {
  id: number;
  bellTemplateId: number;
  lessonNumber: number;
  startTime: string;
  endTime: string;
  sortOrder: number;
}

export interface ScheduleGridView {
  schedule: ClassSchedule;
  weekdays: Weekday[];
  periods: LessonPeriodSlot[];
  lessons: ScheduleLesson[];
}

export interface ConstructorContextSubgroup {
  id: number;
  name: string;
}

export interface ConstructorContextGroupSet {
  id: number;
  name: string;
  subgroups: ConstructorContextSubgroup[];
}

export interface ConstructorContextBellTemplate {
  id: number;
  name: string;
  status: string;
  periods: LessonPeriodSlot[];
}

export interface ConstructorContextView {
  periods: Array<{ id: number; name: string }>;
  classes: Array<{ id: number; name: string; grade?: number }>;
  subjects: Array<{ id: number; name: string }>;
  teachers: Array<{ id: number; fullName: string; subjectIds: number[] }>;
  weekdays: Weekday[];
  bellTemplate?: ConstructorContextBellTemplate | null;
  groupSets?: ConstructorContextGroupSet[];
}

export interface ConflictFinding {
  code: string;
  message: string;
  weekday?: Weekday | null;
  lessonNumber?: number | null;
  timeStart?: string | null;
  timeEnd?: string | null;
  lessonId?: number | null;
  scheduleId?: number | null;
  classId?: number | null;
  subgroupId?: number | null;
  teacherId?: number | null;
  subjectId?: number | null;
  room?: string | null;
  conflicting?: {
    lessonId: number;
    scheduleId: number;
    classId: number;
  } | null;
  suggestedAction?: string | null;
}

export interface ConflictCheckReport {
  scheduleId: number;
  draftRevision: number;
  checkedAt: string;
  criticals: ConflictFinding[];
  warnings: ConflictFinding[];
  summary: { criticalCount: number; warningCount: number };
}

export interface PublishScheduleBody {
  expectedRevision: number;
  confirmedWarningCodes: string[];
}

export interface CreateScheduleLessonInput {
  weekday: string;
  lessonPeriodId: number;
  subjectId: number;
  teacherId: number;
  targetType?: ScheduleLessonTarget;
  subgroupId?: number | null;
  room?: string | null;
}

export type UpdateScheduleLessonInput = Partial<CreateScheduleLessonInput>;

export async function listSchedules(params: {
  academicYearId?: number;
  academicPeriodId?: number;
  classId?: number;
  status?: ScheduleStatus;
} = {}): Promise<ClassSchedule[]> {
  const page = await request<Page<ClassSchedule>>(
    `/admin/schedules${pageQuery({
      academicYearId: params.academicYearId,
      academicPeriodId: params.academicPeriodId,
      classId: params.classId,
      status: params.status,
      page: 0,
      size: 100,
    })}`,
  );
  return page.content;
}

export async function getSchedule(id: number): Promise<ClassSchedule> {
  return request<ClassSchedule>(`/admin/schedules/${id}`);
}

export async function createSchedule(input: {
  academicYearId: number;
  academicPeriodId: number;
  classId: number;
  bellTemplateId?: number | null;
}): Promise<ClassSchedule> {
  return request<ClassSchedule>('/admin/schedules', {
    method: 'POST',
    body: input,
  });
}

export async function publishSchedule(
  id: number,
  body: PublishScheduleBody,
): Promise<ClassSchedule> {
  return request<ClassSchedule>(`/admin/schedules/${id}/publish`, {
    method: 'POST',
    body,
  });
}

export async function checkSchedule(id: number): Promise<ConflictCheckReport> {
  return request<ConflictCheckReport>(`/admin/schedules/${id}/check`, { method: 'POST' });
}

export async function getScheduleGrid(id: number): Promise<ScheduleGridView> {
  return request<ScheduleGridView>(`/admin/schedules/${id}/grid`);
}

export async function getConstructorContext(params: {
  academicYearId: number;
  classId?: number;
  academicPeriodId?: number;
}): Promise<ConstructorContextView> {
  return request<ConstructorContextView>(
    `/admin/schedules/constructor-context${pageQuery({
      academicYearId: params.academicYearId,
      classId: params.classId,
      academicPeriodId: params.academicPeriodId,
    })}`,
  );
}

export async function createDraftFromPublication(id: number): Promise<ClassSchedule> {
  return request<ClassSchedule>(`/admin/schedules/${id}/create-draft`, { method: 'POST' });
}

export async function archiveSchedule(id: number): Promise<ClassSchedule> {
  return request<ClassSchedule>(`/admin/schedules/${id}/archive`, { method: 'POST' });
}

export async function copySchedule(
  id: number,
  input: {
    targetAcademicPeriodId: number;
    targetClassId?: number;
    bellTemplateId?: number;
    overwriteExistingDraft?: boolean;
    subgroupMapping?: Record<number, number>;
  },
): Promise<{
  schedule: ClassSchedule;
  copiedLessons: number;
  warnings: ScheduleLessonWarning[];
}> {
  return request<{
    schedule: ClassSchedule;
    copiedLessons: number;
    warnings: ScheduleLessonWarning[];
  }>(`/admin/schedules/${id}/copy`, { method: 'POST', body: input });
}

export async function listScheduleLessons(scheduleId: number): Promise<ScheduleLesson[]> {
  return request<ScheduleLesson[]>(`/admin/schedules/${scheduleId}/lessons`);
}

export async function createScheduleLesson(
  scheduleId: number,
  input: CreateScheduleLessonInput,
): Promise<ScheduleLesson> {
  return request<ScheduleLesson>(`/admin/schedules/${scheduleId}/lessons`, {
    method: 'POST',
    body: input,
  });
}

export async function updateScheduleLesson(
  scheduleId: number,
  lessonId: number,
  input: UpdateScheduleLessonInput,
): Promise<ScheduleLesson> {
  return request<ScheduleLesson>(`/admin/schedules/${scheduleId}/lessons/${lessonId}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function deleteScheduleLesson(scheduleId: number, lessonId: number): Promise<void> {
  await request<void>(`/admin/schedules/${scheduleId}/lessons/${lessonId}`, {
    method: 'DELETE',
  });
}

export async function listScheduleHistory(scheduleId: number): Promise<ScheduleHistoryRow[]> {
  const page = await request<Page<ScheduleHistoryRow>>(
    `/admin/schedules/${scheduleId}/history${pageQuery({ page: 0, size: 50 })}`,
  );
  return page.content;
}
