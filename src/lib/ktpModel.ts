import type { KtpContent, KtpOrigin, KtpTopic } from './ktpApi';

export const ktpPaths = {
  list: '/workspace/ktp',
  import: (id: number) => `/workspace/ktp/imports/${id}`,
  draft: (id: number) => `/workspace/ktp/drafts/${id}`,
  binding: (id: number) => `/workspace/ktp/bindings/${id}`,
};
/**
 * КТП-COPY: подпись источника копии — «КТП 8A · 2026–2027», или `null`, если КТП из файла.
 * Одна на все экраны: черновик, список, карточку и подсказку сроков.
 */
export function copiedFromLabel(origin?: KtpOrigin | null) {
  if (origin?.type !== 'COPY') return null;
  const from = origin.copiedFrom;
  return ['КТП', [from?.className, from?.academicYear?.replace('/', '–')].filter(Boolean).join(' · ')].filter(Boolean).join(' ');
}
export const runningKtp = (status?: string) => ['QUEUED', 'RUNNING', 'RETRY_WAIT', 'PROCESSING'].includes(status ?? '');
export function ktpCount(value: number, forms: [string, string, string]) {
  const last = value % 10, lastTwo = value % 100;
  return `${value} ${forms[lastTwo >= 11 && lastTwo <= 14 ? 2 : last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2]}`;
}
export const ktpHours = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 4 }).format(value);
export function ktpWorkLabels(title = '') {
  const labels: string[] = [];
  if (/СОЧ|суммативное оценивание за четверть/i.test(title)) labels.push('СОЧ');
  const sor = title.match(/СОР\s*[№#]?\s*(\d+)?/i); if (sor) labels.push(`СОР${sor[1] ? ` ${sor[1]}` : ''}`);
  const lab = title.match(/лабораторн\S* работ\S*\s*[№#]?\s*(\d+)?/i); if (lab) labels.push(`ЛР${lab[1] ? ` ${lab[1]}` : ''}`);
  if (/моделирование/i.test(title)) labels.push('Моделирование');
  return labels;
}
export function ktpRows(content?: KtpContent) {
  return (content?.periods ?? []).flatMap((period, pi) => (period.sections ?? []).flatMap((section, si) =>
    (section.topics ?? []).map((topic, ti) => ({ period, section, topic, pi, si, ti }))));
}
export function updateKtpTopic(content: KtpContent, pi: number, si: number, ti: number, topic: KtpTopic): KtpContent {
  return { ...content, periods: content.periods?.map((period, p) => p !== pi ? period : {
    ...period, sections: period.sections?.map((section, s) => s !== si ? section : {
      ...section, topics: section.topics?.map((value, t) => t === ti ? topic : value),
    }),
  }) };
}
export function issueMatchesTopic(issue: NonNullable<KtpContent['issues']>[number], topic: KtpTopic) {
  if (issue.fieldPath && /^(periods(?:\[|$)|header(?:\.|$)|candidates(?:\[|$))/.test(issue.fieldPath)) return false;
  const order = issue.fieldPath?.match(/^topics\[(-?\d+)\](?:\.|$)/)?.[1];
  if (order != null && topic.order !== Number(order)) return false;
  if (order != null && (issue.source?.rowNumber == null || topic.source?.rowNumber == null)) return true;
  return issue.source?.rowNumber != null && issue.source.rowNumber === topic.source?.rowNumber
    && issue.source.tableNumber === topic.source?.tableNumber && issue.source.sheetName === topic.source?.sheetName;
}
export const bindingStateLabel = (state?: string) => state === 'AWAITING_INITIAL_SYNC' ? 'Проверьте прогресс'
  : state === 'AWAITING_VERSION_SYNC' ? 'Сверьте новую версию' : state === 'ARCHIVED' ? 'Удалён' : 'Активен';
export const topicStatusLabel = (status?: string) => status === 'COMPLETED' ? 'Пройдена'
  : status === 'IN_PROGRESS' ? 'Частично' : 'Не пройдена';

export const allocationMessages: Record<string, string> = {
  MANUAL_LESSON_TOPIC_PRESENT: 'В части уроков тема указана вручную. КТП её сохраняет; изменить или вернуть плановую тему можно в карточке урока.',
  PARTIAL_SCHEDULE_HORIZON: 'Часть тем пока не привязана к урокам. Проверьте опубликованное расписание и доступность распределения.',
  FRACTIONAL_HOURS_REQUIRE_REVIEW: 'В плане есть дробные часы. Проверьте их распределение по урокам.',
  RESERVATIONS_EXCEED_PLAN: 'Назначенных часов больше, чем предусмотрено планом. Проверьте прогресс и темы уроков.',
  GAP_BEFORE_RESERVED_SEQUENCE: 'Перед ранее назначенными темами появились новые уроки. Проверьте темы этих уроков вручную.',
  ASSIGNMENT_SCOPE_CHANGED: 'У части назначенных уроков изменился класс или предмет. Проверьте их темы.',
  SUPERSEDED_ASSIGNMENT_REVIEW_REQUIRED: 'Часть уроков перенесена или заменена. Проверьте связь с темами КТП.',
  ACCESS_REVOKED: 'Доступ к назначению КТП изменился. Обновите страницу.',
  PARTIAL_SUCCESSOR_HORIZON: 'Расписание после переноса уроков ещё формируется. Проверьте темы, когда появятся новые уроки.',
  SUCCESSOR_ALREADY_ASSIGNED: 'У нового урока уже есть тема. Проверьте её вручную.',
  SUCCESSOR_HISTORY_REVIEW_REQUIRED: 'Проведённый урок изменился после обновления расписания. Проверьте его тему и прогресс.',
  SUCCESSOR_MANUAL_REVIEW_REQUIRED: 'При переносе сохранены ручные изменения. Проверьте тему нового урока.',
  SUCCESSOR_SCOPE_REVIEW_REQUIRED: 'У перенесённого урока изменился класс или предмет. Проверьте назначенную тему.',
  SUCCESSOR_VERSION_REVIEW_REQUIRED: 'У перенесённого урока отличается версия КТП. Проверьте его тему.',
};

type HoursOverage = {
  plannedHours?: number; assignedHours?: number; conductedLessonHours?: number; upcomingLessonHours?: number;
  otherLessonHours?: number; extraHours?: number; excessHours?: number;
};

/**
 * Откуда взялись лишние часы темы (UX-03): те же числа, что посчитал бэкенд, словами.
 * Правило подсчёта не меняется, и ручной прогресс не выдаётся за проведённый урок —
 * поэтому «учтено вручную» называется отдельно от уроков.
 */
export function overageParts(o: HoursOverage): string[] {
  const parts = [`по плану ${ktpHours(o.plannedHours ?? 0)} ч`];
  const lessons = [
    o.conductedLessonHours ? `проведено ${ktpHours(o.conductedLessonHours)}` : null,
    o.upcomingLessonHours ? `впереди ${ktpHours(o.upcomingLessonHours)}` : null,
    o.otherLessonHours ? `в отменённых или перенесённых ${ktpHours(o.otherLessonHours)}` : null,
  ].filter(Boolean);
  parts.push(`назначено на уроки ${ktpHours(o.assignedHours ?? 0)} ч${lessons.length ? ` (${lessons.join(', ')})` : ''}`);
  if (o.extraHours) parts.push(`учтено без урока по плану ${ktpHours(o.extraHours)} ч`);
  return parts;
}

export function overageReason(o: HoursOverage): string {
  if ((o.extraHours ?? 0) > 0) {
    return 'Часть часов темы учтена без урока по плану — начальный прогресс, ручная корректировка или фактическая тема другого урока, — а уроки по плану на неё уже назначены.';
  }
  if ((o.otherLessonHours ?? 0) > 0) {
    return 'Отменённые и перенесённые уроки сохраняют назначенную тему, поэтому часы на тему назначены дважды.';
  }
  return 'На тему назначено больше уроков, чем часов в плане: проверьте темы этих уроков.';
}
