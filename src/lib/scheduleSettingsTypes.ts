// Types mirror backend schedule-settings DTOs (feat/schedule-settings).

export type Weekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type BellTemplateStatus = 'ACTIVE' | 'HIDDEN';

export type WorkingDaysSource = 'DB' | 'DEFAULT';

export type CalendarEventType =
  | 'HOLIDAY'
  | 'VACATION'
  | 'NON_SCHOOL_DAY'
  | 'EXAM_DAY'
  | 'OTHER';

export type CalendarEventEffect = 'NO_LESSONS' | 'INFO';

export type CalendarEventScope = 'SCHOOL' | 'GRADES' | 'CLASSES';

export type CalendarEventStatus = 'ACTIVE' | 'HIDDEN';

export type CalendarTargetType = 'GRADE' | 'CLASS';

export type ScheduleSettingsEntityType = 'BELL_TEMPLATE' | 'WORKING_DAYS' | 'CALENDAR_EVENT';

export type ScheduleSettingsAction =
  | 'TEMPLATE_CREATED'
  | 'TEMPLATE_UPDATED'
  | 'TEMPLATE_HIDDEN'
  | 'TEMPLATE_ACTIVATED'
  | 'TEMPLATE_COPIED'
  | 'PERIOD_ADDED'
  | 'PERIOD_UPDATED'
  | 'PERIOD_DELETED'
  | 'BINDINGS_ASSIGNED'
  | 'BINDING_REMOVED'
  | 'WORKING_DAYS_UPDATED'
  | 'CALENDAR_EVENT_CREATED'
  | 'CALENDAR_EVENT_UPDATED'
  | 'CALENDAR_EVENT_HIDDEN'
  | 'CALENDAR_EVENT_ACTIVATED'
  | 'CALENDAR_EVENT_DELETED';

export interface LessonPeriod {
  id: number;
  bellTemplateId: number;
  lessonNumber: number;
  startTime: string;
  endTime: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BellTemplate {
  id: number;
  academicYearId: number;
  name: string;
  description: string | null;
  status: BellTemplateStatus;
  periods: LessonPeriod[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateUsage {
  bindings: number;
  draftSchedules: number;
  publishedSchedules: number;
  classNames: string[];
}

export interface TemplateBinding {
  id: number;
  bellTemplateId: number;
  classId: number;
  className: string;
  grade: string;
  letter: string;
  academicYearId: number;
  createdAt: string;
}

export interface WorkingDays {
  id: number | null;
  academicYearId: number;
  days: Weekday[];
  source: WorkingDaysSource;
  version: number | null;
}

export interface CalendarEventTarget {
  targetType: CalendarTargetType;
  grade: string | null;
  classId: number | null;
  className: string | null;
}

export interface CalendarEvent {
  id: number;
  academicYearId: number;
  dateFrom: string;
  dateTo: string;
  type: CalendarEventType;
  title: string;
  effect: CalendarEventEffect;
  scope: CalendarEventScope;
  status: CalendarEventStatus;
  targets: CalendarEventTarget[];
  createdBy: number;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsHistoryEntry {
  id: number;
  entityType: ScheduleSettingsEntityType;
  entityId: number;
  actionType: ScheduleSettingsAction;
  actorId: number;
  actorFullName: string;
  payload: string | null;
  createdAt: string;
}

export interface BoundClassConflict {
  classId: number;
  className: string;
  currentTemplateId: number;
  currentTemplateName: string;
}

/** Mirror of backend `WeekdayLessonCountView` — field is `lessonCount`, not `count`. */
export interface WeekdayLessonCount {
  weekday: Weekday;
  lessonCount: number;
}

export interface CreateBellTemplateRequest {
  academicYearId: number;
  name: string;
  description?: string | null;
}

export interface UpdateBellTemplateRequest {
  name?: string;
  description?: string | null;
  confirmImpact?: boolean;
}

export interface CopyBellTemplateRequest {
  name?: string | null;
}

export interface CreateLessonPeriodRequest {
  lessonNumber: number;
  startTime: string;
  endTime: string;
  sortOrder?: number;
  confirmImpact?: boolean;
}

export interface UpdateLessonPeriodRequest {
  lessonNumber?: number;
  startTime?: string;
  endTime?: string;
  sortOrder?: number;
  confirmImpact?: boolean;
}

export interface BindBellTemplateRequest {
  classIds?: number[];
  grades?: string[];
  replaceExisting?: boolean;
}

export interface UpdateWorkingDaysRequest {
  academicYearId: number;
  days: Weekday[];
  confirmImpact?: boolean;
  version?: number | null;
}

export interface CalendarEventTargetsRequest {
  grades?: string[];
  classIds?: number[];
}

export interface CreateCalendarEventRequest {
  academicYearId: number;
  dateFrom: string;
  dateTo: string;
  type: CalendarEventType;
  title: string;
  effect: CalendarEventEffect;
  scope: CalendarEventScope;
  targets?: CalendarEventTargetsRequest | null;
}

export interface UpdateCalendarEventRequest {
  dateFrom?: string;
  dateTo?: string;
  type?: CalendarEventType;
  title?: string;
  effect?: CalendarEventEffect;
  scope?: CalendarEventScope;
  targets?: CalendarEventTargetsRequest | null;
}

export interface CalendarEventFilters {
  type?: CalendarEventType;
  status?: CalendarEventStatus;
  dateFrom?: string;
  dateTo?: string;
  classId?: number;
  grade?: string;
  page?: number;
  size?: number;
}

/** Core year/class shapes used by schedule-settings selectors (real API). */
export type AcademicYearStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type SchoolRecordStatus = 'ACTIVE' | 'ARCHIVED';

export interface AcademicYearRef {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: AcademicYearStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolClassRef {
  id: number;
  academicYearId: number;
  name: string;
  grade: string;
  letter: string;
  status: SchoolRecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GradeClassGroup {
  grade: string;
  classes: SchoolClassRef[];
}
