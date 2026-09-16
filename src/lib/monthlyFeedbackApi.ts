import { request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type FeedbackMonthRow = Schema<'TeacherFeedbackMonthRow'>;
export type FeedbackMonth = Schema<'TeacherFeedbackMonthView'>;
export type FeedbackSheetRow = Schema<'TeacherFeedbackSheetRow'>;
export type FeedbackSheet = Schema<'TeacherFeedbackSheetView'>;
export type FeedbackStudentRow = Schema<'TeacherFeedbackStudentRow'>;
export type FeedbackEntry = Schema<'FeedbackEntryView'>;
export type FeedbackProgress = Schema<'FeedbackProgressView'>;
export type SaveFeedbackEntryResult = Schema<'SaveFeedbackEntryResult'>;
export type FeedbackHistoryFilters = Schema<'TeacherFeedbackHistoryFilters'>;

/** Координаты листа: учитель — из токена, остальное — из фильтров экрана. */
export type FeedbackSheetKey = { month: string; classId: number; subjectId: number };

/** Коды отказов, на которые у экрана есть свой ответ (контракт §6). */
export const FEEDBACK_ERRORS = {
  versionConflict: 'MONTHLY_FEEDBACK_ENTRY_VERSION_CONFLICT',
  sheetPublished: 'MONTHLY_FEEDBACK_SHEET_PUBLISHED',
  monthClosed: 'MONTHLY_FEEDBACK_MONTH_CLOSED',
  notInRoster: 'MONTHLY_FEEDBACK_STUDENT_NOT_IN_ROSTER',
  sheetIncomplete: 'MONTHLY_FEEDBACK_SHEET_INCOMPLETE',
  monthIncomplete: 'MONTHLY_FEEDBACK_MONTH_INCOMPLETE',
} as const;

/** Максимум текста отзыва: больше сервер отклонит 400 (контракт T4). */
export const FEEDBACK_TEXT_LIMIT = 3000;

function sheetPath({ month, classId, subjectId }: FeedbackSheetKey): string {
  return `/monthly-feedback/teacher/months/${month}/classes/${classId}/subjects/${subjectId}`;
}

/**
 * Кабинет учителя (MONTHLY-FEEDBACK-001, `docs/monthly-feedback-contract.md` §3).
 *
 * <p>Права и флаги экрана (`editable`, `canPublish`, `canClose`) приходят посчитанными: кто
 * вправе писать, решает обязанность по расписанию и назначению, а её на клиенте не из чего
 * вывести.
 */
export const monthlyFeedbackApi = {
  /** T1. Месяцы активного учебного года, где есть что писать или что уже написано. */
  months(signal?: AbortSignal): Promise<FeedbackMonthRow[]> {
    return request<FeedbackMonthRow[]>('/monthly-feedback/teacher/months', { signal });
  },

  /**
   * T8. Нужны экрану ради `months` за **всю** историю: T1 без года отдаёт только активный год,
   * а прошлогодний опубликованный май должен оставаться в выборе месяца.
   */
  historyFilters(signal?: AbortSignal): Promise<FeedbackHistoryFilters> {
    return request<FeedbackHistoryFilters>('/monthly-feedback/teacher/history/filters', { signal });
  },

  /** T2. Листы месяца: из них строятся фильтры «Предмет» и «Класс», тут же `canClose`. */
  month(month: string, signal?: AbortSignal): Promise<FeedbackMonth> {
    return request<FeedbackMonth>(`/monthly-feedback/teacher/months/${month}`, { signal });
  },

  /** T3. Лист класса: ученики, их записи и прогресс. */
  sheet(key: FeedbackSheetKey, signal?: AbortSignal): Promise<FeedbackSheet> {
    return request<FeedbackSheet>(sheetPath(key), { signal });
  },

  /**
   * T4. Автосохранение одного отзыва. `version` — из последнего ответа, `null` у новой записи;
   * пустой `text` удаляет запись (`entry: null` в ответе).
   */
  saveEntry(
    key: FeedbackSheetKey & { studentProfileId: number },
    body: { text: string; version: number | null },
  ): Promise<SaveFeedbackEntryResult> {
    return request<SaveFeedbackEntryResult>(`${sheetPath(key)}/students/${key.studentProfileId}`, {
      method: 'PUT',
      // `undefined`, а не `null`: сгенерированный тип знает только отсутствие поля, а Jackson
      // читает отсутствующее как `null` — для сервера это одно и то же.
      body: { text: body.text, version: body.version ?? undefined },
    });
  },

  /** T5. Публикация листа целиком. Повтор на опубликованном — 200 с тем же `publishedAt`. */
  publish(key: FeedbackSheetKey): Promise<FeedbackSheet> {
    return request<FeedbackSheet>(`${sheetPath(key)}/publication`, { method: 'POST' });
  },

  /** T6. Закрытие месяца: разрешено, когда опубликованы все листы. */
  closeMonth(month: string): Promise<FeedbackMonth> {
    return request<FeedbackMonth>(`/monthly-feedback/teacher/months/${month}/closure`, { method: 'POST' });
  },
};
