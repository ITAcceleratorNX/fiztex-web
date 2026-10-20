import type { Schema } from './apiSchemas';
import type { KtpContent } from './ktpApi';
import { issueMatchesTopic, ktpRows } from './ktpModel';

export type KtpIssue = Schema<'KtpIssue'>;

const fieldLabels: Record<string, string> = {
  title: 'Название',
  learningObjectives: 'Цели обучения',
  plannedDates: 'Плановые сроки',
  plannedHours: 'Часы',
  recommendations: 'Рекомендации / виды деятельности',
  notes: 'Примечания',
  sourceNumber: 'Номер в документе',
  declaredHours: 'Часы по документу',
  declaredAnnualHours: 'Часы за год',
  declaredWeeklyHours: 'Часов в неделю',
  subject: 'Предмет',
  academicYear: 'Учебный год',
  teacherName: 'Учитель',
  classNames: 'Классы в документе',
};

export const isOptionalKtpIssue = (issue: KtpIssue) => issue.severity === 'WARNING' && issue.code === 'OPTIONAL_FIELD_MISSING';
export function ktpIssueFieldLabel(issue: KtpIssue) {
  return fieldLabels[issue.fieldPath?.split('.').at(-1) ?? ''] ?? 'Поле документа';
}
function visibleValue(value?: string) {
  const text = value?.trim();
  return text && !['null', 'undefined'].includes(text.toLowerCase()) ? text : undefined;
}
export function ktpIssueTopic(issue: KtpIssue, content?: KtpContent) {
  const matches = ktpRows(content).filter(row => issueMatchesTopic(issue, row.topic));
  return matches.length === 1 ? matches[0] : undefined;
}
export function ktpIssueContext(issue: KtpIssue, content?: KtpContent) {
  const row = ktpIssueTopic(issue, content);
  if (row) return `Тема № ${row.topic.sourceNumber || row.topic.order}${row.topic.title?.trim() ? ` «${row.topic.title.trim()}»` : ''}`;
  // The API uses topic.order here, rather than a zero-based array index.
  const topicOrder = issue.fieldPath?.match(/^topics\[(-?\d+)\]/)?.[1];
  if (topicOrder) return `Тема № ${topicOrder}`;
  const periodOrder = issue.fieldPath?.match(/^periods\[(-?\d+)\]/)?.[1];
  const period = content?.periods?.find(p => p.order === Number(periodOrder));
  const sectionOrder = issue.fieldPath?.match(/\.sections\[(-?\d+)\]/)?.[1];
  const section = period?.sections?.find(s => s.order === Number(sectionOrder));
  if (periodOrder) return [period?.title || `Период № ${periodOrder}`, sectionOrder ? section?.title || `Раздел № ${sectionOrder}` : undefined].filter(Boolean).join(' · ');
  if (issue.fieldPath?.startsWith('header.')) return `Данные из шапки документа · ${ktpIssueFieldLabel(issue)}`;
  const source = issue.source;
  return [source?.sheetName ? `Лист «${source.sheetName}»` : undefined, source?.tableNumber != null ? `Таблица ${source.tableNumber}` : undefined,
    source?.rowNumber != null ? `Строка ${source.rowNumber}` : undefined, source?.columnNumber != null ? `Столбец ${source.columnNumber}` : undefined].filter(Boolean).join(' · ');
}
export function ktpIssueDescription(issue: KtpIssue) {
  const actual = visibleValue(issue.actual);
  const expected = visibleValue(issue.expected);
  if (isOptionalKtpIssue(issue)) return { message: `Не заполнено поле «${ktpIssueFieldLabel(issue)}». Его можно оставить пустым или дополнить вручную.`, values: '' };
  if (issue.code === 'TOTAL_HOURS_MISMATCH') return {
    message: 'Количество часов по темам отличается от указанного в документе. Проверьте часы или подтвердите расхождение.',
    values: [actual ? `По темам: ${actual} ч` : undefined, expected ? `В документе: ${expected} ч` : undefined].filter(Boolean).join(' · '),
  };
  return {
    message: issue.message || 'Проверьте данные в документе.',
    values: [actual ? `В файле: ${actual}` : undefined, expected && !issue.code?.startsWith('TOPIC_HOURS_') ? `Ожидается: ${expected}` : undefined].filter(Boolean).join(' · '),
  };
}
export function optionalKtpIssueGroups(issues: KtpIssue[]) {
  const groups = new Map<string, KtpIssue[]>();
  for (const issue of issues.filter(isOptionalKtpIssue)) {
    const label = ktpIssueFieldLabel(issue);
    const group = groups.get(label);
    if (group) group.push(issue);
    else groups.set(label, [issue]);
  }
  return [...groups].map(([label, items]) => ({ label, issues: items }));
}
