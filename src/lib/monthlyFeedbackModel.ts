import type {
  FeedbackEntry,
  FeedbackMonthRow,
  FeedbackSheet,
  FeedbackSheetRow,
  FeedbackStudentRow,
  SaveFeedbackEntryResult,
} from '@/lib/monthlyFeedbackApi';

/**
 * Правила экрана «Обратная связь» учителя (MONTHLY-FEEDBACK-FE-001).
 *
 * <p>Здесь только то, что экран обязан решить сам: из чего собрать фильтры, как назвать месяц
 * и строку, кого открыть следующим. Кто вправе писать, публиковать и закрывать — приходит с
 * бэкенда флагами (`editable`, `canPublish`, `canClose`) и здесь не повторяется.
 */

const MONTHS_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

/** `2026-09` по часам браузера. Школа и учитель в одном часовом поясе. */
export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** `2026-09` → «Сентябрь 2026». Непонятное значение возвращается как есть. */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const name = match ? MONTHS_NOMINATIVE[Number(match[2]) - 1] : undefined;
  return match && name ? `${name} ${match[1]}` : month;
}

/**
 * Месяцы в выборе, от нового к старому.
 *
 * <p>Три источника, и ни один не заменяет остальные: T1 знает месяцы **активного** года, T8 —
 * опубликованные месяцы за всю историю (прошлогодний май), а текущий месяц нужен всегда —
 * экран открывается на нём, и «в этом месяце у вас нет классов» тоже ответ.
 */
export function monthOptions(
  yearMonths: FeedbackMonthRow[] | undefined,
  historyMonths: string[] | undefined,
  current: string,
): string[] {
  const all = new Set<string>([current]);
  for (const row of yearMonths ?? []) if (row.month) all.add(row.month);
  for (const month of historyMonths ?? []) all.add(month);
  // Будущий месяц сервер не отдаёт ни одним из списков, но и текущий не должен оказаться
  // ниже будущего, если часы браузера отстают: сортировка строкой `yyyy-MM` честная.
  return [...all].sort((a, b) => b.localeCompare(a));
}

export type Option = { value: string; label: string };

/** Предметы месяца по имени. Один предмет в разных классах — одна строка фильтра. */
export function subjectOptions(sheets: FeedbackSheetRow[] | undefined): Option[] {
  const byId = new Map<number, string>();
  for (const sheet of sheets ?? []) {
    if (sheet.subjectId != null) byId.set(sheet.subjectId, sheet.subjectName ?? '');
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ value: String(id), label: name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

/**
 * Классы выбранного предмета. Учитель одних подгрупп пишет только своим подгруппам, и без их
 * имён «7 «А»» у учителя группы A читалось бы как весь класс.
 */
export function classOptions(sheets: FeedbackSheetRow[] | undefined, subjectId: number | null): Option[] {
  if (subjectId == null) return [];
  return (sheets ?? [])
    .filter((sheet) => sheet.subjectId === subjectId && sheet.classId != null)
    .map((sheet) => ({ value: String(sheet.classId), label: sheetClassLabel(sheet) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru', { numeric: true }));
}

export function sheetClassLabel(sheet: Pick<FeedbackSheetRow, 'className' | 'scope' | 'subgroupNames'>): string {
  const name = sheet.className ?? '';
  const subgroups = sheet.scope === 'SUBGROUPS' ? (sheet.subgroupNames ?? []) : [];
  return subgroups.length > 0 ? `${name} · ${subgroups.join(', ')}` : name;
}

/** Статус строки ученика. «Черновика» нет: сохранённый текст сервер уже считает заполненным. */
export type StudentStatus = 'filled' | 'missing' | 'left';

export function studentStatus(row: FeedbackStudentRow): StudentStatus {
  if (row.inRoster === false) return 'left';
  return row.filled ? 'filled' : 'missing';
}

export function studentName(row: Pick<FeedbackStudentRow, 'lastName' | 'firstName' | 'middleName'>): string {
  return [row.lastName, row.firstName, row.middleName].filter(Boolean).join(' ');
}

/**
 * Кого открыть по «Следующий ученик»: первый незаполненный **после** текущего по порядку
 * листа, по кругу. Ушедших не открываем — им писать уже не нужно.
 */
export function nextStudentToFill(
  students: FeedbackStudentRow[] | undefined,
  currentId: number,
): FeedbackStudentRow | null {
  const list = students ?? [];
  const start = list.findIndex((row) => row.studentProfileId === currentId);
  for (let step = 1; step <= list.length; step += 1) {
    const row = list[(start + step + list.length) % list.length];
    if (row && row.studentProfileId !== currentId && studentStatus(row) === 'missing') return row;
  }
  return null;
}

/** Две колонки макета: сверху вниз по левой, затем по правой — порядок листа не ломается. */
export function splitColumns<T>(rows: T[]): [T[], T[]] {
  const half = Math.ceil(rows.length / 2);
  return [rows.slice(0, half), rows.slice(half)];
}

/**
 * Ответ автосохранения в кэш листа — без перезапроса (контракт T4). Меняются ровно строка и
 * прогресс; `filled` строки — то же правило, что у сервера: запись есть и ученик в составе.
 */
export function applySavedEntry(
  sheet: FeedbackSheet | undefined,
  studentProfileId: number,
  result: Pick<SaveFeedbackEntryResult, 'entry' | 'progress'>,
): FeedbackSheet | undefined {
  if (!sheet) return sheet;
  const entry: FeedbackEntry | undefined = result.entry ?? undefined;
  return {
    ...sheet,
    progress: result.progress ?? sheet.progress,
    students: (sheet.students ?? []).map((row) =>
      row.studentProfileId === studentProfileId
        ? { ...row, entry, filled: row.inRoster !== false && entry != null }
        : row,
    ),
  };
}

/**
 * Изменилась ли готовность листа к публикации. `canPublish` считает сервер, поэтому на переходе
 * через «все заполнены» лист перечитывается, а не досчитывается здесь.
 */
export function completionChanged(
  before: FeedbackSheet['progress'] | undefined,
  after: FeedbackSheet['progress'] | undefined,
): boolean {
  return ((before?.missing ?? 1) === 0) !== ((after?.missing ?? 1) === 0);
}

/** Подсказка у неактивного «Закрыть период»: сколько листов месяца уже опубликовано. */
export function closeHint(sheets: FeedbackSheetRow[] | undefined): string {
  const list = sheets ?? [];
  const published = list.filter((sheet) => sheet.status === 'PUBLISHED').length;
  return `Опубликовано ${published} из ${list.length}`;
}
