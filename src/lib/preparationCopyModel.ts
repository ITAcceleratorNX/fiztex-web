import type { PreparationCopyContent, PreparationCopyPreview, PreparationCopyResult } from './lessonPreparationApi';
import { formatWeekdayDayMonth, pluralRu } from './format';
import type { Lesson } from './lessonsApi';
import { pagesLabel } from './textbookModel';

/**
 * Слова окна «Использовать повторно» (перенос подготовки урока на другой урок).
 *
 * Что переносится и можно ли, решает бэкенд (`GET …/preparation/copy`): экран только
 * называет пришедшее. Поэтому здесь нет ни одной проверки прав или периода — лишь подписи.
 */

function materialsLabel(count: number): string {
  return `${count} ${pluralRu(count, ['материал', 'материала', 'материалов'])}`;
}

function textbookLabel(content: PreparationCopyContent): string {
  return [content.textbookTitle, pagesLabel(content.pageFrom, content.pageTo)].filter(Boolean).join(', ');
}

export interface CopyItem {
  label: string;
  value: string;
  /** Пункт есть в источнике, но в этот урок не перейдёт. */
  skipped?: boolean;
}

/** Что уйдёт в копию — только то, что в исходном уроке заполнено. */
export function copyItems(preview: PreparationCopyPreview): CopyItem[] {
  const source = preview.source ?? {};
  const items: CopyItem[] = [];
  if (source.topic) items.push({ label: 'Тема', value: source.topic });
  if (source.hasSummary) items.push({ label: 'Конспект', value: source.summaryTitle || 'черновик конспекта' });
  if (source.hasComment) items.push({ label: 'Комментарий', value: 'для учеников' });
  if (source.materialCount) items.push({ label: 'Материалы', value: materialsLabel(source.materialCount) });
  if (source.textbookId != null) {
    items.push(preview.textbookTransferable
      ? { label: 'Учебник', value: textbookLabel(source) }
      : { label: 'Учебник', value: `${textbookLabel(source)} — не назначен этому классу на дату урока`, skipped: true });
  }
  return items;
}

/** Что уже лежит в выбранном уроке — для предупреждения перед заменой. */
export function existingSummary(content: PreparationCopyContent | undefined): string {
  if (!content) return '';
  return [
    content.topic && `тема «${content.topic}»`,
    content.hasSummary && 'конспект',
    content.hasComment && 'комментарий',
    content.materialCount ? materialsLabel(content.materialCount) : null,
    content.textbookId != null && 'учебник',
  ].filter(Boolean).join(', ');
}

export function blockedMessage(reason: PreparationCopyPreview['blockedReason']): string | null {
  switch (reason) {
    case 'SAME_LESSON': return 'Это тот же урок — выберите другой.';
    case 'NOTHING_TO_COPY': return 'В этом уроке пока нечего переносить: нет ни темы, ни конспекта, ни материалов.';
    case 'TARGET_LOCKED': return 'Выбранный урок сейчас нельзя изменить: его ведёте не вы или учебный период закрыт.';
    default: return null;
  }
}

/** «7А · Группа 1» — кто сидит на уроке. */
export function lessonAudience(lesson: Pick<Lesson, 'className' | 'subgroupName'>): string {
  return [lesson.className, lesson.subgroupName].filter(Boolean).join(' · ');
}

/** «Понедельник, 12 октября · 2-й урок · 09:00–09:45». */
export function lessonWhen(lesson: Pick<Lesson, 'date' | 'lessonNumber' | 'startTime' | 'endTime'>): string {
  const time = lesson.startTime ? `${lesson.startTime.slice(0, 5)}–${(lesson.endTime ?? '').slice(0, 5)}` : null;
  return [lesson.date && formatWeekdayDayMonth(lesson.date),
    lesson.lessonNumber != null && `${lesson.lessonNumber}-й урок`, time].filter(Boolean).join(' · ');
}

/** Итог после сохранения: что легло в урок. Пустой — копия уже была сделана раньше. */
export function copyResultMessage(result: PreparationCopyResult): string {
  const parts = [
    result.topicCopied && 'тема',
    result.summaryCopied && 'конспект',
    result.commentCopied && 'комментарий',
    result.addedMaterials ? materialsLabel(result.addedMaterials) : null,
    result.textbookCopied && 'учебник',
  ].filter(Boolean);
  return parts.length > 0
    ? `Перенесено: ${parts.join(', ')}.`
    : 'Эта подготовка уже была в уроке — ничего не изменилось.';
}
