import type { BadgeTone } from '@/components/ui/Badge';
import type {
  PsychTestAssignment,
  PsychTestClassOption,
  PsychTestResultQuestion,
  PsychTestSavedAnswer,
  PsychTestStudentResult,
} from '@/lib/psychTestsApi';

/**
 * Правила экранов назначения психотестов (PSYCHOLOGIST-002) — подписи, группировка и сборка
 * ответа в строку. Решений о доступе здесь нет: «идёт ли приём» приходит посчитанным
 * (`acceptingAnswers`), и экран его не пересобирает из статуса и срока.
 */

export type PsychResponseStatus = NonNullable<PsychTestStudentResult['status']>;

export interface PsychClassGroup {
  grade: string;
  classes: { id: number; name: string; studentsCount: number }[];
}

/**
 * Классы по параллелям для `ClassGradePicker`. Сортировка «числом» (`numeric`), а не
 * строкой: иначе 10-е и 11-е встали бы между 1-м и 2-м.
 */
export function groupPsychClassesByGrade(options: PsychTestClassOption[]): PsychClassGroup[] {
  const byGrade = new Map<string, PsychTestClassOption[]>();
  for (const option of options) {
    if (option.id == null) continue;
    const grade = option.grade ?? '';
    byGrade.set(grade, [...(byGrade.get(grade) ?? []), option]);
  }
  return [...byGrade.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ru', { numeric: true }))
    .map(([grade, group]) => ({
      grade,
      classes: [...group]
        .sort((a, b) => (a.letter ?? a.name ?? '').localeCompare(b.letter ?? b.name ?? '', 'ru'))
        .map((c) => ({ id: c.id as number, name: c.name ?? '', studentsCount: c.studentsCount ?? 0 })),
    }));
}

/**
 * Состояние назначения одним словом. Истёкший срок статус на сервере не меняет — поэтому
 * «срок истёк» выводится из `acceptingAnswers=false` при статусе `ACTIVE`, а не из дат.
 */
export function assignmentState(assignment: PsychTestAssignment): { label: string; tone: BadgeTone } {
  if (assignment.status === 'CLOSED') return { label: 'Приём закрыт', tone: 'gray' };
  if (assignment.acceptingAnswers) return { label: 'Идёт приём', tone: 'green' };
  return { label: 'Срок истёк', tone: 'amber' };
}

/** Слова без рода: строка результата — про ученика, чей пол экран не знает. */
export const RESPONSE_STATUS: Record<PsychResponseStatus, { label: string; tone: BadgeTone }> = {
  NOT_STARTED: { label: 'Не начато', tone: 'gray' },
  IN_PROGRESS: { label: 'В процессе', tone: 'amber' },
  COMPLETED: { label: 'Пройдено', tone: 'green' },
};

export function progressLabel(assignment: PsychTestAssignment): string {
  return `Пройдено: ${assignment.completedCount ?? 0} из ${assignment.recipientsTotal ?? 0}`;
}

export function classesLabel(assignment: PsychTestAssignment): string {
  return (assignment.classes ?? []).map((c) => c.name).filter(Boolean).join(', ');
}

/**
 * Ответ ученика одной строкой. У вопроса с выбором — тексты вариантов в порядке вопроса, а не
 * в порядке нажатий; вариант, которого в вопросе больше нет, пропускается. Пустой ответ —
 * `null`, чтобы экран сам решил, как показать «нет ответа».
 */
export function answerLabel(
  question: PsychTestResultQuestion,
  answer: PsychTestSavedAnswer | undefined,
): string | null {
  if (!answer) return null;
  if (question.type === 'SINGLE_CHOICE' || question.type === 'MULTIPLE_CHOICE') {
    const selected = new Set(answer.selectedOptionIds ?? []);
    const texts = (question.options ?? [])
      .filter((option) => option.id != null && selected.has(option.id))
      .map((option) => option.text ?? '');
    return texts.length > 0 ? texts.join('; ') : null;
  }
  const text = answer.openText?.trim();
  return text ? text : null;
}

/** `datetime-local` — местное время без зоны, а срок уходит на сервер моментом. */
export function deadlineToIso(localValue: string): string | undefined {
  if (!localValue) return undefined;
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function isDeadlineInPast(localValue: string, now: Date = new Date()): boolean {
  const iso = deadlineToIso(localValue);
  return iso != null && new Date(iso).getTime() <= now.getTime();
}
