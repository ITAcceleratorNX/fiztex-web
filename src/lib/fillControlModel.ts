import type {
  FillAssessmentProblem,
  FillAttendanceProblem,
  FillControlLesson,
  FillProblemType,
} from '@/lib/fillControlApi';

/**
 * Слова и адреса экрана «Незаполненное» (Figma `phyztex` 2857:3279). Ничего не считается:
 * сколько не хватает, что считается проблемой и что можно править, приходит с сервера.
 */

export type FillTone = 'danger' | 'warning';

/** «Не отмечена» — никто; «Не отмечено: 3 из 10» — часть (макет У1). */
export function attendanceCaption(problem: FillAttendanceProblem): { text: string; tone: FillTone } {
  const missing = problem.missing ?? 0;
  const expected = problem.expected ?? 0;
  return problem.status === 'NOT_FILLED' || (problem.filled ?? 0) === 0
    ? { text: 'Не отмечена', tone: 'danger' }
    : { text: `Не отмечено: ${missing} из ${expected}`, tone: 'warning' };
}

/** «Результаты не внесены» — никто; «Не заполнено: 3 из 10» — часть. «н/в» заполненным считается. */
export function workCaption(problem: FillAssessmentProblem): { text: string; tone: FillTone } {
  const missing = problem.missing ?? 0;
  const expected = problem.expected ?? 0;
  return problem.status === 'NOT_FILLED' || ((problem.scored ?? 0) + (problem.notTaken ?? 0)) === 0
    ? { text: 'Результаты не внесены', tone: 'danger' }
    : { text: `Не заполнено: ${missing} из ${expected}`, tone: 'warning' };
}

export function workTitle(problem: FillAssessmentProblem): string {
  const kind = problem.kind === 'SOCH' ? 'СОЧ' : 'СОР';
  return problem.kind === 'SOR' && problem.number ? `${kind} ${problem.number}` : kind;
}

/** Глагол ссылки: «Отметить» / «Внести баллы» — только при `canEdit`, иначе просмотр. */
export function actionLabel(type: FillProblemType, canEdit: boolean | undefined): string {
  if (!canEdit) return 'Открыть';
  return type === 'ATTENDANCE' ? 'Отметить' : 'Внести баллы';
}

export function attendanceHref(lessonId: number): string {
  return `/lesson-schedule/lessons/${lessonId}/attendance`;
}

/** Колонка работы живёт в журнале класса: адрес сужает его до класса, предмета и четверти урока. */
export function workHref(lesson: FillControlLesson): string {
  const params = new URLSearchParams();
  if (lesson.classId != null) params.set('classId', String(lesson.classId));
  if (lesson.subjectId != null) params.set('subjectId', String(lesson.subjectId));
  if (lesson.subgroupId != null) params.set('subgroupId', String(lesson.subgroupId));
  if (lesson.academicPeriodId != null) params.set('periodId', String(lesson.academicPeriodId));
  return `/grades?${params.toString()}`;
}

/** Состояние перехода: откуда пришли, чтобы «← К незаполненным» вернул фильтры и страницу. */
export type FillControlBackState = { fillControlBack?: { to: string; label: string } };

export function backTarget(state: unknown): { to: string; label: string } | null {
  const back = (state as FillControlBackState | null)?.fillControlBack;
  return back && typeof back.to === 'string' ? back : null;
}

export const PROBLEM_OPTIONS = [
  { value: 'ALL', label: 'Всё' },
  { value: 'ATTENDANCE', label: 'Посещаемость' },
  { value: 'ASSESSMENT', label: 'СОР/СОЧ' },
] as const;

export type ProblemFilter = (typeof PROBLEM_OPTIONS)[number]['value'];

export function problemFromParam(value: string | null): ProblemFilter {
  return value === 'ATTENDANCE' || value === 'ASSESSMENT' ? value : 'ALL';
}

/** Заметка на строке закрытой четверти и чужого урока: причину называет сервер. */
export function blockedNote(lesson: FillControlLesson): string | null {
  return lesson.canEdit ? null : (lesson.editBlockedMessage ?? null);
}
