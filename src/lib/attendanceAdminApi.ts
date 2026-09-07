import { pageQuery, request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import type { AttendanceReason, AttendanceStatus } from '@/lib/attendanceApi';

export type AdminJournal = Schema<'AdminJournalView'>;
export type AdminJournalLesson = Schema<'AdminJournalLessonView'>;
export type AdminJournalRow = Schema<'AdminJournalRowView'>;
export type AdminJournalCell = Schema<'AdminJournalCellView'>;
export type AdminJournalSummary = Schema<'AdminJournalSummaryView'>;
export type UnfilledLesson = Schema<'UnfilledLessonView'>;
type UnfilledLessonPage = Schema<'PageUnfilledLessonView'>;

export type AdminJournalFilters = {
  /** `YYYY-MM`; пусто — текущий месяц по календарю сервера. */
  month?: string | null;
  /** Обязателен: таблица «ученики × уроки» без класса не строится (контракт §23). */
  classId: number;
  subgroupId?: number | null;
  subjectId?: number | null;
  teacherProfileId?: number | null;
  studentProfileId?: number | null;
  status?: AttendanceStatus | null;
  reason?: AttendanceReason | null;
};

export type UnfilledLessonFilters = {
  month?: string | null;
  classId?: number | null;
  page?: number;
  size?: number;
};

/**
 * Журнал посещаемости школы — отдельным клиентом от `attendanceApi`.
 *
 * Граница та же, что у сервисных заявок: `attendanceApi` — это один урок, который
 * админ и учитель правят одинаково, а здесь чтение по всей школе, и состоит раздел
 * из одних `GET`. Это не самоограничение экрана: эндпоинтов, которые меняли бы
 * посещаемость мимо урока, на бэкенде нет вовсе (`AttendanceAdminController`).
 *
 * Ничего не считается на клиенте: счётчики строк и сводка приходят посчитанными и
 * по тем же клеткам, которые видно, — сузили выборку до болезней, значит и цифры
 * про болезни (контракт §23, §28).
 */
export const attendanceAdminApi = {
  journal(filters: AdminJournalFilters, signal?: AbortSignal): Promise<AdminJournal> {
    return request<AdminJournal>(
      `/admin/attendance/journal${pageQuery({
        month: filters.month || undefined,
        classId: filters.classId,
        subgroupId: filters.subgroupId ?? undefined,
        subjectId: filters.subjectId ?? undefined,
        teacherProfileId: filters.teacherProfileId ?? undefined,
        studentProfileId: filters.studentProfileId ?? undefined,
        status: filters.status ?? undefined,
        reason: filters.reason ?? undefined,
      })}`,
      { signal },
    );
  },

  /**
   * Закончившиеся уроки без публикации — по всей школе, поэтому постранично.
   * Класс здесь необязателен: это как раз тот список, который смотрят целиком.
   */
  unfilled(filters: UnfilledLessonFilters, signal?: AbortSignal): Promise<UnfilledLessonPage> {
    return request<UnfilledLessonPage>(
      `/admin/attendance/unfilled${pageQuery({
        month: filters.month || undefined,
        classId: filters.classId ?? undefined,
        page: filters.page ?? 0,
        size: filters.size ?? 20,
      })}`,
      { signal },
    );
  },
};
