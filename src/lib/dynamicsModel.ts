import type { Schema } from '@/lib/apiSchemas';

export type DynamicsPeriod = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
export type DynamicsMetric = Schema<'DynamicsMetricView'>;
export type DynamicsIndicator = Schema<'IndicatorView'>;
export type DynamicsWindow = Schema<'DynamicsWindowView'>;
export type DynamicsPoint = Schema<'DynamicsPointView'>;
export type DynamicsSeriesPoint = Schema<'DynamicsSeriesPointView'>;

export const PERIODS: ReadonlyArray<{ value: DynamicsPeriod; label: string }> = [
  { value: 'WEEK', label: 'Неделя' },
  { value: 'MONTH', label: 'Месяц' },
  { value: 'QUARTER', label: 'Четверть' },
  { value: 'YEAR', label: 'Год' },
];

export function periodOf(value: string | null): DynamicsPeriod {
  return PERIODS.find((item) => item.value === value)?.value ?? 'QUARTER';
}

/*
 * Всё ниже — показ значений, которые посчитал сервер (динамика оценок, ТЗ §7): средний,
 * изменение, статус и точки графика приходят готовыми. Здесь только формат и подписи.
 */

const value = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const change = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 2, signDisplay: 'exceptZero' });

/** «8,1» или «84,2%»: процент политики — с процентом, средний шкалы — числом. */
export function formatIndicator(indicator: DynamicsIndicator | null | undefined): string | null {
  if (indicator?.state !== 'AVAILABLE' || indicator.value == null) return null;
  return indicator.mode === 'POLICY_PERCENT' ? `${value.format(indicator.value)}%` : value.format(indicator.value);
}

export function formatSeriesValue(point: { value?: number | null; mode?: string | null }): string {
  if (point.value == null) return '';
  return point.mode === 'POLICY_PERCENT' ? `${value.format(point.value)}%` : value.format(point.value);
}

export type BadgeTone = 'growth' | 'decline' | 'stable' | 'neutral';

/** Значок изменения (Figma «+0,3», «−0,4», «0,0 Стабильно», «Нет данных для сравнения»). */
export function changeBadge(metric: DynamicsMetric | null | undefined): { text: string; tone: BadgeTone } {
  switch (metric?.trend) {
    case 'GROWTH': return { text: formatChange(metric.change), tone: 'growth' };
    case 'DECLINE': return { text: formatChange(metric.change), tone: 'decline' };
    case 'STABLE': return { text: `${formatChange(metric.change ?? 0)} Стабильно`, tone: 'stable' };
    default: return { text: 'Нет данных для сравнения', tone: 'neutral' };
  }
}

export function formatChange(delta: number | null | undefined): string {
  if (delta == null) return '';
  return delta === 0 ? '0,0' : change.format(delta).replace('-', '−');
}

/** Нет оценок ни сейчас, ни раньше — предмет не оценивается (Figma «Оценки не выставляются»). */
export function notGraded(metric: DynamicsMetric | null | undefined): boolean {
  return metric?.current?.state === 'NO_DATA' && (metric.previous == null || metric.previous.state === 'NO_DATA');
}

/** Пояснение, почему нет текущего значения; `null` — значение есть. */
export function emptyReason(metric: DynamicsMetric | null | undefined): string | null {
  const state = metric?.current?.state;
  if (state === 'AVAILABLE') return null;
  if (notGraded(metric)) return 'Оценки не выставляются';
  switch (state) {
    case 'NO_DATA': return 'Нет оценок за период';
    case 'MIXED_MODES': return 'В периоде оценки по старой шкале и в баллах — общего значения нет';
    case 'POLICY_INCOMPLETE': return 'Не хватает работ, которых требует политика оценивания';
    case 'NO_COUNTED_WORKS': return 'Оценки периода не учитываются политикой оценивания';
    case 'NO_POLICY': return 'Нет активной политики оценивания';
    default: return 'Нет данных';
  }
}

const shortMonth = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

function date(iso: string | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayMonth(iso: string | undefined): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

function shortRange(window: DynamicsWindow): string {
  const from = date(window.from);
  const to = date(window.to);
  if (!from || !to) return '';
  if (from.getMonth() === to.getMonth()) {
    return `${from.getDate()}–${shortMonth.format(to).replace('.', '')}`;
  }
  return `${shortMonth.format(from).replace('.', '')} – ${shortMonth.format(to).replace('.', '')}`;
}

/** «1 четверть (01.09 – 27.10)», «13–19 окт», «октябрь 2026 г.», «2026-2027». */
export function windowLabel(window: DynamicsWindow | null | undefined): string {
  if (!window) return '';
  switch (window.type) {
    case 'QUARTER': return `${window.academicPeriodName ?? 'Период'} (${dayMonth(window.from)} – ${dayMonth(window.to)})`;
    case 'YEAR': return `${window.academicYearName ?? ''} учебный год`.trim();
    case 'MONTH': {
      // Именительный падеж: Intl с годом даёт «октября 2026 г.» — «Данные за октября» неграмотно.
      const from = date(window.from);
      return from ? `${MONTHS[from.getMonth()]} ${from.getFullYear()}` : '';
    }
    default: return shortRange(window);
  }
}

/** Подпись сравнения по фактическому прошлому окну: «к 4 четверти 2025–2026», «к прошлой неделе (6–12 окт)». */
export function compareLabel(previous: DynamicsWindow | null | undefined): string {
  if (!previous) return 'Прошлого периода нет';
  switch (previous.type) {
    case 'QUARTER': return `к ${previous.academicPeriodName ?? 'прошлому периоду'} ${previous.academicYearName ?? ''}`.trim();
    case 'YEAR': return `к ${previous.academicYearName ?? 'прошлому'} учебному году`;
    case 'MONTH': return `к прошлому месяцу (${windowLabel(previous)})`;
    default: return `к прошлой неделе (${shortRange(previous)})`;
  }
}

export type PointKind = 'REGULAR' | 'SOR' | 'SOCH';

/** СОР и СОЧ различаются по типу работы, а под политикой — и по её компоненту. */
export function pointKind(point: DynamicsPoint): PointKind {
  if (point.gradeType === 'SUMMATIVE_TERM' || point.component === 'SOCH') return 'SOCH';
  if (point.gradeType === 'SUMMATIVE_SECTION' || point.component === 'SOR') return 'SOR';
  return 'REGULAR';
}

/** Значение оценки как есть: «4+», «7» или «23/25» — баллы СОР/СОЧ не переводятся в шкалу. */
export function pointValue(point: DynamicsPoint): { main: string; max?: string } {
  if (point.scaleCode) return { main: point.scaleCode };
  if (point.score == null) return { main: '—' };
  const score = String(Number(point.score));
  if (point.maxScore == null || Number(point.maxScore) === 10) return { main: score };
  return { main: score, max: String(Number(point.maxScore)) };
}

export type SortOrder = 'none' | 'decline' | 'growth';

/**
 * Сортировка по изменению с сервера: «сначала снижение» — по возрастанию, «сначала рост» —
 * по убыванию; строки без сравнения — в конце, в исходном порядке списка.
 */
export function sortByChange<T>(rows: T[], order: SortOrder, metric: (row: T) => DynamicsMetric | undefined): T[] {
  if (order === 'none') return rows;
  const indexed = rows.map((row, index) => ({ row, index, delta: metric(row)?.change ?? null }));
  indexed.sort((a, b) => {
    if (a.delta == null && b.delta == null) return a.index - b.index;
    if (a.delta == null) return 1;
    if (b.delta == null) return -1;
    return (order === 'decline' ? a.delta - b.delta : b.delta - a.delta) || a.index - b.index;
  });
  return indexed.map((item) => item.row);
}
