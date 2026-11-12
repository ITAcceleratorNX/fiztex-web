import { AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FINAL_RESULT_LABELS, finalResultLabel } from '@/lib/finalGradeResult';
import type { FinalGrade } from '@/lib/gradebookApi';
import { cx } from '@/lib/format';
import type { ClassFinalGradeRow, ClassFinalGrades } from '@/lib/gradebookApi';
import { formatAverage } from '@/lib/journalModel';
import {
  COMPONENT_SHORT,
  formatPercent,
  isPreliminary,
  positiveFinalValues,
  PRELIMINARY_LABEL,
  resultMissingCaption,
  resultStatusHint,
} from '@/lib/gradingModel';

/**
 * Итоговая — только целые 2…5, без знаков (final-grades-contract §3). Это запасной список:
 * допустимые значения приходят в ответе (`allowedValues`) — по политике оценивания это
 * значения её порогов (GRADES-003).
 */
export const FINAL_VALUES = [2, 3, 4, 5] as const;

/**
 * Итоги четверти (Figma 2098:1360).
 *
 * <p>Три числа в строке отвечают на разные вопросы и потому стоят рядом: средний балл —
 * что получилось у ученика, рекомендация — что из этого следует по порогам, итоговая —
 * что решил учитель. Рекомендация не подставляется в итог никогда (контракт §4): решение
 * остаётся решением, даже когда совпадает с арифметикой.
 *
 * <p>Пустой средний и пустая рекомендация — законное состояние (оценок за четверть нет),
 * и руками выставить итог это не мешает.
 *
 * <p>В четверти по политике оценивания (GRADES-003) вместо среднего — процент: он
 * открывает расшифровку с работами и формулой. Если оценки правили после выставления
 * итога и рекомендация теперь другая, рядом с итогом стоит предупреждение — итог при этом
 * не меняется сам.
 */
export function QuarterFinalsTable({
  finals,
  highlighted,
  busyStudentId,
  onPick,
  onOpenBreakdown,
  onPickResult,
  onCorrect,
  onOpenHistory,
  onRepublish,
  scope = 'PERIOD',
}: {
  finals: ClassFinalGrades;
  scope?: FinalGrade['scope'];
  /** Кого не хватило для публикации — сервер называет их поимённо. */
  highlighted: ReadonlySet<number>;
  busyStudentId: number | null;
  onPick: (row: ClassFinalGradeRow, value: number) => void;
  onPickResult?: (row: ClassFinalGradeRow, kind: NonNullable<FinalGrade['resultKind']>) => void;
  onOpenBreakdown?: (row: ClassFinalGradeRow) => void;
  onCorrect?: (row: ClassFinalGradeRow) => void;
  onOpenHistory?: (row: ClassFinalGradeRow) => void;
  /** «Подтвердить и опубликовать повторно» — когда после правки баллов рекомендация разошлась с итогом. */
  onRepublish?: (row: ClassFinalGradeRow) => void;
}) {
  const canManage = Boolean(finals.canManage);
  const rows = finals.rows ?? [];
  const byPolicy = scope === 'PERIOD' && finals.gradingPolicy != null;
  const options = finals.allowedValues && finals.allowedValues.length > 0
    ? finals.allowedValues
    : [...FINAL_VALUES];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="w-[320px] px-6 py-3 text-left text-11 font-bold uppercase text-slate-400">
              ФИО Ученика
            </th>
            <th className="px-6 py-3 text-center text-11 font-bold uppercase text-slate-400">
              {byPolicy ? 'Процент за четверть' : scope === 'YEAR' ? 'Средняя по периодам' : 'Средний балл'}
            </th>
            <th className="px-6 py-3 text-center text-11 font-bold uppercase text-slate-400">
              Рекомендованная оценка
            </th>
            <th className="px-6 py-3 text-center text-11 font-bold uppercase text-slate-400">
              Итоговая оценка
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const studentId = row.studentProfileId as number;
            const temporary = row.finalGrade?.status === 'PUBLISHED' && row.finalGrade.resultKind === 'TEMP_UNATTESTED';
            const locked = Boolean(row.yearLocked) || (row.finalGrade?.status === 'PUBLISHED' && !temporary);
            const value = row.finalGrade?.value ?? null;

            return (
              <tr
                key={studentId}
                className={cx(
                  'border-b border-slate-200 last:border-b-0',
                  highlighted.has(studentId) && 'bg-danger-bg/60',
                )}
              >
                <td className="px-6 py-3 text-slate-900">
                  <span className="flex items-center gap-2">
                    <span className="truncate">{row.studentName}</span>
                    {row.currentMember === false && (
                      <span
                        title="Сохранённый итог ученика из прежнего состава класса"
                        className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-10 font-semibold text-slate-500"
                      >
                        история класса
                      </span>
                    )}
                  </span>
                </td>

                <td className="px-6 py-3 text-center font-semibold text-slate-900">
                  {byPolicy ? (
                    <span className="flex flex-col items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onOpenBreakdown?.(row)}
                        title={resultStatusHint(row.result) ?? componentsLine(row)}
                        className="rounded-lg px-2 py-1 transition hover:bg-navy-50 hover:text-navy-700"
                      >
                        {row.result?.percent != null ? formatPercent(row.result.percent) : '—'}
                      </button>
                      {isPreliminary(row.result) && (
                        <span className="rounded bg-info-bg px-1.5 py-0.5 text-10 font-bold uppercase text-info-fg">
                          {PRELIMINARY_LABEL}
                        </span>
                      )}
                      {resultMissingCaption(row.result) && !isPreliminary(row.result) && (
                        <span className="text-11 font-normal text-muted">{resultMissingCaption(row.result)}</span>
                      )}
                      {isPreliminary(row.result) && (
                        <span className="text-11 font-normal text-muted">без СОЧ</span>
                      )}
                    </span>
                  ) : (
                    formatAverage(row.average)
                  )}
                </td>

                <td className="px-6 py-3">
                  <span className="flex justify-center">
                    {row.recommendedValue != null ? (
                      <span className="flex flex-col items-center gap-0.5">
                        <span className="flex size-[26px] items-center justify-center rounded-lg bg-slate-100 text-13 font-bold text-slate-600">
                          {row.recommendedValue}
                        </span>
                        {isPreliminary(row.result) && (
                          <span
                            title="Расчёт без СОЧ: это не итог четверти и ученику он не виден"
                            className="text-10 font-semibold uppercase text-muted"
                          >
                            {PRELIMINARY_LABEL}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span
                        className="text-slate-400"
                        title={resultStatusHint(row.result) ?? 'Рекомендации нет: не хватает оценок за четверть'}
                      >
                        —
                      </span>
                    )}
                  </span>
                </td>

                <td className="px-6 py-3">
                  <span className="flex items-center justify-center gap-3">
                    {locked ? (
                      <span
                        className="flex items-center gap-2 text-13 font-semibold text-slate-500"
                        title={row.yearLocked ? scope === 'PERIOD' ? "Годовая оценка опубликована — четвертные закрыты" : "Окончательный итог опубликован — связанные результаты закрыты" : "Опубликованный итог меняется только по процедуре исправления технической ошибки"}
                      >
                        <Lock className="size-4" />
                        {finalResultLabel(row.finalGrade)}
                      </span>
                    ) : canManage && row.currentMember !== false ? (
                      <span className="flex flex-col items-center gap-2">
                      {temporary && <span className="text-11 text-muted">Временно не аттестован. После сдачи обязательных работ:</span>}
                      {dataModeNumeric(finals) && <FinalValuePicker
                        options={temporary ? positiveFinalValues(options) : options}
                        value={value}
                        busy={busyStudentId === studentId}
                        onPick={(next) => onPick(row, next)}
                      />}
                      <span className="flex flex-wrap justify-center gap-1">
                        {!temporary && (finals.allowedResultKinds ?? []).filter(kind => kind !== 'NUMERIC').map(kind => (
                          <Button key={kind} variant="secondary" disabled={busyStudentId === studentId}
                            aria-pressed={row.finalGrade?.resultKind === kind}
                            onClick={() => onPickResult?.(row, kind)}>{FINAL_RESULT_LABELS[kind]}</Button>
                        ))}
                      </span>
                      </span>
                    ) : (
                      <span className="text-15 font-bold text-slate-900">{finalResultLabel(row.finalGrade)}</span>
                    )}
                    {row.recommendationChanged && (
                      <span
                        title="Оценки изменили после выставления итога — рекомендация сейчас другая"
                        className="text-brand-600"
                      >
                        <AlertTriangle className="size-4" />
                      </span>
                    )}
                    {row.finalGrade?.status === 'PUBLISHED' && (
                      <span className="rounded bg-success-bg px-2 py-0.5 text-10 font-bold uppercase text-success-fg">
                        опубл.
                      </span>
                    )}
                  </span>
                  {needsRepublish(row, canManage) && (
                    <span className="mt-2 flex flex-col items-center gap-1">
                      <span className="text-11 text-brand-600">
                        Требуется повторное подтверждение: рекомендация теперь {row.recommendedValue}, ученик видит {finalResultLabel(row.finalGrade)}
                      </span>
                      <Button variant="secondary" size="sm" disabled={busyStudentId === studentId} onClick={() => onRepublish?.(row)}>
                        Подтвердить и опубликовать
                      </Button>
                    </span>
                  )}
                  {row.finalGrade?.id && <span className="mt-2 flex justify-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => onOpenHistory?.(row)}>История итога</Button>
                    {finals.canCorrectTechnicalErrors && row.finalGrade.status === 'PUBLISHED' && <Button variant="ghost" size="sm" onClick={() => onCorrect?.(row)}>Исправить техническую ошибку</Button>}
                  </span>}
                  {(!row.finalGrade?.resultKind || row.finalGrade.resultKind === 'NUMERIC') && row.publicationIssues?.map(issue => (
                    <p key={issue} className="mt-2 max-w-sm text-11 text-danger-fg">{issue}</p>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Выбор итоговой прямо в строке (макет 2098:1382): четыре значения всегда на виду, без
 * лишнего нажатия. Уже выставленная оценка остаётся выбранной — повторное нажатие по ней
 * ничего не меняет, а нажатие по соседней меняет значение сразу.
 */
function FinalValuePicker({
  options,
  value,
  busy,
  onPick,
}: {
  options: number[];
  value: number | null;
  busy: boolean;
  onPick: (value: number) => void;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-lg border border-slate-200 p-0.5',
        busy && 'pointer-events-none opacity-60',
      )}
    >
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick(option)}
            className={cx(
              'size-[26px] rounded-md text-13 font-bold transition',
              selected
                ? 'bg-navy-700 text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-navy-700',
            )}
          >
            {option}
          </button>
        );
      })}
    </span>
  );
}

/**
 * Опубликованный числовой итог, у которого рекомендация после правки баллов стала другой.
 * Сам итог ученик продолжает видеть прежним, пока учитель не подтвердит новый (ТЗ №9).
 * Право и «изменилась ли рекомендация» — ответ сервера; здесь только их сочетание.
 */
export function needsRepublish(row: ClassFinalGradeRow, canManage: boolean): boolean {
  const grade = row.finalGrade;
  return (
    canManage &&
    row.currentMember !== false &&
    !row.yearLocked &&
    row.recommendationChanged === true &&
    row.recommendedValue != null &&
    grade?.status === 'PUBLISHED' &&
    (grade.resultKind == null || grade.resultKind === 'NUMERIC')
  );
}

/** «ФО 84,29% · СОР 72,5% · СОЧ 90%» — подсказка под курсором у процента. */
function componentsLine(row: ClassFinalGradeRow): string {
  return (row.result?.components ?? [])
    .filter((component) => component.workCount)
    .map((component) => `${component.code ? COMPONENT_SHORT[component.code] : ''} ${formatPercent(component.percent)}`)
    .join(' · ');
}

function dataModeNumeric(finals: ClassFinalGrades) {
  return !finals.assessmentMode || finals.assessmentMode === 'NUMERIC';
}
