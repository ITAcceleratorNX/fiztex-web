import type { AssessmentAnalysisWork, PerformanceRow, SpecialForm } from '@/hooks/specialReportQueries';

/**
 * Слова специальных форм отчётности. Числа, состояния и права приходят с сервера
 * (`fiztex-back/docs/special-report-forms-contract.md`); здесь их только называют, чтобы экран
 * и файлы выгрузки говорили одно и то же.
 */

export const FORM_TITLES: Record<SpecialForm, string> = {
  assessment: 'Анализ СОР и СОЧ',
  classPerformance: 'Успеваемость класса',
  teacherPerformance: 'Учителю по предмету',
};

export const NO_DATA = 'Нет данных';
export const NOT_ENOUGH_DATA = 'Недостаточно данных';

const decimal = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** «78,57 %»; пусто — «Нет данных», у неполной строки — «Недостаточно данных». */
export function percentText(value: number | null | undefined, incomplete = false): string {
  if (value == null) return incomplete ? NOT_ENOUGH_DATA : NO_DATA;
  return `${decimal.format(value)} %`;
}

/** Средний балл: «7,93»; пусто — «Нет данных» (ВНА и отсутствие итога не ноль). */
export function averageText(value: number | null | undefined): string {
  return value == null ? NO_DATA : decimal.format(value);
}

// ---- анализ СОР/СОЧ ---------------------------------------------------------------------

export const LEVEL_LABELS = { LOW: 'Низкий', MIDDLE: 'Средний', HIGH: 'Высокий' } as const;
export const LEVEL_RANGES = { LOW: '0–39 %', MIDDLE: '40–84 %', HIGH: '85–100 %' } as const;

/** Пояснение к строке работы, у которой нечего считать; `null` — работа посчитана. */
export function workStateHint(work: Pick<AssessmentAnalysisWork, 'state' | 'invalidResultCount'>): string | null {
  if (work.state === 'NO_DATA') return 'Нет ни одного выставленного балла';
  if (work.state === 'INVALID_MAX') return 'У работы максимум не больше нуля — считать не от чего';
  if ((work.invalidResultCount ?? 0) > 0) {
    return `Исключено некорректных результатов (балл вне 0…максимум): ${work.invalidResultCount}`;
  }
  return null;
}

/** «СОР 2 · 7А · Группа 1 · Английский» — подпись работы в окне анализа. */
export function workTitle(work: AssessmentAnalysisWork): string {
  return [work.title, work.schoolClass?.name, work.subgroup?.name].filter(Boolean).join(' · ');
}

// ---- успеваемость ------------------------------------------------------------------------

/** Состояние строки формы успеваемости: короткое слово в колонку и пояснение. */
export function performanceState(row: Pick<PerformanceRow, 'state' | 'missing' | 'finalPeriodName' | 'scaleMax'>):
  { label: string; hint: string | null; tone: 'green' | 'amber' | 'gray' | 'blue' } {
  switch (row.state) {
    case 'OK':
      return { label: 'Посчитано', hint: null, tone: 'green' };
    case 'INCOMPLETE':
      return { label: NOT_ENOUGH_DATA, tone: 'amber',
        hint: `Нет опубликованного итога у ${row.missing ?? 0} уч. Проценты не считаются, пока правило для неполных данных не утверждено.` };
    case 'NO_DATA':
      return { label: NO_DATA, hint: 'В строке нет учеников, подлежащих числовой аттестации', tone: 'gray' };
    case 'ROSTER_UNAVAILABLE':
      return { label: NOT_ENOUGH_DATA, hint: 'Не удалось восстановить состав подгруппы за выбранный период. Проценты не рассчитываются.', tone: 'amber' };
    case 'SCALE_NOT_SUPPORTED':
      return { label: 'Шкала не 10-балльная', tone: 'gray',
        hint: `Итог по шкале до ${row.scaleMax ?? '—'}: категории формы (9–10, 7–8, 4–6, 1–3) к нему не применимы` };
    case 'PASS_FAIL':
      return { label: 'Зачётный предмет', hint: 'Средний балл и СОУ не считаются — только зачёт и незачёт', tone: 'blue' };
    case 'NOT_APPLICABLE':
      return { label: 'Итог позже', tone: 'gray',
        hint: `Итог полугодия ставится: ${row.finalPeriodName ?? 'в конце полугодия'}` };
    default:
      return { label: '—', hint: null, tone: 'gray' };
  }
}

/** Числовые категории видны только там, где они посчитаны. */
export function showsCategories(row: Pick<PerformanceRow, 'state'>): boolean {
  return row.state === 'OK' || row.state === 'INCOMPLETE' || row.state === 'NO_DATA';
}

/** «Отчёт 2026-2027 1 четверть 7А» — имя файла по выбранным фильтрам. */
export function specialFileStem(form: SpecialForm, parts: Array<string | null | undefined>): string {
  return [FORM_TITLES[form], ...parts].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]/g, '-');
}
