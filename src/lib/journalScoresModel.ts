import { pluralRu } from '@/lib/format';
import type { AssessmentKind } from '@/lib/assessmentWorksApi';

/**
 * Ввод баллов СОР/СОЧ прямо в журнале (ТЗ Frontend «СОР/СОЧ», §3; Figma D13–D17).
 *
 * <p>Правки копятся черновиками и уходят одним действием «Сохранить баллы». Здесь только
 * проверка ввода и сборка списка изменений: допустимость (права, период, максимум) решает
 * сервер. Отсутствие значения не равно нулю: пустое поле — «не менять», ноль — результат.
 */

export type WorkSheet = {
  workId: number;
  kind: AssessmentKind;
  maxScore: number;
  canManage: boolean;
  /** studentProfileId → сохранённый балл и версия строки результата. */
  students: Map<number, { score: number | null; version: number | null; inAudience: boolean }>;
};

export type ScoreChange = {
  key: string;
  workId: number;
  kind: AssessmentKind;
  studentProfileId: number;
  score: number;
  /** Прежний балл; `null` — выставляется впервые. */
  before: number | null;
  version: number | null;
};

export const draftKey = (workId: number, studentProfileId: number) => `${workId}:${studentProfileId}`;

/** Что не так с введённым текстом; `null` — допустимо или поле пусто («не менять»). */
export function scoreDraftProblem(text: string, maxScore: number): string | null {
  const value = text.trim();
  if (value === '') return null;
  if (!/^-?\d+$/.test(value)) return 'Только целое число';
  const number = Number(value);
  if (number < 0) return 'Не меньше 0';
  if (number > maxScore) return `Не больше ${maxScore}`;
  return null;
}

/**
 * Изменения из черновиков. Совпавший с сохранённым балл и пустое поле изменением не
 * считаются; ошибочные черновики попадают в `invalid` и блокируют сохранение.
 */
export function collectChanges(
  drafts: ReadonlyMap<string, string>,
  sheets: ReadonlyMap<number, WorkSheet>,
): { changes: ScoreChange[]; invalid: string[] } {
  const changes: ScoreChange[] = [];
  const invalid: string[] = [];
  for (const [key, text] of drafts) {
    const [workId, studentId] = key.split(':').map(Number);
    const sheet = sheets.get(workId);
    if (!sheet) continue;
    if (scoreDraftProblem(text, sheet.maxScore)) {
      invalid.push(key);
      continue;
    }
    if (text.trim() === '') continue;
    const current = sheet.students.get(studentId);
    const score = Number(text.trim());
    if (current?.score === score) continue;
    changes.push({
      key,
      workId,
      kind: sheet.kind,
      studentProfileId: studentId,
      score,
      before: current?.score ?? null,
      version: current?.version ?? null,
    });
  }
  return { changes, invalid };
}

/** Исправление СОЧ требует причину — по ТЗ «Исправление результатов СОЧ». */
export function needsReason(changes: ScoreChange[]): boolean {
  return changes.some((change) => change.kind === 'SOCH' && change.before != null);
}

/** Текст закреплённой панели: «Изменено 3 балла · ещё не сохранены» (D14/D15/D17). */
export function barMessage(changes: ScoreChange[], invalidCount: number): string | null {
  if (invalidCount > 0) return 'Исправьте ошибку, чтобы сохранить';
  if (changes.length === 0) return null;
  const n = changes.length;
  const noun = pluralRu(n, ['балл', 'балла', 'баллов']);
  const head = n === 1 ? `Изменён 1 ${noun}` : `Изменено ${n} ${noun}`;
  return changes.some((change) => change.before != null)
    ? `${head} · исправление попадёт в историю`
    : `${head} · ещё не сохранены`;
}
