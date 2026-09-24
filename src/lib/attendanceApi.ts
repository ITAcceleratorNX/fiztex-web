import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type AttendanceSheet = Schema<'AttendanceSheetView'>;
export type AttendanceEntry = Schema<'AttendanceEntryView'>;
export type AttendanceMarking = Schema<'AttendanceMarkingView'>;
export type AttendanceEntryChange = Schema<'AttendanceEntryChange'>;
export type AttendanceHistoryEntry = Schema<'AttendanceHistoryView'>;

export type AttendanceStatus = NonNullable<AttendanceMarking['status']>;
export type AttendanceMark = NonNullable<AttendanceMarking['mark']>;
export type AttendanceReason = NonNullable<AttendanceMarking['reason']>;
export type AttendanceSheetState = NonNullable<AttendanceSheet['state']>;

type AttendanceHistoryPage = Schema<'PageAttendanceHistoryView'>;

export type TeacherJournal = Schema<'TeacherJournalView'>;
export type TeacherJournalLesson = Schema<'TeacherJournalLessonView'>;
export type TeacherJournalStudent = Schema<'TeacherJournalStudentView'>;
export type TeacherJournalOptions = Schema<'TeacherJournalOptionsView'>;
export type TeacherJournalScope = Schema<'TeacherJournalScopeView'>;
export type TeacherJournalYear = Schema<'TeacherJournalYearView'>;

/** Что журнал учителя принимает на вход: месяц и пара «класс + подгруппа». */
export interface TeacherJournalQuery {
  /** Месяц вида `2026-09`. */
  month: string;
  classId: number;
  /** Без подгруппы — все уроки класса, и классные, и подгрупповые. */
  subgroupId?: number | null;
}

/** Коды отказов, на которые у экрана есть свой ответ (attendance-read-contract §6). */
export const ATTENDANCE_ERRORS = {
  versionConflict: 'ATTENDANCE_VERSION_CONFLICT',
  sheetConflict: 'ATTENDANCE_SHEET_CONFLICT',
  incomplete: 'ATTENDANCE_INCOMPLETE',
  bulkOverwrite: 'ATTENDANCE_BULK_OVERWRITE_CONFIRM_REQUIRED',
  noParticipants: 'ATTENDANCE_NO_PARTICIPANTS',
  notStarted: 'ATTENDANCE_LESSON_NOT_STARTED',
} as const;

/**
 * Лист посещаемости урока — админ и учителя урока.
 *
 * Правила времени и прав приходят посчитанными (`canFill`, `canPublish`, `reminder`):
 * воспроизводить «урок начался, не отменён, все отмечены» на клиенте не нужно и не
 * следует — три реализации одного правила на бэке, вебе и в мобилке разъедутся, и
 * первым это заметит пользователь с неактивной кнопкой.
 */
export const attendanceApi = {
  sheet(lessonId: number, signal?: AbortSignal): Promise<AttendanceSheet> {
    return request<AttendanceSheet>(`/lessons/${lessonId}/attendance`, { signal });
  },

  /**
   * Сохранить черновик. Уходят только изменённые ученики: полный лист на каждое
   * нажатие означал бы, что двое за одним уроком затирают правки друг друга.
   *
   * `expectedVersion = null` значит «я видел, что листа нет»; расхождение версий —
   * 409 `ATTENDANCE_VERSION_CONFLICT`, и чужие правки при этом остаются на месте.
   */
  saveDraft(
    lessonId: number,
    body: { entries: AttendanceEntryChange[]; expectedVersion: number | null },
  ): Promise<AttendanceSheet> {
    return request<AttendanceSheet>(`/lessons/${lessonId}/attendance/entries`, {
      method: 'PATCH',
      body,
    });
  },

  /**
   * «Все присутствуют». Нужно ли подтверждение, решает бэкенд — он же считает, что
   * именно будет затёрто: первый заход идёт без флага, и только 409
   * `ATTENDANCE_BULK_OVERWRITE_CONFIRM_REQUIRED` с `details.affectedCount` поднимает диалог.
   */
  markAllPresent(
    lessonId: number,
    body: { expectedVersion: number | null; confirmOverwrite: boolean },
  ): Promise<AttendanceSheet> {
    return request<AttendanceSheet>(`/lessons/${lessonId}/attendance/mark-all-present`, {
      method: 'POST',
      body,
    });
  },

  /**
   * Опубликовать — сделать отметки видимыми ученику и родителю. Частичной публикации
   * не бывает: неполный лист отвечает 409 `ATTENDANCE_INCOMPLETE` со списком
   * `details.unmarkedStudentProfileIds`, чтобы клиенту было что подсветить.
   */
  publish(lessonId: number, body: { expectedVersion: number | null }): Promise<AttendanceSheet> {
    return request<AttendanceSheet>(`/lessons/${lessonId}/attendance/publish`, {
      method: 'POST',
      body,
    });
  },

  history(
    lessonId: number,
    params: { page?: number; size?: number } = {},
    signal?: AbortSignal,
  ): Promise<AttendanceHistoryPage> {
    return request<AttendanceHistoryPage>(
      `/lessons/${lessonId}/attendance/history${pageQuery({ ...params })}`,
      { signal },
    );
  },

  /**
   * Журнал учителя за месяц: уроки с опубликованными отметками и итоги по всему составу
   * (ATTENDANCE-TEACHER-001). Отменённые уроки приходят со `status: CANCELLED` и без
   * отметок — таблице нужно отличать отмену от дня без урока.
   */
  teacherJournal(query: TeacherJournalQuery, signal?: AbortSignal): Promise<TeacherJournal> {
    return request<TeacherJournal>(
      `/attendance/teacher-journal${pageQuery({
        month: query.month,
        classId: query.classId,
        subgroupId: query.subgroupId ?? undefined,
      })}`,
      { signal },
    );
  },

  /**
   * Чем заполнить фильтры журнала: учебный год (из него — месяцы) и пары «класс +
   * подгруппа», в которых у учителя есть уроки. Считаются тем же правилом видимости,
   * что и сам журнал, — пары, по которой журнал ответит «чужое», в списке не бывает.
   */
  teacherJournalOptions(signal?: AbortSignal): Promise<TeacherJournalOptions> {
    return request<TeacherJournalOptions>('/attendance/teacher-journal/options', { signal });
  },

};

/** `details.unmarkedStudentProfileIds` из отказа публикации — читается защитно. */
export function unmarkedIdsFrom(details: unknown): number[] {
  if (!details || typeof details !== 'object') return [];
  const raw = (details as { unmarkedStudentProfileIds?: unknown }).unmarkedStudentProfileIds;
  return Array.isArray(raw) ? raw.filter((id): id is number => typeof id === 'number') : [];
}

/** `details.affectedCount` — сколько индивидуальных отметок затрёт «Все присутствуют». */
export function affectedCountFrom(details: unknown): number {
  if (!details || typeof details !== 'object') return 0;
  const raw = (details as { affectedCount?: unknown }).affectedCount;
  return typeof raw === 'number' ? raw : 0;
}
