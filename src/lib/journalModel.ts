import { finalResultLabel } from './finalGradeResult';
import type {
  ClassFinalGradeRow,
  GradebookCell,
  GradebookColumn,
  GradebookPeriodRef,
  GradebookRow,
} from '@/lib/gradebookApi';

/** Именительный падеж — месяц стоит в подписи фильтра сам по себе, а не при числе. */
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

export type MonthOption = {
  /** Значение для селекта: период плюс месяц — месяц без периода журналу ничего не говорит. */
  key: string;
  label: string;
  academicPeriodId: number;
  dateFrom: string;
  dateTo: string;
};

/**
 * Месяцы, по которым имеет смысл смотреть журнал.
 *
 * <p>«Месяц» в макете — не отдельный период, а окно внутри четверти (контракт §2), поэтому
 * список строится из самих четвертей: каждый месяц знает, к какой четверти относится, и
 * выбор месяца задаёт журналу обе координаты сразу. Иначе переключение на «Октябрь» на
 * стыке четвертей открывало бы не ту четверть.
 *
 * <p>Границы месяца обрезаются краями периода: сервер сузит окно и сам, но тогда подпись
 * «01.10 – 31.10» разошлась бы с тем, что показано в таблице.
 */
export function monthOptionsOf(periods: GradebookPeriodRef[]): MonthOption[] {
  const options: MonthOption[] = [];

  for (const period of periods) {
    if (!period.id || !period.startDate || !period.endDate) continue;
    const start = parseIso(period.startDate);
    const end = parseIso(period.endDate);
    if (!start || !end) continue;

    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const from = monthStart < start ? start : monthStart;
      const to = monthEnd > end ? end : monthEnd;

      options.push({
        key: `${period.id}:${cursor.getFullYear()}-${cursor.getMonth() + 1}`,
        label: `${MONTHS_NOMINATIVE[cursor.getMonth()]} ${cursor.getFullYear()}`,
        academicPeriodId: period.id,
        dateFrom: toIso(from),
        dateTo: toIso(to),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return options;
}

/** Месяц, в который попадает сегодняшний день, — с него журнал открывается в режиме «Месяц». */
export function currentMonthKey(options: MonthOption[], today = new Date()): string | null {
  const iso = toIso(today);
  return options.find((option) => option.dateFrom <= iso && iso <= option.dateTo)?.key ?? null;
}

/** Подпись колонки: дата сверху, событие снизу — «Урок 3», «ДЗ», «СОР 1» или «Отмена». */
export function columnCaption(column: GradebookColumn): { date: string; event: string } {
  const date = column.date ? shortDate(column.date) : '';
  if (column.type === 'HOMEWORK') return { date, event: 'ДЗ' };
  if (isAssessmentColumn(column)) {
    // «СОР 1 / 20»: максимум работы виден в заголовке, а в клетках стоит только балл.
    const title = assessmentTitle(column);
    return { date, event: column.maxScore != null ? `${title} / ${column.maxScore}` : title };
  }
  if (columnState(column) === 'LESSON_CANCELLED') return { date, event: 'Отмена' };
  return { date, event: column.lessonNumber != null ? `Урок ${column.lessonNumber}` : 'Урок' };
}

/**
 * Колонка работы СОР/СОЧ (V142, `assessment-work-contract.md` §5): стоит сразу за своим
 * уроком, а в клетке у неё балл работы, а не оценки. Колонка урока остаётся — на ней ФО.
 */
export function isAssessmentColumn(column: GradebookColumn): boolean {
  return column.type === 'ASSESSMENT_WORK';
}

/** «СОР 2» / «СОЧ» — сервер присылает подпись готовой; без неё — по виду работы. */
export function assessmentTitle(column: GradebookColumn): string {
  return column.title ?? (column.assessmentKind === 'SOCH' ? 'СОЧ' : 'СОР');
}

/**
 * Куда ведёт заголовок колонки. Урок — в его оценки, задание — в карточку задания, работа
 * СОР/СОЧ — в карточку своего урока: `sourceId` у неё — id работы, а не урока.
 */
export function columnHref(column: GradebookColumn): string | null {
  if (column.sourceId == null) return null;
  if (column.type === 'LESSON') return `/lesson-schedule/lessons/${column.sourceId}/grades`;
  if (column.type === 'HOMEWORK') return `/homework/${column.sourceId}`;
  return column.lessonId != null ? `/lesson-schedule/lessons/${column.lessonId}` : null;
}

/** «15/20» — балл работы. Ноль — тоже балл, а не пустая клетка. */
export function assessmentScoreLabel(result: GradebookCell['assessmentResult']): string | null {
  if (!result || result.score == null) return null;
  return result.maxScore != null ? `${result.score}/${result.maxScore}` : String(result.score);
}

/** Есть ли в строках журнала хоть что-то выставленное — оценка или балл работы. */
export function hasAnyMarks(rows: GradebookRow[]): boolean {
  return rows.some((row) =>
    (row.cells ?? []).some((cell) => (cell.grades ?? []).length > 0 || cell.assessmentResult != null),
  );
}

type ColumnState = NonNullable<GradebookColumn['state']>;

/**
 * Почему колонка не принимает оценок. Без `state` (старый ответ) неактивный урок
 * по-прежнему читается как отменённый — других причин тот ответ не знал.
 */
export function columnState(column: GradebookColumn): ColumnState {
  if (column.state) return column.state;
  if (column.active !== false) return 'ACTIVE';
  return column.type === 'HOMEWORK' ? 'HOMEWORK_CANCELLED' : 'LESSON_CANCELLED';
}

/**
 * Подсказка над пустой клеткой неактивной колонки (пилот, пункт 3.3).
 *
 * <p>Неактивная колонка приходит в журнал только потому, что на ней уже стоят оценки, —
 * значит урок был. Прежнее «Занятие не состоялось» в клетке ученика без оценки врало
 * ровно на проведённом уроке: на вытесненном переизданием расписания, а то и на
 * отменённом уже после того, как оценки поставили. Клетка говорит только то, что верно
 * про неё: новых оценок здесь не будет и почему.
 */
export function inactiveColumnHint(column: GradebookColumn): string | null {
  switch (columnState(column)) {
    case 'ACTIVE':
      return null;
    case 'LESSON_CANCELLED':
      return 'Урок отменён. Оценки, выставленные до отмены, сохранены; новые не ставятся';
    case 'LESSON_SUPERSEDED':
      return 'Урок из прежней версии расписания. Его оценки сохранены; новые ставятся в актуальный урок';
    case 'HOMEWORK_CANCELLED':
      return 'Задание отменено. Его оценки сохранены; новые не ставятся';
  }
}

/** `01.09` — в шапке журнала год не нужен: он один на всю таблицу. */
export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return day && month ? `${day}.${month}` : iso;
}

/**
 * Средний балл как его показывает макет — с одним знаком.
 *
 * <p>Само значение приходит с двумя (контракт §5) и округляется только при показе:
 * пересчитывать среднее на клиенте нельзя, а показать 4.5 вместо 4.50 — можно.
 */
export function formatAverage(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return Number(value).toFixed(1);
}

/** Клетки строки по ключу колонки: в ответе приходят только непустые (контракт §4). */
export function cellsByColumn(row: GradebookRow): Map<string, GradebookCell> {
  const map = new Map<string, GradebookCell>();
  for (const cell of row.cells ?? []) {
    if (cell.columnKey) map.set(cell.columnKey, cell);
  }
  return map;
}

export function finalsByStudent(rows: ClassFinalGradeRow[]): Map<number, ClassFinalGradeRow> {
  const map = new Map<number, ClassFinalGradeRow>();
  for (const row of rows) {
    if (row.studentProfileId != null) map.set(row.studentProfileId, row);
  }
  return map;
}

/**
 * Итог, который видно в журнале. Черновик ученику не показывают (контракт §7), но
 * учителю в его собственном журнале — показывают: это его рабочее состояние.
 */
export function finalValueLabel(row: ClassFinalGradeRow | undefined): string {
  return finalResultLabel(row?.finalGrade);
}

function parseIso(iso: string): Date | null {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
