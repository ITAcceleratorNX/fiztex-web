import type { FinalGrade } from './gradebookApi';

export const FINAL_RESULT_LABELS = {
  NUMERIC: 'Числовая оценка',
  PASS: 'Зачёт',
  FAIL: 'Незачёт',
  TEMP_UNATTESTED: 'Временно не аттестован',
  NOT_STUDIED: 'Не изучался',
} as const;

export function finalResultLabel(grade: FinalGrade | null | undefined): string {
  if (!grade) return '—';
  return grade.resultKind && grade.resultKind !== 'NUMERIC'
    ? FINAL_RESULT_LABELS[grade.resultKind]
    : String(grade.value ?? '—');
}
