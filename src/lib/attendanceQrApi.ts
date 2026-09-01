import { request } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';

export type AttendanceQrSession = Schema<'AttendanceQrSessionView'>;
export type AttendanceQrScan = Schema<'AttendanceQrScanView'>;

export type AttendanceQrStatus = NonNullable<AttendanceQrSession['status']>;
export type AttendanceQrOutcome = NonNullable<AttendanceQrScan['outcome']>;

/** Коды отказов QR (attendance-qr-contract §5), на которые у экрана есть свой ответ. */
export const ATTENDANCE_QR_ERRORS = {
  notInProgress: 'ATTENDANCE_QR_LESSON_NOT_IN_PROGRESS',
  notOpen: 'ATTENDANCE_QR_NOT_OPEN',
} as const;

/**
 * QR-код посещаемости урока — учителя урока и админ.
 *
 * <b>Открыть и закрыть — это команды сервера, а не состояние экрана.</b> Показанный код
 * действует, закрытый — нет; фронт версиями не управляет и валидность не считает
 * (ТЗ FE-001 §3). `canOpen` приходит посчитанным: «урок идёт» — правило бэкенда, и
 * повторять его здесь значит однажды получить активную кнопку и 409 в ответ на неё.
 *
 * Все три метода возвращают одно и то же представление, поэтому после команды
 * перезапрашивать состояние не нужно — ответ кладётся в кеш как есть.
 */
export const attendanceQrApi = {
  state(lessonId: number, signal?: AbortSignal): Promise<AttendanceQrSession> {
    return request<AttendanceQrSession>(`/lessons/${lessonId}/attendance/qr`, { signal });
  },

  /**
   * Открыть код или перевыпустить его — одна команда: для учителя это одно действие
   * «показать классу код», а различает их наличие действующей версии.
   */
  open(lessonId: number): Promise<AttendanceQrSession> {
    return request<AttendanceQrSession>(`/lessons/${lessonId}/attendance/qr`, { method: 'POST' });
  },

  close(lessonId: number): Promise<AttendanceQrSession> {
    return request<AttendanceQrSession>(`/lessons/${lessonId}/attendance/qr/close`, {
      method: 'POST',
    });
  },
};

/** Отсканировавшие — по ученику, чтобы строка журнала находила свой скан за O(1). */
export function scansByStudent(session: AttendanceQrSession | undefined): Map<number, AttendanceQrScan> {
  const map = new Map<number, AttendanceQrScan>();
  for (const scan of session?.scans ?? []) {
    if (scan.studentProfileId != null) map.set(scan.studentProfileId, scan);
  }
  return map;
}
