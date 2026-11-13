import type { FinalGrade } from './gradebookApi';

type FinalResultKind = NonNullable<FinalGrade['resultKind']>;

/**
 * Подписи видов итога. `Record` по типу API, а не `as const`: новый вид результата на бэке
 * (как `NOT_ATTESTED`, ATTESTATION-001) роняет проверку типов здесь, а не показывает пустую
 * подпись на экране.
 */
export const FINAL_RESULT_LABELS: Record<FinalResultKind, string> = {
  NUMERIC: 'Числовая оценка',
  PASS: 'Зачёт',
  FAIL: 'Незачёт',
  TEMP_UNATTESTED: 'Временно не аттестован',
  NOT_ATTESTED: 'Не аттестован',
  NOT_STUDIED: 'Не изучался',
};

export function finalResultLabel(grade: FinalGrade | null | undefined): string {
  if (!grade) return '—';
  return grade.resultKind && grade.resultKind !== 'NUMERIC'
    ? FINAL_RESULT_LABELS[grade.resultKind]
    : String(grade.value ?? '—');
}
