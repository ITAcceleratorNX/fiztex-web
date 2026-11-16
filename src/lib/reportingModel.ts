import type { Schema } from '@/lib/apiSchemas';
import { ATTESTATION_SHORT, isAttestationStatus } from '@/lib/attestationModel';
import { FINAL_RESULT_LABELS } from '@/lib/finalGradeResult';

export type ReportMetrics = Schema<'ReportMetricsView'>;
export type ReportRow = Schema<'ReportBreakdownRow'>;
export type ReportSummary = Schema<'AcademicReportSummaryView'>;
export type ReportFinal = Schema<'AcademicReportFinalGradeView'>;
export type ReportReference = Schema<'ReportReferenceView'>;

/**
 * Значение ячейки отчёта: текст и, если вместо числа прочерк, — почему.
 *
 * <p>Всё здесь — показ чисел, которые уже посчитал сервер (учебная отчётность, ТЗ §6):
 * ни одного деления, среднего или округления сверх форматирования. Пустое значение
 * никогда не становится нулём — нет оценок и «средний 0» на экране выглядят по-разному.
 */
export interface MetricDisplay {
  text: string;
  /** Пояснение к прочерку или к форме числа; `undefined` — пояснять нечего. */
  hint?: string;
  missing: boolean;
}

const decimal = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percentNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

const DASH = '—';

function missing(hint: string): MetricDisplay {
  return { text: DASH, hint, missing: true };
}

/**
 * «Ср. балл»: средний шкальных оценок; под политикой оценивания для одного ученика по
 * одному предмету за период — процент её расчёта (шкального среднего у баллов нет).
 */
export function averageDisplay(metrics: ReportMetrics | undefined): MetricDisplay {
  const grades = metrics?.grades;
  const average = grades?.scaleAverage;
  if (average?.state === 'AVAILABLE' && average.value != null) {
    return { text: decimal.format(average.value), missing: false };
  }
  const result = grades?.periodResult;
  if (result?.state === 'AVAILABLE' && result.mode === 'POINTS' && result.result?.roundedPercent != null) {
    return {
      text: `${result.result.roundedPercent}%`,
      hint: 'Процент периода по политике оценивания',
      missing: false,
    };
  }
  if (!grades || (grades.gradeCount ?? 0) === 0) return missing('За период оценки не выставлялись');
  if ((grades.pointsCount ?? 0) > 0) {
    return missing('Оценки выставлены в баллах — процент считается для одного ученика по предмету за период');
  }
  return missing('Среднего балла за период нет');
}

/** «Посещаемость»: процент опубликованных отметок, как его отдал сервер. */
export function attendanceDisplay(metrics: ReportMetrics | undefined): MetricDisplay {
  const percent = metrics?.attendance?.presencePercent;
  if (percent?.state === 'AVAILABLE' && percent.value != null) {
    return { text: `${percentNumber.format(percent.value)}%`, missing: false };
  }
  return missing('Посещаемость за период не отмечалась');
}

/** «Успеваемость»: в системе показателя пока нет, и подменять его нечем (backend: DEPENDENCY_MISSING). */
export function performanceDisplay(metrics: ReportMetrics | undefined): MetricDisplay {
  const value = metrics?.academicPerformance;
  if (value?.state === 'AVAILABLE' && value.value != null) {
    return { text: `${percentNumber.format(value.value)}%`, missing: false };
  }
  return missing('Показатель успеваемости пока не рассчитывается системой');
}

/** «Уроков»: проведённые (завершившиеся неотменённые) уроки среза. */
export function lessonsDisplay(metrics: ReportMetrics | undefined): MetricDisplay {
  const lessons = metrics?.lessons;
  if (lessons?.completedLessonCount != null) return { text: integer.format(lessons.completedLessonCount), missing: false };
  if (lessons?.knownParticipantLessonCount != null) {
    return {
      text: integer.format(lessons.knownParticipantLessonCount),
      hint: 'По урокам, где известен состав участников',
      missing: false,
    };
  }
  return missing('Количество уроков недоступно');
}

/** Счётчик, который сервер отдаёт всегда (пропуски, опоздания, оценки). */
export function countDisplay(value: number | null | undefined): MetricDisplay {
  return value == null ? missing('Нет данных') : { text: integer.format(value), missing: false };
}

export function formatCount(value: number): string {
  return integer.format(value);
}

/**
 * Пустой ли срез целиком: ни уроков, ни оценок, ни отметок, ни итогов. Тогда экран
 * показывает «нет данных за период», а не таблицу прочерков и нулей.
 */
export function isEmptyReport(metrics: ReportMetrics | undefined): boolean {
  if (!metrics) return true;
  return (metrics.lessons?.completedLessonCount ?? metrics.lessons?.knownParticipantLessonCount ?? 0) === 0
    && (metrics.grades?.gradeCount ?? 0) === 0
    && (metrics.attendance?.publishedMarkCount ?? 0) === 0
    && (metrics.finalGrades?.publishedCount ?? 0) === 0;
}

/**
 * Часть строк без среднего или без посещаемости при данных у других — макет «частичные
 * данные»: итог посчитан сервером по тому, что есть, и экран об этом предупреждает.
 */
export function hasPartialData(rows: ReportRow[]): boolean {
  if (rows.length < 2) return false;
  const gaps = rows.filter((row) => averageDisplay(row.metrics).missing || attendanceDisplay(row.metrics).missing);
  return gaps.length > 0 && gaps.length < rows.length;
}

/** Статус аттестации вместо числа итога — текстом, никогда не нулём (ТЗ §5). */
export type AttestationLabel = 'ВНА' | 'НА';

/** Итог в клетке: число шкалы или статус аттестации. */
export type FinalCell = number | AttestationLabel;

/** Слова — из `attestationModel`/`finalGradeResult`: статус называется одинаково на всех экранах. */
export const ATTESTATION_TITLES: Record<AttestationLabel, string> = {
  [ATTESTATION_SHORT.TEMP_UNATTESTED]: FINAL_RESULT_LABELS.TEMP_UNATTESTED,
  [ATTESTATION_SHORT.NOT_ATTESTED]: FINAL_RESULT_LABELS.NOT_ATTESTED,
} as Record<AttestationLabel, string>;

function finalCell(final: ReportFinal): FinalCell | null {
  if (isAttestationStatus(final.resultKind)) return ATTESTATION_SHORT[final.resultKind] as AttestationLabel;
  return final.value ?? null;
}

/** Итог ученика по предмету за период из опубликованных итогов. */
export function periodFinalsByStudent(finals: ReportFinal[], subjectId?: number | null): Map<number, FinalCell> {
  const result = new Map<number, FinalCell>();
  for (const final of finals) {
    const cell = finalCell(final);
    if (final.finalScope !== 'PERIOD' || cell == null || final.student?.id == null) continue;
    if (subjectId != null && final.subject?.id !== subjectId) continue;
    result.set(final.student.id, cell);
  }
  return result;
}

/** Итог по предмету за период у одного ученика — шторка. */
export function periodFinalsBySubject(finals: ReportFinal[]): Map<number, FinalCell> {
  const result = new Map<number, FinalCell>();
  for (const final of finals) {
    const cell = finalCell(final);
    if (final.finalScope !== 'PERIOD' || cell == null || final.subject?.id == null) continue;
    result.set(final.subject.id, cell);
  }
  return result;
}

export type ReportPerformance = Schema<'AcademicReportPerformanceView'>;
export type StudentRating = Schema<'AcademicReportStudentRatingView'>;
export type StudentRatingRow = Schema<'StudentRatingRow'>;
export type ClassRating = Schema<'AcademicReportClassRatingView'>;
export type ClassRatingRow = Schema<'ClassRatingRow'>;
export type DynamicsPoint = Schema<'DynamicsPoint'>;

/** Значение, которое прислал сервер, — с двумя знаками; пустое не становится нулём. */
export function decimalDisplay(value: number | null | undefined, hint: string): MetricDisplay {
  return value == null ? missing(hint) : { text: decimal.format(value), missing: false };
}

/**
 * Сводная успеваемость: среднее предметов каждого ученика, затем среднее учеников.
 * Пустая — «нет данных», а не 0.
 */
export function performanceValueDisplay(performance: ReportPerformance | null | undefined): MetricDisplay {
  if (performance?.state === 'AVAILABLE' && performance.value != null) {
    return { text: decimal.format(performance.value), missing: false };
  }
  return missing(performance?.basis === 'PUBLISHED'
    ? 'Итоги за период не опубликованы'
    : 'Недостаточно данных для расчёта');
}

/**
 * Подпись основы расчёта. Текущий средний — не четвертная оценка, поэтому он всегда
 * подписан, и «Предварительно» стоит у незавершённого периода (ТЗ Frontend §5–6).
 */
export function basisLabel(basis: string | null | undefined, preliminary: boolean | null | undefined): string {
  if (basis === 'PUBLISHED') return 'Опубликованные итоги';
  return preliminary ? 'Текущая успеваемость · Предварительно' : 'Текущая успеваемость';
}

/** Почему у строки рейтинга нет места — пояснение к прочерку. */
export function ratingStateHint(row: Pick<StudentRatingRow, 'state' | 'subjectsWithResult' | 'subjectsExpected'>): string | undefined {
  switch (row.state) {
    case 'NO_DATA': return 'Нет результатов за период';
    case 'MISSING_SUBJECTS': return `Результаты по ${row.subjectsWithResult ?? 0} из ${row.subjectsExpected ?? 0} предметов — место не присваивается`;
    case 'ATTESTATION_STATUS': return 'ВНА/НА: в средние не входит, место не присваивается';
    default: return undefined;
  }
}

const signed = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

/** Изменение к прошлому периоду: «+0,40», «−0,20»; без сравнения — прочерк, а не ноль. */
export function changeDisplay(value: number | null | undefined): MetricDisplay & { trend: 'up' | 'down' | 'flat' | null } {
  if (value == null) return { ...missing('Нет предыдущего периода с данными'), trend: null };
  return { text: signed.format(value), missing: false, trend: value > 0 ? 'up' : value < 0 ? 'down' : 'flat' };
}

/** Имя файла выгрузки — запасное: сервер называет файл сам, браузер берёт это имя. */
export function reportFileName(yearName: string | null | undefined, periodName: string | null | undefined): string {
  return `Отчётность ${yearName ?? ''} ${periodName ?? 'год'}.xlsx`.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ');
}

/** Склонение по числу: `plural(3, ['учитель', 'учителя', 'учителей'])`. */
export function plural(count: number, forms: readonly [string, string, string]): string {
  const rule = new Intl.PluralRules('ru-RU').select(count);
  return rule === 'one' ? forms[0] : rule === 'few' ? forms[1] : forms[2];
}

export function counted(count: number, forms: readonly [string, string, string]): string {
  return `${formatCount(count)} ${plural(count, forms)}`;
}

export const STUDENTS = ['ученик', 'ученика', 'учеников'] as const;
export const LESSONS = ['урок', 'урока', 'уроков'] as const;
export const TEACHERS = ['учитель', 'учителя', 'учителей'] as const;
export const SUBJECTS = ['предмет', 'предмета', 'предметов'] as const;
export const CLASSES = ['класс', 'класса', 'классов'] as const;
export const HOMEROOMS = ['кл. руководитель', 'кл. руководителя', 'кл. руководителей'] as const;

function shortDate(iso: string | undefined): string {
  if (!iso) return '';
  const [, month, day] = iso.split('-');
  return `${day}.${month}`;
}

/** «1 четверть (01.09 – 31.10)». */
export function periodLabel(period: { name?: string | null; startDate?: string; endDate?: string } | null | undefined): string {
  if (!period) return 'Весь учебный год';
  const dates = period.startDate && period.endDate ? ` (${shortDate(period.startDate)} – ${shortDate(period.endDate)})` : '';
  return `${period.name ?? 'Период'}${dates}`;
}

/** «2026–2027» из дат года; без дат — его название. */
export function yearLabel(year: { name?: string | null; startDate?: string | null; endDate?: string | null } | null | undefined): string {
  if (!year) return '';
  const start = year.startDate?.slice(0, 4);
  const end = year.endDate?.slice(0, 4);
  return start && end ? `${start}–${end}` : year.name ?? '';
}

/** Имена через запятую; больше двух — «Петров А.А. и ещё 2». */
export function namesLabel(references: ReportReference[] | null | undefined, limit = 2): string {
  const names = (references ?? []).map((item) => item.name ?? '').filter(Boolean);
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} и ещё ${names.length - limit}`;
}

/** Две буквы для плашки: «Математика» → «М», «Английский язык» → «АЯ», «8 «А»» → «8А». */
export function badgeLetters(name: string | null | undefined): string {
  const clean = (name ?? '').replace(/[«»"]/g, ' ').trim();
  if (!clean) return '?';
  const words = clean.split(/\s+/).filter(Boolean);
  if (/^\d/.test(words[0])) return words.slice(0, 2).join('').toLocaleUpperCase('ru-RU').slice(0, 3);
  return words.slice(0, 2).map((word) => word[0]).join('').toLocaleUpperCase('ru-RU');
}
