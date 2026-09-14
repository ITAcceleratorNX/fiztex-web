import type {
  BindingBatch,
  BindingOptions,
  BindingOptionsYear,
  CreateBindingsRequest,
  LessonTextbook,
  TextbookBinding,
} from '@/lib/textbooksApi';
import { pluralRu } from '@/lib/format';

/**
 * Правила экранов учебников, которые не зависят от вёрстки.
 *
 * Здесь нет ни одного правила доступа: кто может выбирать, завершать и открывать, приходит
 * с сервера. Модель только раскладывает ответы по словам и полям формы.
 */

// ── Файл ──────────────────────────────────────────────────────────────────────

/** Лимит модуля (`fiztex.textbooks.max-file-size`). Сервер проверяет его сам; здесь — чтобы не гнать 300 МБ ради отказа. */
export const MAX_TEXTBOOK_BYTES = 100 * 1024 * 1024;

export const TEXTBOOK_ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Что сказать о файле до загрузки. Расширение — только первое сито: настоящий формат сервер
 * определяет по сигнатуре, и переименованный `.jpg` он отклонит сам.
 */
export function textbookFileProblem(file: Pick<File, 'name' | 'size'>): string | null {
  const extension = file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
  if (extension !== 'pdf' && extension !== 'docx') return 'Нужен файл PDF или DOCX';
  if (file.size > MAX_TEXTBOOK_BYTES) return 'Файл больше 100 МБ';
  return null;
}

/** Название по умолчанию из имени файла: «spotlight6_sb.pdf» → «spotlight6_sb». */
export function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).trim();
}

export function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 содержимого для `duplicate-check` (контракт §3). */
export async function sha256Hex(file: Blob): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
}

// ── Строка назначения ─────────────────────────────────────────────────────────

export type BindingRowState =
  /** Действует без даты окончания — можно завершить. */
  | { kind: 'active' }
  /** Действует, но окончание уже назначено (например, завершили сегодня). */
  | { kind: 'ending'; until: string }
  /** Ещё не началось — завершать нечего, можно отменить. */
  | { kind: 'upcoming'; from: string }
  | { kind: 'ended'; on: string };

/**
 * Что можно сделать со строкой назначения.
 *
 * «Действует ли сегодня» — `binding.active`, его считает сервер. Дата сравнивается только там,
 * где сервер отвечает «нет»: отличить «ещё не началось» от «уже закончилось», потому что у
 * этих двух строк разные действия (`DELETE` и никакого).
 */
export function bindingRowState(binding: TextbookBinding, today: string): BindingRowState {
  const from = binding.effectiveFrom ?? '';
  const to = binding.effectiveTo ?? null;
  if (binding.active) return to ? { kind: 'ending', until: to } : { kind: 'active' };
  if (from > today) return { kind: 'upcoming', from };
  return { kind: 'ended', on: to ?? from };
}

/** «14.09» — короткая дата для колонки действий. */
export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return day && month ? `${day}.${month}` : iso;
}

export function bindingClassLabel(binding: Pick<TextbookBinding, 'className' | 'subgroupName'>): string {
  return [binding.className, binding.subgroupName].filter(Boolean).join(' · ');
}

export function bindingPeriodLabel(binding: Pick<TextbookBinding, 'academicYearName' | 'academicPeriodName'>): string {
  return [binding.academicYearName, binding.academicPeriodName].filter(Boolean).join(' · ');
}

/** Сегодня по локальному календарю в ISO — тем же форматом, что даты назначений. */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// ── Форма назначения ──────────────────────────────────────────────────────────

export type Option = { value: string; label: string };

/** Год, на котором открывается форма и таблица: текущий, а не первый попавшийся. */
export function defaultYear(options: BindingOptions | undefined): BindingOptionsYear | undefined {
  const years = options?.years ?? [];
  return years.find((year) => year.current) ?? years[0];
}

export function findYear(options: BindingOptions | undefined, yearId: number | null | undefined) {
  return options?.years?.find((year) => year.id === yearId);
}

export function defaultPeriodId(year: BindingOptionsYear | undefined): number | undefined {
  const periods = year?.periods ?? [];
  return (periods.find((period) => period.current) ?? periods[0])?.id;
}

/**
 * Предметы, которые учитель ведёт во **всех** выбранных классах.
 *
 * Назначение создаётся одним предметом на все классы сразу, поэтому предмет, которого нет
 * хотя бы в одном из них, сервер отклонил бы `TEXTBOOK_NOT_YOUR_CLASS`.
 */
export function subjectOptions(year: BindingOptionsYear | undefined, classIds: number[]): Option[] {
  const assignments = year?.assignments ?? [];
  const seen = new Map<number, string>();
  for (const assignment of assignments) {
    if (assignment.subjectId == null || seen.has(assignment.subjectId)) continue;
    const teachesEverywhere = classIds.every((classId) =>
      assignments.some((a) => a.subjectId === assignment.subjectId && a.classId === classId),
    );
    if (teachesEverywhere) seen.set(assignment.subjectId, assignment.subjectName ?? '');
  }
  return [...seen].map(([id, name]) => ({ value: String(id), label: name }));
}

/** Классы, где учитель ведёт выбранный предмет; без предмета — все его классы. */
export function classOptions(year: BindingOptionsYear | undefined, subjectId: number | null): Option[] {
  const seen = new Map<number, string>();
  for (const assignment of year?.assignments ?? []) {
    if (assignment.classId == null || seen.has(assignment.classId)) continue;
    if (subjectId != null && assignment.subjectId !== subjectId) continue;
    seen.set(assignment.classId, assignment.className ?? '');
  }
  return [...seen].map(([id, name]) => ({ value: String(id), label: name }));
}

/** Значение «весь год» в поле периода: пустой список периодов = все действующие периоды года (контракт §7). */
export const WHOLE_YEAR = 'year';

export function buildBindingsRequest(input: {
  textbookId: number;
  academicYearId: number;
  period: string;
  classIds: number[];
}): CreateBindingsRequest {
  return {
    textbookId: input.textbookId,
    academicYearId: input.academicYearId,
    academicPeriodIds: input.period === WHOLE_YEAR ? [] : [Number(input.period)],
    targets: input.classIds.map((classId) => ({ classId })),
  };
}

/**
 * Итог пачки для тоста. Пропуск — не ошибка (контракт §7), но молчать о нём нельзя: учитель
 * нажал «Сохранить» на три класса, а назначилось два.
 */
export function describeBatch(batch: BindingBatch): { tone: 'success' | 'info'; text: string } {
  const created = batch.created?.length ?? 0;
  const skipped = batch.skipped ?? [];
  const alreadyBound = skipped.filter((row) => row.reason === 'ALREADY_BOUND').length;
  const periodEnded = skipped.filter((row) => row.reason === 'PERIOD_ENDED').length;

  const parts: string[] = [];
  if (created > 0) parts.push(`Учебник назначен: ${created} ${pluralRu(created, ['назначение', 'назначения', 'назначений'])}`);
  if (alreadyBound > 0) parts.push(`уже было назначено — ${alreadyBound}`);
  if (periodEnded > 0) parts.push(`период закончился — ${periodEnded}`);

  if (created === 0) {
    return { tone: 'info', text: parts.length ? `Ничего не добавлено: ${parts.join(', ')}` : 'Ничего не добавлено' };
  }
  return { tone: 'success', text: parts.join(', ') };
}

// ── Урок ──────────────────────────────────────────────────────────────────────

/** «стр. 24», «стр. 24–26» или пусто — «с первой страницы» (контракт §5). */
export function pagesLabel(pageFrom: number | null | undefined, pageTo: number | null | undefined): string {
  if (pageFrom == null) return '';
  if (pageTo == null || pageTo === pageFrom) return `стр. ${pageFrom}`;
  return `стр. ${pageFrom}–${pageTo}`;
}

export function lessonTextbookLabel(textbook: LessonTextbook): string {
  return [textbook.title, pagesLabel(textbook.pageFrom, textbook.pageTo)].filter(Boolean).join(' · ');
}

export type PageRange = { pageFrom: number | null; pageTo: number | null };

/**
 * Разбор полей «Страница … по …». Пустое начало — «с первой страницы», пустой конец — одна
 * страница. Границы по `pageCount` проверяются здесь ради мгновенной подсказки; сервер
 * проверяет их всё равно (`TEXTBOOK_PAGE_OUT_OF_RANGE`).
 */
export function parsePageRange(
  fromInput: string,
  toInput: string,
  pageCount: number | null | undefined,
): { range: PageRange } | { error: string } {
  const pageFrom = parsePage(fromInput);
  const pageTo = parsePage(toInput);
  if (pageFrom === undefined || pageTo === undefined) return { error: 'Страница — целое число' };
  if (pageFrom == null && pageTo != null) return { error: 'Укажите, с какой страницы' };
  if (pageFrom != null && pageFrom < 1) return { error: 'Страницы начинаются с первой' };
  if (pageCount != null) {
    const outside = [pageFrom, pageTo].some((page) => page != null && page > pageCount);
    if (outside) return { error: `В учебнике ${pageCount} ${pluralRu(pageCount, ['страница', 'страницы', 'страниц'])}` };
  }
  if (pageFrom != null && pageTo != null && pageTo < pageFrom) {
    return { error: 'Конец диапазона раньше начала' };
  }
  return { range: { pageFrom, pageTo } };
}

/** `null` — поле пустое, `undefined` — в поле не число. */
function parsePage(input: string): number | null | undefined {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  return Number(trimmed);
}
