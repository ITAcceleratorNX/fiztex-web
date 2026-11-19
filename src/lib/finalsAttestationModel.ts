import type { AttestationPeriodOption } from './attestationSettingsApi';
import type { ClassFinalGradeRow, ClassFinalGrades, RecommendationOutcome } from './gradebookApi';
import type { ResultKind } from './attestationModel';
import { pluralRu } from './format';
import { periodGenitive, periodTitle } from './subjectAttestationModel';
import { shortDate } from './journalModel';

/**
 * Экран итогов в журнале при «Итоговой аттестации по предметам» (макеты Б1–Б3, У3–У11): полугодие,
 * «Зачёт / Незачёт», рекомендация и основание. Только слова и чтение ответа сервера: рекомендацию,
 * проценты, где у класса полугодие и можно ли ставить итог, отдаёт бэкенд.
 */

export function isHalfYear(finals: Pick<ClassFinalGrades, 'attestation'> | null | undefined): boolean {
  return finals?.attestation?.periodicity === 'HALF_YEAR';
}

export function isPassFail(finals: Pick<ClassFinalGrades, 'assessmentMode'> | null | undefined): boolean {
  return finals?.assessmentMode === 'PASS_FAIL';
}

/** Вкладка журнала: «Итоги полугодия» у полугодового предмета, иначе — «Итоги четверти» (Б1). */
export function finalsTabLabel(option: AttestationPeriodOption | null | undefined): string {
  return option?.periodicity === 'HALF_YEAR' ? 'Итоги полугодия' : 'Итоги четверти';
}

/** «1 полугодие (01.09 – 27.12)» — вариант фильтра «Период». */
export function periodOptionLabel(option: AttestationPeriodOption): string {
  const range = option.startDate && option.endDate ? ` (${shortDate(option.startDate)} – ${shortDate(option.endDate)})` : '';
  return `${option.name ?? ''}${range}`;
}

/** Вариант фильтра, в который входит четверть: у полугодия это пара. */
export function optionOfPeriod(options: readonly AttestationPeriodOption[], periodId: number | null): AttestationPeriodOption | null {
  if (periodId == null) return null;
  return options.find((option) => option.periods?.some((period) => period.id === periodId)) ?? null;
}

/** «Итог 1 полугодия» или «Итоговая оценка» — заголовок колонки решения учителя. */
export function finalColumnTitle(finals: ClassFinalGrades): string {
  const half = finals.attestation?.halfYear;
  return isHalfYear(finals) && half?.number ? `Итог ${half.number} полугодия` : 'Итоговая оценка';
}

/** «за полугодие» / «за четверть» — в баннерах и подсказках. */
export function scopeWord(finals: ClassFinalGrades): string {
  return isHalfYear(finals) ? 'полугодие' : 'четверть';
}

/** Подпись под рекомендацией, когда её нет (У3, У6): коротко, полный текст — в подсказке. */
export function recommendationGap(recommendation: RecommendationOutcome | null | undefined): string | null {
  switch (recommendation?.unavailableReason) {
    case 'INSUFFICIENT_DATA': return 'Недостаточно оценок';
    case 'CRITERIA_NOT_APPROVED': return 'Критерии зачёта школы не подключены';
    case 'METHOD_NOT_APPROVED': return 'Методика не утверждена';
    default: return null;
  }
}

/** Совпадает ли выбор с рекомендацией: сравнение того, что прислал сервер, — не расчёт. */
export function matchesRecommendation(
  recommendation: RecommendationOutcome | null | undefined,
  kind: ResultKind,
  value: number | null,
): boolean {
  return Boolean(recommendation?.available) && recommendation?.resultKind === kind
    && (kind !== 'NUMERIC' || recommendation?.value === value);
}

const KIND_WORDS: Partial<Record<ResultKind, string>> = { PASS: 'Зачёт', FAIL: 'Незачёт' };

function choiceWord(kind: ResultKind, value: number | null): string {
  return kind === 'NUMERIC' ? String(value ?? '') : KIND_WORDS[kind] ?? kind;
}

/** Заголовок и подзаголовок окна основания (У4 2224:5513, У6 2224:6523). */
export function deviationDialog(row: ClassFinalGradeRow, kind: ResultKind, value: number | null): { title: string; subtitle: string } {
  const recommendation = row.recommendation;
  const name = row.studentName ?? '';
  if (recommendation?.available && recommendation.resultKind) {
    const recommended = choiceWord(recommendation.resultKind, recommendation.value ?? null);
    return {
      title: 'Итог отличается от рекомендации',
      subtitle: `${name} · рекомендация «${recommended}», выбран «${choiceWord(kind, value)}»`,
    };
  }
  return { title: 'Итог без рекомендации', subtitle: `${name} · выбран «${choiceWord(kind, value)}»` };
}

/** Частые причины окна основания — заготовки поля, без справочника (ТЗ). */
export const DEVIATION_REASONS = ['Работа пересдана', 'Уважительная причина пропуска', 'Дополнительная работа'] as const;
export const NO_RECOMMENDATION_REASONS = ['Все работы сданы', 'Нормативы выполнены', 'Уважительная причина пропуска'] as const;

/** Подсказка у значка основания (У5): «Причина отличия от рекомендации» или «Основание итога». */
export function deviationCaption(row: ClassFinalGradeRow): string {
  const grade = row.finalGrade;
  return grade?.confirmedRecommendedKind ? 'Причина отличия от рекомендации' : 'Основание итога';
}

/** Стрелка у второй четверти (Б3): выше или ниже первой — сравнение двух присланных процентов. */
export function trendOf(previous: number | null | undefined, next: number | null | undefined): 'up' | 'down' | null {
  if (previous == null || next == null || previous === next) return null;
  return next > previous ? 'up' : 'down';
}

/**
 * Строка-пояснение над таблицей (Б1, У3): как аттестуется предмет. Только у настроенного предмета —
 * у остальных остаётся прежняя подпись шкалы.
 */
export function attestationNote(finals: ClassFinalGrades, subjectName: string): string | null {
  const attestation = finals.attestation;
  if (!attestation?.configured) return null;
  const half = attestation.halfYear;
  const parts: string[] = [];
  if (isHalfYear(finals) && half) {
    parts.push(isPassFail(finals)
      ? `${subjectName} аттестуется по полугодиям, итог — «Зачёт» или «Незачёт».`
      : `${subjectName} аттестуется по полугодиям: итог ${half.number} полугодия ставится один раз, в конце `
        + `${periodGenitive(periodTitle(half.closing))}, по 10-балльной шкале. Итога за ${periodTitle(half.opening)} нет.`);
  } else {
    parts.push(isPassFail(finals)
      ? `${subjectName} аттестуется по четвертям, итог — «Зачёт» или «Незачёт».`
      : `${subjectName} аттестуется по четвертям, итог — по 10-балльной шкале.`);
  }
  if (attestation.sochProvided === false) parts.push('СОЧ по предмету не предусмотрен: итог выставляется без него.');
  if (isPassFail(finals)) parts.push('Рекомендацию считает система по критериям школы, итог выбирает учитель.');
  return parts.join(' ');
}

export type FinalsBanner = { tone: 'info' | 'warning'; strong?: string; text: string };

/**
 * Синяя строка над таблицей — что сейчас с итогом (Б1, Б2, У3, У6). Сначала то, что закрывает итог
 * целиком (промежуточная четверть полугодия), потом то, что касается всех учеников (критерии
 * зачёта не подключены), потом — отдельных (недостаточно оценок).
 */
export function finalsBanner(finals: ClassFinalGrades): FinalsBanner | null {
  const rows = finals.rows ?? [];
  const attestation = finals.attestation;
  const half = attestation?.halfYear;
  if (attestation?.finalAllowed === false && half) {
    const anyResult = rows.some((row) => row.result?.percent != null
      || (row.quarterResults ?? []).some((quarter) => quarter.result?.percent != null));
    return anyResult
      ? {
        tone: 'info',
        text: `Идёт ${periodTitle(half.opening)}: проценты текущие и ещё изменятся. Итог ${half.number} полугодия выставляется `
          + `с начала ${periodGenitive(periodTitle(half.closing))}${half.closing?.startDate ? `, с ${shortDate(half.closing.startDate)}` : ''}.`,
      }
      : { tone: 'info', text: `Оценок за ${periodTitle(half.opening)} пока нет. Проценты появятся, когда на уроках будут выставлены оценки.` };
  }
  // Когда итог выставлен всем, выбирать вручную уже нечего — баннер только мешал бы.
  if (rows.some((row) => !row.finalGrade) && isPassFail(finals)
    && rows.every((row) => row.recommendation?.unavailableReason === 'CRITERIA_NOT_APPROVED')) {
    return {
      tone: 'warning',
      strong: 'Рекомендация не рассчитывается: школа ещё не подключила критерии зачёта.',
      text: 'Выберите итог вручную и укажите основание у каждого ученика.',
    };
  }
  const insufficient = rows.filter((row) => row.recommendation?.unavailableReason === 'INSUFFICIENT_DATA'
    && !row.finalGrade).length;
  if (insufficient > 0) {
    return {
      tone: 'info',
      text: `Рекомендации нет у ${insufficient} ${pluralRu(insufficient, ['ученика', 'учеников', 'учеников'])}: `
        + `недостаточно оценок за ${scopeWord(finals)}. Итог можно выбрать вручную с основанием.`,
    };
  }
  return null;
}
