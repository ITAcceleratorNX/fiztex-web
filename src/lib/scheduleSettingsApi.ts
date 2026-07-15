import { ApiError, pageQuery, request } from '@/lib/api';
import type { Page } from '@/lib/types';
import type {
  BellTemplate,
  BindBellTemplateRequest,
  BoundClassConflict,
  CalendarEvent,
  CalendarEventFilters,
  CopyBellTemplateRequest,
  CreateBellTemplateRequest,
  CreateCalendarEventRequest,
  CreateLessonPeriodRequest,
  LessonPeriod,
  ScheduleSettingsEntityType,
  SettingsHistoryEntry,
  TemplateBinding,
  TemplateUsage,
  UpdateBellTemplateRequest,
  UpdateCalendarEventRequest,
  UpdateLessonPeriodRequest,
  UpdateWorkingDaysRequest,
  WeekdayLessonCount,
  WorkingDays,
} from '@/lib/scheduleSettingsTypes';

export function isTemplateInUseError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.code === 'BELL_TEMPLATE_IN_USE_DRAFTS' || error.code === 'BELL_TEMPLATE_IN_USE_PUBLISHED')
  );
}

export function isClassesAlreadyBoundError(error: unknown): error is ApiError & {
  details?: BoundClassConflict[] | unknown;
} {
  return error instanceof ApiError && error.status === 409 && error.code === 'CLASSES_ALREADY_BOUND';
}

/** Normalize CLASSES_ALREADY_BOUND details — race path may send undefined / empty list. */
export function boundConflictsFromError(error: ApiError): BoundClassConflict[] {
  return Array.isArray(error.details) ? (error.details as BoundClassConflict[]) : [];
}

export function isWorkingDaysInUseError(error: unknown): error is ApiError & {
  details: WeekdayLessonCount[];
} {
  return error instanceof ApiError && error.status === 409 && error.code === 'WORKING_DAYS_IN_USE';
}

export function isConfirmableScheduleSettingsError(error: unknown): error is ApiError {
  return isTemplateInUseError(error) || isWorkingDaysInUseError(error);
}

export const scheduleSettingsApi = {
  listBellTemplates: (academicYearId: number, signal?: AbortSignal) =>
    request<Page<BellTemplate>>(
      `/admin/bell-templates${pageQuery({ academicYearId, size: 100 })}`,
      { signal },
    ),

  getBellTemplate: (id: number, signal?: AbortSignal) =>
    request<BellTemplate>(`/admin/bell-templates/${id}`, { signal }),

  createBellTemplate: (body: CreateBellTemplateRequest) =>
    request<BellTemplate>('/admin/bell-templates', { method: 'POST', body }),

  updateBellTemplate: (id: number, body: UpdateBellTemplateRequest) =>
    request<BellTemplate>(`/admin/bell-templates/${id}`, { method: 'PATCH', body }),

  hideBellTemplate: (id: number) =>
    request<void>(`/admin/bell-templates/${id}/hide`, { method: 'POST' }),

  activateBellTemplate: (id: number) =>
    request<void>(`/admin/bell-templates/${id}/activate`, { method: 'POST' }),

  copyBellTemplate: (id: number, body?: CopyBellTemplateRequest) =>
    request<BellTemplate>(`/admin/bell-templates/${id}/copy`, {
      method: 'POST',
      body: body ?? {},
    }),

  getTemplateUsage: (id: number, signal?: AbortSignal) =>
    request<TemplateUsage>(`/admin/bell-templates/${id}/usage`, { signal }),

  addPeriod: (templateId: number, body: CreateLessonPeriodRequest) =>
    request<LessonPeriod>(`/admin/bell-templates/${templateId}/periods`, {
      method: 'POST',
      body,
    }),

  updatePeriod: (templateId: number, periodId: number, body: UpdateLessonPeriodRequest) =>
    request<LessonPeriod>(`/admin/bell-templates/${templateId}/periods/${periodId}`, {
      method: 'PATCH',
      body,
    }),

  deletePeriod: (templateId: number, periodId: number, confirmImpact = false) =>
    request<void>(
      `/admin/bell-templates/${templateId}/periods/${periodId}${pageQuery({ confirmImpact })}`,
      { method: 'DELETE' },
    ),

  listBindings: (templateId: number, signal?: AbortSignal) =>
    request<TemplateBinding[]>(`/admin/bell-templates/${templateId}/bindings`, { signal }),

  assignBindings: (templateId: number, body: BindBellTemplateRequest) =>
    request<TemplateBinding[]>(`/admin/bell-templates/${templateId}/bindings`, {
      method: 'POST',
      body,
    }),

  unassignBinding: (templateId: number, classId: number) =>
    request<void>(`/admin/bell-templates/${templateId}/bindings/${classId}`, {
      method: 'DELETE',
    }),

  getWorkingDays: (academicYearId: number, signal?: AbortSignal) =>
    request<WorkingDays>(
      `/admin/schedule-settings/working-days${pageQuery({ academicYearId })}`,
      { signal },
    ),

  updateWorkingDays: (body: UpdateWorkingDaysRequest) =>
    request<WorkingDays>('/admin/schedule-settings/working-days', { method: 'PUT', body }),

  listCalendarEvents: (
    academicYearId: number,
    filters: CalendarEventFilters = {},
    signal?: AbortSignal,
  ) =>
    request<Page<CalendarEvent>>(
      `/admin/calendar-events${pageQuery({
        academicYearId,
        type: filters.type,
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        classId: filters.classId,
        grade: filters.grade,
        page: filters.page ?? 0,
        size: filters.size ?? 50,
      })}`,
      { signal },
    ),

  getCalendarEvent: (id: number, signal?: AbortSignal) =>
    request<CalendarEvent>(`/admin/calendar-events/${id}`, { signal }),

  createCalendarEvent: (body: CreateCalendarEventRequest) =>
    request<CalendarEvent>('/admin/calendar-events', { method: 'POST', body }),

  updateCalendarEvent: (id: number, body: UpdateCalendarEventRequest) =>
    request<CalendarEvent>(`/admin/calendar-events/${id}`, { method: 'PATCH', body }),

  hideCalendarEvent: (id: number) =>
    request<CalendarEvent>(`/admin/calendar-events/${id}/hide`, { method: 'POST', body: {} }),

  activateCalendarEvent: (id: number) =>
    request<CalendarEvent>(`/admin/calendar-events/${id}/activate`, { method: 'POST', body: {} }),

  deleteCalendarEvent: (id: number) =>
    request<void>(`/admin/calendar-events/${id}`, { method: 'DELETE' }),

  listSettingsHistory: (
    entityType: ScheduleSettingsEntityType,
    entityId: number,
    page = 0,
    size = 20,
    signal?: AbortSignal,
  ) =>
    request<Page<SettingsHistoryEntry>>(
      `/admin/schedule-settings/history${pageQuery({ entityType, entityId, page, size })}`,
      { signal },
    ),
};
