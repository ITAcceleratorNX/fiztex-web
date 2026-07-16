import { pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';

export type ScheduleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

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
  targetType: 'CLASS' | 'SUBGROUP';
  subgroupId: number | null;
  subgroupName: string | null;
  room: string | null;
}

export interface ScheduleHistoryRow {
  id: number;
  actionType: string;
  payload: string;
  createdAt: string;
}

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

export async function publishSchedule(id: number): Promise<ClassSchedule> {
  return request<ClassSchedule>(`/admin/schedules/${id}/publish`, { method: 'POST' });
}

export async function archiveSchedule(id: number): Promise<ClassSchedule> {
  return request<ClassSchedule>(`/admin/schedules/${id}/archive`, { method: 'POST' });
}

export async function copySchedule(
  id: number,
  input: { targetAcademicPeriodId: number; targetClassId?: number; bellTemplateId?: number },
): Promise<{ scheduleId: number; copiedLessons: number }> {
  const res = await request<{
    schedule: ClassSchedule;
    copiedLessons: number;
  }>(`/admin/schedules/${id}/copy`, { method: 'POST', body: input });
  return { scheduleId: res.schedule.id, copiedLessons: res.copiedLessons };
}

export async function listScheduleLessons(scheduleId: number): Promise<ScheduleLesson[]> {
  return request<ScheduleLesson[]>(`/admin/schedules/${scheduleId}/lessons`);
}

export async function createScheduleLesson(
  scheduleId: number,
  input: {
    weekday: string;
    lessonPeriodId: number;
    subjectId: number;
    teacherId: number;
    targetType?: 'CLASS' | 'SUBGROUP';
    subgroupId?: number | null;
    room?: string | null;
  },
): Promise<ScheduleLesson> {
  return request<ScheduleLesson>(`/admin/schedules/${scheduleId}/lessons`, {
    method: 'POST',
    body: input,
  });
}

export async function updateScheduleLesson(
  scheduleId: number,
  lessonId: number,
  input: Partial<{
    weekday: string;
    lessonPeriodId: number;
    subjectId: number;
    teacherId: number;
    targetType: 'CLASS' | 'SUBGROUP';
    subgroupId: number | null;
    room: string | null;
  }>,
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
