import type { AttendanceReason } from '@/lib/attendanceApi';
import { reasonLabel } from '@/lib/attendanceModel';

/** Именительный падеж — месяц стоит в селекте сам по себе, как и в журнале оценок. */
const MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export type AttendanceMonthOption = {
  /** `YYYY-MM` — ровно то, что принимает `month` у обоих админских эндпоинтов. */
  value: string;
  label: string;
};

/**
 * Месяцы учебного года.
 *
 * Список строится из границ года, а не из четвертей (как в журнале оценок): у
 * посещаемости нет четверти в запросе, а незаполненные уроки бывают и в каникулы
 * между периодами — месяц, выпавший из четвертей, скрывать нельзя.
 */
export function monthOptionsOfYear(
  year: { startDate?: string; endDate?: string } | null | undefined,
): AttendanceMonthOption[] {
  const start = parseIso(year?.startDate);
  const end = parseIso(year?.endDate);
  if (!start || !end || start > end) return [];

  const options: AttendanceMonthOption[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    options.push({
      value: monthValue(cursor),
      label: `${MONTHS_NOMINATIVE[cursor.getMonth()]} ${cursor.getFullYear()}`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return options;
}

/** Месяц по умолчанию: текущий, если он в году, иначе последний — год мог закончиться. */
export function defaultMonthValue(
  options: AttendanceMonthOption[],
  today = new Date(),
): string | null {
  if (options.length === 0) return null;
  const current = monthValue(today);
  return options.some((option) => option.value === current)
    ? current
    : (options[options.length - 1]?.value ?? null);
}

export function monthLabel(
  options: AttendanceMonthOption[],
  value: string | null | undefined,
): string | null {
  return options.find((option) => option.value === value)?.label ?? null;
}

/**
 * Разбивка причин из сводки — в порядке убывания, чтобы главная причина стояла первой.
 * Причины «не указана» в разбивке нет: это не причина, а её отсутствие (контракт §23).
 */
export function reasonBreakdownRows(
  breakdown: Partial<Record<string, number>> | undefined,
): Array<{ reason: AttendanceReason; label: string; count: number }> {
  return Object.entries(breakdown ?? {})
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .map(([reason, count]) => ({
      reason: reason as AttendanceReason,
      label: reasonLabel(reason as AttendanceReason),
      count: count as number,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'));
}

function monthValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}
