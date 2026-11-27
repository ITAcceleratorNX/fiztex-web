import type { Schema } from '@/lib/apiSchemas';

/**
 * AI-отчётность об учениках (ТЗ «AI-отчётность — Frontend», Figma `phyztex` Т1–А4).
 *
 * Здесь только слова и раскладка текста. Состояния, права, факты «из журнала», устаревание
 * краткой версии и «данные изменились» приходят с сервера (`fiztex-back/docs/ai-student-reports-contract.md`):
 * экран их называет, но не выводит.
 */

export type AiReport = Schema<'AiReportDetailView'>;
export type AiReportSummary = Schema<'AiReportSummaryView'>;
export type AiReportVersion = Schema<'AiReportVersionView'>;
export type AiReportEvent = Schema<'AiReportEventView'>;
export type AiReportContext = Schema<'AiReportContextView'>;
export type AiReportOwner = 'SUBJECT_TEACHER' | 'HOMEROOM';
export type AiReportType = 'STUDENT' | 'CLASS' | 'CLASSES';
export type AiPeriodKind = 'MONTH' | 'ACADEMIC_PERIOD' | 'CUSTOM';

export const TYPE_LABELS: Record<AiReportType, string> = {
  STUDENT: 'Ученик',
  CLASS: 'Класс',
  CLASSES: 'Мои классы',
};

export const PERIOD_KIND_LABELS: Record<AiPeriodKind, string> = {
  MONTH: 'Месяц',
  ACADEMIC_PERIOD: 'Четверть',
  CUSTOM: 'Произвольные даты',
};

// ---------------------------------------------------------------------------------------------
// Текст учителя: блоки, которые собрал сервер (`AiReportTextComposer`)
// ---------------------------------------------------------------------------------------------

/** Заголовки блоков текста учителя — дословно как пишет сервер. */
export const TEACHER_BLOCKS = [
  'Результаты и достижения',
  'Изменения и затруднения',
  'Посещаемость и дисциплина',
  'Рекомендации учителю',
  'Ограничения данных',
] as const;

/** Заголовки краткой версии родителю (сервер собирает её из трёх полей ответа модели). */
export const PARENT_BLOCKS = ['Достижения', 'На что обратить внимание', 'Рекомендации'] as const;

export type BlockRole = 'facts' | 'recommendations' | 'limitations' | 'free';

export interface TextBlock {
  /** `null` — текст вне известных заголовков (правка учителя или старый формат). */
  title: string | null;
  role: BlockRole;
  /** Пункты без маркера «• »; у родительского текста — абзацы. */
  items: string[];
}

const BULLET = /^[•\-–]\s+/;

function roleOf(title: string | null): BlockRole {
  if (title === 'Рекомендации учителю') return 'recommendations';
  if (title === 'Ограничения данных') return 'limitations';
  return title == null ? 'free' : 'facts';
}

/**
 * Делит текст на блоки по известным заголовкам. Строка-заголовок узнаётся только целиком —
 * пункт «Рекомендации учителю: …» внутри текста заголовком не станет. Пустых блоков нет.
 */
export function splitBlocks(text: string | null | undefined, titles: readonly string[]): TextBlock[] {
  const blocks: TextBlock[] = [];
  let current: TextBlock | null = null;
  for (const raw of (text ?? '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (titles.includes(line)) {
      current = { title: line, role: roleOf(line), items: [] };
      blocks.push(current);
      continue;
    }
    if (!current) {
      current = { title: null, role: 'free', items: [] };
      blocks.push(current);
    }
    current.items.push(line.replace(BULLET, ''));
  }
  return blocks.filter((block) => block.items.length > 0);
}

export const teacherBlocks = (text: string | null | undefined) => splitBlocks(text, TEACHER_BLOCKS);
export const parentBlocks = (text: string | null | undefined) => splitBlocks(text, PARENT_BLOCKS);

/**
 * Обратно в текст. У текста учителя пункты — с маркером «• », как у сервера; у родительского —
 * абзацы. Пустой блок пропадает вместе с заголовком: заголовок без содержания ничего не сообщает.
 */
export function joinBlocks(blocks: TextBlock[], bullets: boolean): string {
  return blocks
    .map((block) => {
      const items = block.items.map((item) => item.trim()).filter(Boolean);
      if (items.length === 0) return '';
      const body = items.map((item) => (bullets ? `• ${item}` : item)).join('\n');
      return block.title ? `${block.title}\n${body}` : body;
    })
    .filter(Boolean)
    .join('\n\n');
}

/** Поле редактора одного блока — строка на пункт. */
export const blockToField = (block: TextBlock) => block.items.join('\n');
export const fieldToItems = (value: string) => value.split('\n').map((line) => line.replace(BULLET, '').trim()).filter(Boolean);

/**
 * Блоки для правки: у текста учителя — все блоки ТЗ, даже пустые (учитель может дописать
 * «Посещаемость…», которой не было); свободный текст остаётся одним полем.
 */
export function editableBlocks(text: string | null | undefined, titles: readonly string[]): TextBlock[] {
  const blocks = splitBlocks(text, titles);
  if (blocks.length > 0 && blocks.every((block) => block.title == null)) return blocks;
  const free = blocks.filter((block) => block.title == null);
  return [
    ...free,
    ...titles.map((title) => blocks.find((block) => block.title === title) ?? { title, role: roleOf(title), items: [] }),
  ];
}

// ---------------------------------------------------------------------------------------------
// Статусы
// ---------------------------------------------------------------------------------------------

export type Tone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

export interface StatusLabel {
  label: string;
  tone: Tone;
}

/** Статус строки списка и шапки шторки: «Снят» — утверждённый отчёт, чью публикацию сняли. */
export function reportStatus(report: Pick<AiReportSummary, 'state' | 'published' | 'withdrawn'> | null | undefined): StatusLabel {
  if (!report) return { label: '—', tone: 'neutral' };
  if (report.published) return { label: 'Опубликован', tone: 'info' };
  switch (report.state) {
    case 'APPROVED':
      return report.withdrawn ? { label: 'Снят', tone: 'neutral' } : { label: 'Утверждён', tone: 'success' };
    case 'DRAFT':
      return { label: 'Черновик', tone: 'neutral' };
    case 'GENERATING':
      return { label: 'Формируется', tone: 'warning' };
    case 'FAILED':
      return { label: 'Не сформирован', tone: 'danger' };
    default:
      return { label: report.state ?? '—', tone: 'neutral' };
  }
}

/**
 * Статус краткой версии (ТЗ §5): «Не утверждён» → «Утверждён» → «Опубликован» → «Снят».
 * Публикация относится к краткой версии только тогда, когда опубликована именно она.
 */
export function parentStatus(report: AiReport | null | undefined): StatusLabel | null {
  const summary = report?.parentSummary;
  if (!summary) return null;
  const publication = report?.publication;
  const ours = publication != null && publication.parentSummaryId === summary.id;
  if (ours && publication.active) return { label: 'Опубликован', tone: 'info' };
  if (ours && !publication.active) return { label: 'Снят', tone: 'neutral' };
  if (summary.status === 'CONFIRMED') return { label: 'Утверждён', tone: 'success' };
  return { label: 'Не утверждён', tone: 'warning' };
}

// ---------------------------------------------------------------------------------------------
// Подписи
// ---------------------------------------------------------------------------------------------

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' });

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return dateFormat.format(value.length === 10 ? parseLocalDate(value) : new Date(value));
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTimeFormat.format(new Date(value)).replace(',', ',') : '—';
}

/** «2 четверть · 03.11 – 27.12»: подпись периода с фактическими датами окна. */
export function periodText(period: AiReportSummary['period'] | null | undefined): string {
  if (!period) return '—';
  const range = period.from && period.to
    ? `${shortDate.format(parseLocalDate(period.from))} – ${shortDate.format(parseLocalDate(period.to))}`
    : '';
  if (!period.label) return range || '—';
  return range && !period.label.includes(range) ? `${period.label} · ${range}` : period.label;
}

/** Объект отчёта: ученик с классом, класс или список классов. */
export function objectText(report: Pick<AiReportSummary, 'student' | 'classes'> | null | undefined): string {
  if (!report) return '—';
  const classes = (report.classes ?? []).map((item) => item.name).filter(Boolean).join(', ');
  if (report.student?.name) return classes ? `${report.student.name} · ${classes}` : report.student.name;
  return classes || '—';
}

export function subjectText(report: Pick<AiReportSummary, 'subject' | 'owner'> | null | undefined): string {
  if (report?.subject?.name) return report.subject.name;
  return report?.owner === 'HOMEROOM' ? 'Все предметы' : '—';
}

/** Заголовок шторки: «AI-сводка · Ахметова Дана», «AI-сводка · 8А · Математика». */
export function reportTitle(report: AiReportSummary | null | undefined): string {
  if (!report) return 'AI-сводка';
  if (report.student?.name) return `AI-сводка · ${report.student.name}`;
  const parts = [objectText(report), report.subject?.name].filter((part) => part && part !== '—');
  return ['AI-сводка', ...parts].join(' · ');
}

export function ownerLabel(owner: AiReportOwner | string | null | undefined, subject?: string | null, className?: string | null): string {
  if (owner === 'HOMEROOM') return className ? `Классный руководитель ${className}` : 'Классный руководитель';
  return subject ? `Учитель-предметник · ${subject}` : 'Учитель-предметник';
}

/** Событие истории — по-русски, с номером версии, если он известен. */
export function eventLabel(event: AiReportEvent, versionNumbers: Map<number, number>): string {
  const number = event.versionId != null ? versionNumbers.get(event.versionId) : undefined;
  const version = number == null ? 'версии' : `версии ${number}`;
  switch (event.kind) {
    case 'CREATED': return 'Отчёт создан';
    case 'GENERATION_REQUESTED': return 'Запущена генерация';
    case 'GENERATED': return number == null ? 'Сформирована новая версия' : `Сформирована версия ${number}`;
    case 'GENERATION_FAILED': return 'Генерация не удалась';
    case 'EDITED': return `Текст ${version} изменён`;
    case 'APPROVED': return number == null ? 'Версия утверждена' : `Версия ${number} утверждена`;
    case 'PARENT_SUMMARY_SAVED': return 'Сводка для родителя сохранена';
    case 'PARENT_SUMMARY_CONFIRMED': return 'Сводка для родителя утверждена';
    case 'PUBLISHED': return 'Опубликовано родителям';
    case 'UNPUBLISHED': return 'Публикация снята';
    default: return event.kind ?? 'Событие';
  }
}

export function versionOptionLabel(item: Schema<'AiReportVersionListItem'>): string {
  const status = item.status === 'APPROVED' ? `утверждена ${formatDate(item.approvedAt)}` : 'черновик';
  return `Версия ${item.number} · ${formatDate(item.createdAt)} · ${status}`;
}

// ---------------------------------------------------------------------------------------------
// Ошибки — по коду сервера, а не по HTTP-статусу
// ---------------------------------------------------------------------------------------------

const ERROR_TEXTS: Record<string, string> = {
  AI_REPORT_NOT_ACCESSIBLE: 'Нет доступа к выбранному классу, предмету или ученику.',
  AI_REPORT_NOT_FOUND: 'Отчёт не найден или больше недоступен.',
  AI_REPORT_TYPE_NOT_ALLOWED: 'Такой тип сводки недоступен в выбранной роли.',
  AI_REPORT_INVALID_PERIOD: 'Проверьте период: начало не может быть позже конца.',
  AI_REPORT_PERIOD_OUTSIDE_YEAR: 'Период должен быть внутри выбранного учебного года.',
  AI_REPORT_PERIOD_IN_FUTURE: 'Период не может заканчиваться позже сегодняшнего дня.',
  AI_REPORT_INSUFFICIENT_DATA: 'За выбранный период в журнале нет оценок, посещаемости и отзывов — сводку не из чего составить.',
  AI_REPORT_VERSION_CONFLICT: 'Отчёт изменён в другом окне.',
  AI_REPORT_NOT_APPROVED: 'Сначала утвердите текущую версию отчёта.',
  AI_REPORT_GENERATION_IN_PROGRESS: 'Сводка уже формируется.',
  AI_REPORT_NOT_PUBLISHABLE: 'Групповые отчёты родителям не публикуются.',
  AI_REPORT_PARENT_SUMMARY_NOT_CONFIRMED: 'Сначала утвердите текст для родителя.',
  AI_REPORT_PARENT_SUMMARY_OUTDATED: 'Текст для родителя построен по прежней версии отчёта — подготовьте его заново.',
  AI_REPORT_ALREADY_PUBLISHED: 'Отчёт уже опубликован. Сначала снимите действующую публикацию.',
  AI_REPORT_NOT_PUBLISHED: 'Публикация уже снята.',
  AI_REPORT_PARENT_PUBLICATION_DISABLED: 'Публикация родителям пока не включена в школе.',
  AI_REPORT_AI_DISABLED: 'AI-сводки сейчас выключены.',
  AI_REPORT_AI_QUOTA: 'Дневной лимит AI-сводок исчерпан. Попробуйте завтра.',
  AI_REPORT_AI_UNAVAILABLE: 'Сервис AI временно недоступен.',
  AI_REPORT_AI_TIMEOUT: 'AI не успел подготовить сводку.',
  AI_REPORT_AI_INVALID_RESPONSE: 'AI вернул ответ, который не удалось разобрать.',
  AI_REPORT_GENERATION_INTERRUPTED: 'Генерация прервана: права на класс изменились.',
};

export function aiErrorText(code: string | null | undefined, fallback = 'Не удалось выполнить действие.'): string {
  return (code && ERROR_TEXTS[code]) || fallback;
}

// ---------------------------------------------------------------------------------------------
// Период запроса
// ---------------------------------------------------------------------------------------------

export interface PeriodDraft {
  kind: AiPeriodKind;
  month: string;
  academicPeriodId: number | null;
  from: string;
  to: string;
}

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const monthName = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });

/** Месяцы учебного года до текущего включительно: будущий месяц выбирать незачем. */
export function yearMonths(start: string | undefined, end: string | undefined, today = todayIso()): { value: string; label: string }[] {
  if (!start || !end) return [];
  const last = end < today ? end : today;
  const result: { value: string; label: string }[] = [];
  let [year, month] = start.split('-').map(Number);
  const [lastYear, lastMonth] = last.split('-').map(Number);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    const value = `${year}-${String(month).padStart(2, '0')}`;
    const label = monthName.format(new Date(year, month - 1, 1)).replace(' г.', '');
    result.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return result.reverse();
}

/**
 * Подсказка до отправки: та же проверка, что сделает сервер, — чтобы кнопка не обещала
 * запуск, который вернётся отказом. Решает всё равно сервер.
 */
export function periodProblem(draft: PeriodDraft, yearStart?: string, yearEnd?: string, today = todayIso()): string | null {
  if (draft.kind === 'MONTH') return draft.month ? null : 'Выберите месяц.';
  if (draft.kind === 'ACADEMIC_PERIOD') return draft.academicPeriodId ? null : 'Выберите четверть.';
  if (!draft.from || !draft.to) return 'Укажите обе даты.';
  if (draft.from > draft.to) return 'Начало периода позже конца.';
  if (draft.to > today) return 'Период не может заканчиваться позже сегодняшнего дня.';
  if ((yearStart && draft.from < yearStart) || (yearEnd && draft.to > yearEnd)) return 'Даты должны быть внутри учебного года.';
  return null;
}

export function periodRequest(draft: PeriodDraft): Schema<'AiReportPeriodRequest'> {
  if (draft.kind === 'MONTH') return { kind: 'MONTH', month: draft.month };
  if (draft.kind === 'ACADEMIC_PERIOD') return { kind: 'ACADEMIC_PERIOD', academicPeriodId: draft.academicPeriodId ?? undefined };
  return { kind: 'CUSTOM', from: draft.from, to: draft.to };
}
