import type { GradeCorrection, GradeCorrectionHistoryEvent, TemporaryGrade } from '@/lib/gradeCorrectionsApi';

/**
 * Как экран оценок урока говорит об исправлениях. Только подписи и выбор «какое исправление
 * у строки» — статус, просрочка и события истории приходят с сервера готовыми.
 */

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_LONG = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/** «2026-10-21» → «21 окт» — подпись в строке ученика (Figma 1956:1399). */
export function shortDate(iso: string | null | undefined): string {
  const parts = parseIsoDate(iso);
  return parts ? `${parts.day} ${MONTHS_SHORT[parts.month - 1]}` : '—';
}

/** «2026-10-21» → «21 октября» — в окнах исправления. */
export function longDate(iso: string | null | undefined): string {
  const parts = parseIsoDate(iso);
  return parts ? `${parts.day} ${MONTHS_LONG[parts.month - 1]}` : '—';
}

function parseIsoDate(iso: string | null | undefined): { day: number; month: number } | null {
  const match = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return match ? { month: Number(match[2]), day: Number(match[3]) } : null;
}

/** Сегодня в формате поля даты — нижняя граница выбора срока. Окончательно срок проверяет сервер. */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Временная оценка строкой: «8», «4+», «15/20» — как у обычной (`gradeValueLabel`). */
export function temporaryGradeLabel(grade: TemporaryGrade | null | undefined): string | null {
  if (!grade) return null;
  if (grade.scaleCode) return grade.scaleCode;
  if (grade.score == null) return null;
  const score = trimNumber(grade.score);
  return grade.maxScore == null || Number(grade.maxScore) === 10 ? score : `${score}/${trimNumber(grade.maxScore)}`;
}

function trimNumber(value: number | string): string {
  return String(Number(value));
}

/**
 * Исправление строки ученика. Открытое — одно на ученика и урок; если открытого нет,
 * последнее завершённое даёт значок «исправление было» рядом с оценкой (Figma 1981:1893).
 * Отменённые строку не меняют: в макете у отмены своего вида нет.
 */
export function rowCorrection(
  corrections: GradeCorrection[],
  studentProfileId: number | null | undefined,
): { open: GradeCorrection | null; completed: GradeCorrection | null } {
  const own = corrections.filter((item) => item.studentProfileId === studentProfileId);
  const open = own.find((item) => item.status === 'REQUIRED' || item.status === 'OVERDUE') ?? null;
  const completed = open
    ? null
    : own
        .filter((item) => item.status === 'COMPLETED')
        .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0] ?? null;
  return { open, completed };
}

/** Бейдж в строке: «Требуется исправление · до 21 окт» / «Срок истёк · было до 21 окт». */
export function correctionBadge(correction: GradeCorrection): { tone: 'warning' | 'danger'; text: string } {
  return correction.overdue
    ? { tone: 'danger', text: `Срок истёк · было до ${shortDate(correction.deadline)}` }
    : { tone: 'warning', text: `Требуется исправление · до ${shortDate(correction.deadline)}` };
}

interface Snapshot {
  comment?: string;
  deadline?: string;
  temporaryScaleCode?: string | null;
  temporaryScore?: number | null;
  temporaryMaxScore?: number | null;
  finalGradeValue?: string | null;
}

function snapshot(value: unknown): Snapshot {
  return value && typeof value === 'object' ? (value as Snapshot) : {};
}

function snapshotTemporary(value: Snapshot): string | null {
  return temporaryGradeLabel({
    scaleCode: value.temporaryScaleCode ?? undefined,
    score: value.temporaryScore ?? undefined,
    maxScore: value.temporaryMaxScore ?? undefined,
  });
}

/** Комментарий в ленте — коротко: строка истории не место для полного текста. */
function quote(comment: string | undefined): string {
  const text = (comment ?? '').trim();
  return text.length > 40 ? `«${text.slice(0, 40).trimEnd()}…»` : `«${text}»`;
}

/**
 * Строка события истории (Figma 1981:1893). Событие и его данные — с сервера; здесь только
 * слова. Создание с временной оценкой — одно событие, и оно говорит об оценке тут же.
 */
export function describeCorrectionEvent(event: GradeCorrectionHistoryEvent): string {
  const after = snapshot(event.after);
  const before = snapshot(event.before);
  switch (event.action) {
    case 'CREATED': {
      const temp = snapshotTemporary(after);
      return (
        `Отмечено исправление: ${quote(after.comment)}, срок до ${shortDate(after.deadline)}` +
        (temp ? `; временная оценка: ${temp}` : '')
      );
    }
    case 'COMMENT_CHANGED':
      return `Изменён комментарий исправления: ${quote(after.comment)}`;
    case 'DEADLINE_CHANGED':
      return after.deadline && before.deadline && after.deadline > before.deadline
        ? `Срок продлён до ${shortDate(after.deadline)}`
        : `Срок изменён: до ${shortDate(after.deadline)}`;
    case 'TEMPORARY_GRADE_CHANGED': {
      const temp = snapshotTemporary(after);
      return temp ? `Выставлена временная оценка: ${temp}` : 'Временная оценка снята';
    }
    case 'EXPIRED':
      return 'Срок истёк';
    case 'COMPLETED':
      return after.finalGradeValue
        ? `Выставлена итоговая оценка: ${after.finalGradeValue}, исправление завершено`
        : 'Выставлена итоговая оценка, исправление завершено';
    case 'CANCELLED':
      return 'Исправление отменено';
    default:
      return 'Изменено исправление';
  }
}

/** Кто: автор события или «Система» — у «Срок истёк» автора нет. */
export function correctionEventActor(event: GradeCorrectionHistoryEvent): string {
  return event.actorName ?? 'Система';
}

/** «14 окт, 09:12» — время события в ленте истории (Figma 1981:1893), по часам смотрящего. */
export function eventTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Значение из формы строкой — чтобы понять, менялась ли временная оценка. */
export function gradeValueKey(value: { scaleCode?: string | null; score?: number | null } | null): string | null {
  if (!value) return null;
  if (value.scaleCode) return value.scaleCode;
  return value.score != null ? String(Number(value.score)) : null;
}
