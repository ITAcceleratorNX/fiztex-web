import { AlertTriangle, History, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { currentResult, fullResultLabel, shortResultLabel } from '@/lib/attestationModel';
import { FINAL_RESULT_LABELS } from '@/lib/finalGradeResult';
import type { ClassFinalGradeRow, ClassFinalGrades, FinalGrade } from '@/lib/gradebookApi';
import { formatAverage } from '@/lib/journalModel';
import { finalValueOptions } from './QuarterFinalsTable';

/**
 * Годовая, экзаменационная и окончательная оценки — прежние правила (§9, GRADES-003): одна ячейка
 * итога, особые результаты кнопками, опубликованное закрыто, кроме снятия годового ВНА числом.
 * Статусы ВНА/НА четверти и её макет (2209:178) сюда не относятся: НА в годовой не бывает (В5).
 */
export function YearFinalsTable({
  finals,
  scope,
  busyStudentId,
  rowError,
  onPick,
  onPickResult,
  onCorrect,
  onOpenHistory,
}: {
  finals: ClassFinalGrades;
  scope: FinalGrade['scope'];
  busyStudentId: number | null;
  rowError: { studentProfileId: number; message: string } | null;
  onPick: (row: ClassFinalGradeRow, value: number) => void;
  onPickResult: (row: ClassFinalGradeRow, kind: NonNullable<FinalGrade['resultKind']>) => void;
  onCorrect: (row: ClassFinalGradeRow) => void;
  onOpenHistory: (row: ClassFinalGradeRow) => void;
}) {
  const rows = finals.rows ?? [];
  const options = finalValueOptions(finals);
  const otherKinds = (finals.allowedResultKinds ?? []).filter((kind) => kind !== 'NUMERIC');
  const numeric = !finals.assessmentMode || finals.assessmentMode === 'NUMERIC';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="w-[320px] px-6 py-3 text-left text-11 font-bold uppercase text-slate-400">ФИО Ученика</th>
            <th className="px-6 py-3 text-center text-11 font-bold uppercase text-slate-400">
              {scope === 'YEAR' ? 'Средняя по периодам' : 'Средний балл'}
            </th>
            <th className="px-6 py-3 text-center text-11 font-bold uppercase text-slate-400">Рекомендованная оценка</th>
            <th className="px-6 py-3 text-center text-11 font-bold uppercase text-slate-400">Итоговая оценка</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const studentId = row.studentProfileId as number;
            const grade = row.finalGrade ?? null;
            const current = currentResult(grade);
            const published = grade?.status === 'PUBLISHED';
            // Пилот 3.1/3.2: опубликованный годовой ВНА снимается только положительным итогом.
            const values = published && grade?.resultKind === 'TEMP_UNATTESTED' ? (finals.positiveValues ?? options) : options;
            const busy = busyStudentId === studentId;
            return (
              <tr key={studentId} className="border-b border-slate-200 last:border-b-0">
                <td className="px-6 py-3 text-slate-900">{row.studentName}</td>
                <td className="px-6 py-3 text-center font-semibold text-slate-900">{formatAverage(row.average)}</td>
                <td className="px-6 py-3 text-center">
                  {row.recommendedValue ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-6 py-3">
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex items-center gap-2">
                      {row.canEditResult && numeric ? (
                        <SegmentedChoice
                          ariaLabel={`Итог: ${row.studentName ?? ''}`}
                          options={values.map((value) => ({ value, label: String(value) }))}
                          selected={current?.kind === 'NUMERIC' ? current.value : null}
                          disabled={busy}
                          onChoose={(value) => { if (!(current?.kind === 'NUMERIC' && current.value === value)) onPick(row, value); }}
                        />
                      ) : (
                        <span className="flex items-center gap-2 text-15 font-bold text-slate-900" title={fullResultLabel(current)}>
                          {(row.yearLocked || published) && <Lock className="size-4 text-slate-400" aria-label="Итог опубликован" />}
                          {shortResultLabel(current)}
                        </span>
                      )}
                      {row.recommendationChanged && (
                        <span title="Оценки изменили после выставления итога — рекомендация сейчас другая" className="text-brand-600">
                          <AlertTriangle className="size-4" />
                        </span>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center justify-center gap-2">
                      {grade && <Badge appearance="label" tone={published ? 'green' : 'gray'}>{published ? 'Опубликовано' : 'Черновик'}</Badge>}
                      {row.canEditResult && !published && otherKinds.map((kind) => (
                        <Button key={kind} variant={current?.kind === kind ? 'navy' : 'secondary'} size="sm" disabled={busy}
                          aria-pressed={current?.kind === kind} onClick={() => onPickResult(row, kind)}>
                          {FINAL_RESULT_LABELS[kind]}
                        </Button>
                      ))}
                    </span>
                    {rowError?.studentProfileId === studentId && (
                      <p role="alert" className="max-w-xs text-center text-11 font-semibold text-danger-fg">{rowError.message}</p>
                    )}
                    {grade?.id != null && (
                      <span className="flex flex-wrap justify-center gap-2">
                        <Button variant="ghost" size="sm" icon={<History className="size-4" />} onClick={() => onOpenHistory(row)}>
                          История итога
                        </Button>
                        {row.canCorrectTechnicalError && (
                          <Button variant="ghost" size="sm" onClick={() => onCorrect(row)}>Исправить техническую ошибку</Button>
                        )}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
