import type {
  AssessmentComponent,
  ComponentSummary,
  PeriodResult,
  PolicyComponent,
  WorkScoring,
} from '@/lib/gradingApi';

/**
 * Слова и форматы критериального оценивания (GRADES-003).
 *
 * <p>Здесь ничего не считается: проценты, вклады и рекомендации приходят с сервера
 * (grading-policy-contract §5), и вторая арифметика на клиенте разошлась бы с журналом на
 * первом же округлении. Модуль только называет и форматирует.
 */

export const COMPONENT_SHORT: Record<AssessmentComponent, string> = {
  FORMATIVE: 'ФО',
  SOR: 'СОР',
  SOCH: 'СОЧ',
  INTERMEDIATE: 'ПО',
};

export const SCORING_LABELS: Record<WorkScoring, string> = {
  TEN_POINT: '10-балльная',
  RAW_POINTS: 'Баллы из максимума',
};

export const MISSING_RULE_LABELS = {
  RENORMALIZE: 'Пересчитать веса на присутствующие компоненты',
  REQUIRE_ALL: 'Не выводить процент без всех компонентов',
} as const;

export const POLICY_STATUS_LABELS = {
  DRAFT: 'Черновик',
  ACTIVE: 'Действует',
  RETIRED: 'Выведена',
} as const;

/** «84,2%» — запятая, как пишут проценты в школе; целые без хвоста «,00». */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—';
  const fixed = Number(value).toFixed(2);
  const trimmed = fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed;
  return `${trimmed.replace('.', ',')}%`;
}

/** Компоненты строки в порядке политики, по коду — для колонок журнала. */
export function componentsByCode(result: PeriodResult | null | undefined): Map<string, ComponentSummary> {
  const map = new Map<string, ComponentSummary>();
  for (const component of result?.components ?? []) {
    if (component.code) map.set(component.code, component);
  }
  return map;
}

/**
 * Почему у строки нет процента — словами, а не прочерком: «нет работ» и «нет СОЧ при
 * обязательных компонентах» ведут к разным действиям учителя.
 */
export function resultStatusHint(result: PeriodResult | null | undefined): string | null {
  if (!result) return null;
  switch (result.status) {
    case 'NO_WORKS':
      return 'Нет учитываемых работ — процент не считается';
    case 'INCOMPLETE':
      return `Нет работ: ${(result.missingComponents ?? []).map((code) => COMPONENT_SHORT[code]).join(', ')} — по политике процент без них не считается`;
    default:
      return result.missingComponents && result.missingComponents.length > 0
        ? `Нет работ: ${result.missingComponents.map((code) => COMPONENT_SHORT[code]).join(', ')} — веса пересчитаны`
        : null;
  }
}

/**
 * То же, что `resultStatusHint`, но коротко и на виду — под прочерком процента (пилот,
 * пункт 3.2). Подсказка только по наведению оставляла пустой процент похожим на поломку.
 *
 * <p>Три разных факта читаются по-разному: нет данных — эта подпись; ноль баллов — честные
 * «0%» без подписи; «Временно не аттестован» — решение учителя в колонке итога.
 */
export function resultMissingCaption(result: PeriodResult | null | undefined): string | null {
  if (!result) return null;
  const missing = (result.missingComponents ?? []).map((code) => COMPONENT_SHORT[code]).join(', ');
  switch (result.status) {
    case 'NO_WORKS':
      return 'Нет работ за четверть';
    case 'INCOMPLETE':
      return missing ? `Нет ${missing}` : 'Не хватает работ';
    default:
      return missing ? `Без ${missing}, веса пересчитаны` : null;
  }
}

/**
 * У скольких учеников итог не посчитан и каких работ не хватает — одна строка над таблицей
 * итогов вместо россыпи прочерков по строкам.
 */
export function missingResultsSummary(
  results: Array<PeriodResult | null | undefined>,
): { students: number; components: string[] } {
  let students = 0;
  const components = new Set<string>();
  for (const result of results) {
    if (!result || (result.status !== 'NO_WORKS' && result.status !== 'INCOMPLETE')) continue;
    students += 1;
    for (const code of result.missingComponents ?? []) components.add(COMPONENT_SHORT[code]);
  }
  return { students, components: [...components] };
}

/**
 * «1–10» или «2–5» — шкала итога, как её прислал сервер (`allowedValues`). Экран её не
 * выбирает: шкалу задают пороги политики, а без политики остаётся прежняя 2–5 (пилот,
 * пункт 3.1 — подписать, откуда берётся число, чтобы 1–10 урока и итог не спорили молча).
 */
export function finalScaleCaption(allowedValues: number[] | undefined): string | null {
  if (!allowedValues || allowedValues.length === 0) return null;
  const sorted = [...allowedValues].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const continuous = sorted.every((value, index) => value === first + index);
  return continuous ? `${first}–${last}` : sorted.join(', ');
}

/**
 * Какие итоги снимают «Временно не аттестован»: все, кроме нижнего порога шкалы.
 * Тот же порог проверяет сервер (`FinalValueOptions.isPositive`): без политики это «не
 * ниже 3» из 2–5, по политике — выше её порога с 0%.
 */
export function positiveFinalValues(allowedValues: number[]): number[] {
  return [...allowedValues].sort((a, b) => a - b).slice(1);
}

/** «ФО 25 · СОР 25 · СОЧ 50» — шапка журнала и подпись политики. */
export function weightsCaption(components: PolicyComponent[] | undefined): string {
  return (components ?? [])
    .map((component) => `${component.code ? COMPONENT_SHORT[component.code] : '?'} ${formatPlain(component.weightPercent)}`)
    .join(' · ');
}

/** Сумма весов черновика — подсказка в форме; проверяет её всё равно сервер при активации. */
export function weightsSum(components: PolicyComponent[]): number {
  return components.reduce((sum, component) => sum + Number(component.weightPercent ?? 0), 0);
}

function formatPlain(value: number | undefined): string {
  if (value == null) return '0';
  const text = String(value);
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}
