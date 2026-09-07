import type { TeacherAnswer } from '@/lib/homeworkAiApi';

/** Черновик решения учителя. Комментарий пока не редактируется на этом экране, но
 * сохраняется при смене балла, чтобы существующие данные не исчезли молча. */
export interface AnswerScoreDraft {
  score: string;
  comment: string;
}

export type AnswerScoreDrafts = Record<number, AnswerScoreDraft>;

export function scoreDraftFrom(answer: TeacherAnswer): AnswerScoreDraft {
  return {
    score: scoreString(answer.finalScore),
    comment: answer.teacherComment ?? '',
  };
}

/**
 * Сервер может обновить ответ, пока учитель смотрит страницу (например, готова
 * подсказка ИИ). Несохранённый ввод нельзя затереть таким refetch, поэтому берём
 * серверное значение только для чистого поля.
 */
export function mergeScoreDrafts(
  answers: TeacherAnswer[],
  previous: AnswerScoreDrafts,
): AnswerScoreDrafts {
  return answers.reduce<AnswerScoreDrafts>((next, answer) => {
    if (answer.id == null) return next;
    const current = previous[answer.id];
    next[answer.id] = current && isScoreDraftDirty(current, answer) ? current : scoreDraftFrom(answer);
    return next;
  }, {});
}

export function isScoreDraftDirty(draft: AnswerScoreDraft, answer: TeacherAnswer): boolean {
  return (
    normaliseScore(draft.score) !== normaliseScore(scoreString(answer.finalScore)) ||
    draft.comment !== (answer.teacherComment ?? '')
  );
}

/** Возвращает null, пока поле пустое или некорректное. Бэк проверяет то же самое повторно. */
export function scoreFromDraft(draft: AnswerScoreDraft, maximum: number | undefined): number | null {
  if (!draft.score.trim()) return null;
  const score = Number(draft.score);
  const max = maximum ?? 0;
  if (!Number.isFinite(score) || score < 0 || score > max) return null;
  return score;
}

function scoreString(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

/** `1.50` и `1.5` — одно и то же решение; после refetch не надо показывать ложную правку. */
function normaliseScore(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const score = Number(trimmed);
  return Number.isFinite(score) ? String(score) : trimmed;
}
