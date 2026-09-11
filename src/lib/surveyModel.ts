import type { Survey, SurveyStatus } from '@/lib/surveyApi';

/**
 * Слова статуса опроса одним местом на весь веб — как `sheetStateLabel` у посещаемости
 * и `homeworkStateLabel` у ДЗ. Мобилке предстоит показывать то же самое, и разъехаться
 * им нельзя: строки дословные, не переформулировать по месту.
 */
export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активен',
  COMPLETED: 'Завершён',
};

export function surveyStatusLabel(status: SurveyStatus | null | undefined): string {
  return status ? SURVEY_STATUS_LABELS[status] : SURVEY_STATUS_LABELS.DRAFT;
}

/**
 * Предусловия публикации (§ ТЗ на `POST /publish`), пересказанные здесь только для того,
 * чтобы заранее выключить кнопку — не чтобы заменить проверку сервера. Сервер остаётся
 * источником истины: 409 с `SURVEY_NO_QUESTIONS` / `SURVEY_NO_AUDIENCE` / `SURVEY_NO_TARGET`
 * по-прежнему возможен и обрабатывается отдельно.
 */
export function canPublishSurvey(survey: Survey | null | undefined): boolean {
  if (!survey || survey.status !== 'DRAFT') return false;
  return (
    (survey.questionCount ?? 0) > 0 &&
    (survey.audienceClassIds?.length ?? 0) > 0 &&
    Boolean(survey.targetsStudents || survey.targetsParents)
  );
}

/**
 * Почему публикация выключена — рядом с кнопкой, а не после отказа сервера: три причины
 * не исключают друг друга, и молчащая кнопка читалась бы как поломка.
 */
export function publishBlockedReason(survey: Survey | null | undefined): string | null {
  if (!survey || survey.status !== 'DRAFT') return null;
  const missing: string[] = [];
  if (!(survey.questionCount ?? 0)) missing.push('добавьте хотя бы один вопрос');
  if (!(survey.audienceClassIds?.length ?? 0)) missing.push('выберите хотя бы один класс');
  if (!(survey.targetsStudents || survey.targetsParents)) {
    missing.push('включите получателей — учеников или родителей');
  }
  if (missing.length === 0) return null;
  return `Нельзя опубликовать: ${missing.join(', ')}.`;
}
