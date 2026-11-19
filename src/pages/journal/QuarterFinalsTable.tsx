import type { ReactNode } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, History, Lock, MessageSquareText } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { HoverCard } from '@/components/ui/HoverCard';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { ValuePicker } from '@/components/ui/ValuePicker';
import {
  ATTESTATION_KINDS,
  ATTESTATION_SHORT,
  currentResult,
  fullResultLabel,
  hasNotableHistory,
  isAttestationStatus,
  reasonCaption,
  shortResultLabel,
  type AttestationKind,
  type ResultKind,
  type ResultValue,
} from '@/lib/attestationModel';
import { FINAL_RESULT_LABELS } from '@/lib/finalGradeResult';
import { cx } from '@/lib/format';
import type { ClassFinalGradeRow, ClassFinalGrades, QuarterResult } from '@/lib/gradebookApi';
import {
  deviationCaption,
  finalColumnTitle,
  isHalfYear,
  isPassFail,
  recommendationGap,
  trendOf,
} from '@/lib/finalsAttestationModel';
import { periodGenitive, periodTitle } from '@/lib/subjectAttestationModel';
import { formatAverage } from '@/lib/journalModel';
import {
  COMPONENT_SHORT,
  formatPercent,
  isPreliminary,
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

/** Допустимые итоги экрана: `allowedValues` сервера, без них — запасные 2…5. */
export function finalValueOptions(finals: Pick<ClassFinalGrades, 'allowedValues'> | null | undefined): number[] {
  return finals?.allowedValues && finals.allowedValues.length > 0 ? finals.allowedValues : [...FINAL_VALUES];
}

/** Вариант «…» в ряду оценок — особые результаты без числа («Не изучался»), как в окне Т4. */
const MORE = 'MORE' as const;

const STATUS_TONE: Record<AttestationKind, 'warning' | 'danger'> = { TEMP_UNATTESTED: 'warning', NOT_ATTESTED: 'danger' };
const STATUS_BADGE: Record<AttestationKind, 'amber' | 'red'> = { TEMP_UNATTESTED: 'amber', NOT_ATTESTED: 'red' };

export interface QuarterFinalsActions {
  /** Число в черновике без статуса — сохраняется сразу. */
  onPickValue: (row: ClassFinalGradeRow, value: number) => void;
  /** Зачёт / незачёт — сохраняется сразу. */
  onPickResult: (row: ClassFinalGradeRow, kind: ResultKind) => void;
  /** ВНА/НА, которого ещё нет в строке, — окно статуса с причиной (Т2, Т3). */
  onRequestStatus: (row: ClassFinalGradeRow, kind: AttestationKind) => void;
  /** «Изменить итог» — снять статус, выбрать особый результат, заменить опубликованный ВНА (Т4, Т6). */
  onRequestChange: (row: ClassFinalGradeRow, initial: ResultValue | null) => void;
  onOpenHistory: (row: ClassFinalGradeRow) => void;
  /** Администрация: «Исправить» опубликованный итог по документу и протоколу (А1). */
  onCorrect: (row: ClassFinalGradeRow) => void;
  /** ТЗ №9: рекомендация разошлась с опубликованным числом. */
  onRepublish: (row: ClassFinalGradeRow) => void;
  onOpenBreakdown?: (row: ClassFinalGradeRow) => void;
  /**
   * Настроенный предмет (У10): в режиме изменения учитель выбирает итог строки с изменившейся
   * рекомендацией прямо в таблице, а подтверждает все разом кнопкой внизу.
   */
  onStageRepublish?: (row: ClassFinalGradeRow, value: number) => void;
}

/**
 * Итоги четверти (макет Т1 2209:178, Т5 2209:2164, Т5а 2209:2585, А0 2209:4887).
 *
 * Пять колонок: процент (что получилось у ученика), рекомендация (что из него следует), итоговая
 * оценка (решение учителя) и аттестация — ВНА/НА. Оценка и статус в разных колонках, но активен
 * всегда один результат: у строки со статусом в колонке оценки — прочерк.
 *
 * Что можно сделать со строкой, решает сервер (`canEditResult`, `canChangeAttestation`,
 * `canCorrectTechnicalError`, `canConfirmPublication`); таблица раскладывает ответ по кнопкам.
 * `editMode` — режим «Редактировать» после публикации (Т5а): только он открывает у
 * опубликованного ВНА положительные оценки (`positiveValues`).
 */
export function QuarterFinalsTable({
  finals,
  highlighted,
  busyStudentId,
  rowError = null,
  editMode = false,
  actions,
  staged,
}: {
  finals: ClassFinalGrades;
  /** Кого не хватило для публикации — сервер называет их поимённо. */
  highlighted: ReadonlySet<number>;
  busyStudentId: number | null;
  /** Отказ действия в ячейке — под строкой этого ученика, а не под таблицей (D-3). */
  rowError?: { studentProfileId: number; message: string } | null;
  editMode?: boolean;
  actions: QuarterFinalsActions;
  /** Выбор итога для повторной публикации в режиме изменения (У10) — до нажатия кнопки внизу. */
  staged?: ReadonlyMap<number, number>;
}) {
  const rows = finals.rows ?? [];
  const byPolicy = finals.gradingPolicy != null;
  const numeric = !finals.assessmentMode || finals.assessmentMode === 'NUMERIC';
  const passFail = isPassFail(finals);
  const halfYear = isHalfYear(finals);
  const configured = Boolean(finals.attestation?.configured);
  const finalAllowed = finals.attestation?.finalAllowed !== false;
  const half = finals.attestation?.halfYear;
  // ВНА/НА с «Итоговой аттестацией» есть и у зачёта — колонка нужна, если сервер их разрешает или они уже стоят.
  const showAttestation = numeric || Boolean(finals.canManageAttestation)
    || rows.some((row) => isAttestationStatus(row.finalGrade?.resultKind));
  const quarterTitles = [half?.opening, half?.closing].map((period) => periodTitle(period));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <Th className="w-[260px] text-left">ФИО ученика</Th>
            {halfYear && quarterTitles.map((title) => <Th key={title}>{title}</Th>)}
            <Th>{halfYear ? 'Учебные результаты' : byPolicy ? 'Процент за четверть' : 'Средний балл'}</Th>
            <Th>{passFail ? 'Рекомендация системы' : halfYear ? 'Рекомендация' : 'Рекомендованная оценка'}</Th>
            <Th>{finalColumnTitle(finals)}</Th>
            {showAttestation && <Th className="text-left">Аттестация</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const studentId = row.studentProfileId as number;
            const busy = busyStudentId === studentId;
            const changed = configured && (row.canConfirmPublication || row.state === 'CHANGED_AFTER_PUBLICATION');
            return (
              <tr
                key={studentId}
                className={cx('group border-b border-slate-200 last:border-b-0',
                  highlighted.has(studentId) ? 'bg-danger-bg/60' : changed && 'bg-amber-50/60')}
              >
                <td className="px-6 py-4 text-slate-900">
                  <span className="flex items-center gap-2">
                    <span className="truncate">{row.studentName}</span>
                    {row.currentMember === false && (
                      <span title="Сохранённый итог ученика из прежнего состава класса"
                        className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-10 font-semibold text-slate-500">
                        история класса
                      </span>
                    )}
                  </span>
                </td>
                {halfYear && [0, 1].map((index) => (
                  <td key={index} className="px-4 py-4 text-center">
                    <QuarterCell quarter={row.quarterResults?.[index]}
                      previous={index === 1 ? row.quarterResults?.[0] : undefined} />
                  </td>
                ))}
                <td className="px-6 py-4 text-center font-semibold text-slate-900">
                  {halfYear
                    ? finalAllowed ? <HalfYearResultCell row={row} onOpen={actions.onOpenBreakdown} /> : <span className="text-slate-300">—</span>
                    : byPolicy ? <PercentCell row={row} onOpen={actions.onOpenBreakdown} /> : formatAverage(row.average)}
                </td>
                <td className="px-6 py-4">
                  <RecommendationCell row={row} passFail={passFail} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col items-center gap-2">
                    {!finalAllowed ? (
                      <span className="flex items-center gap-1.5 text-13 text-muted">
                        <Lock className="size-4 text-slate-400" aria-hidden />
                        в конце {periodGenitive(periodTitle(half?.closing))}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <GradeCell row={row} finals={finals} numeric={numeric} editMode={editMode} busy={busy} actions={actions}
                          compact={halfYear} staged={staged?.get(studentId)} />
                        {row.finalGrade?.deviationReason && !isAttestationStatus(row.finalGrade.resultKind) && (
                          <HoverCard trigger={<MessageSquareText className="size-4" aria-hidden />} label={deviationCaption(row)}
                            title={deviationCaption(row)}>
                            {row.finalGrade.deviationReason}
                          </HoverCard>
                        )}
                      </span>
                    )}
                    {changed && !(editMode && row.canConfirmPublication) && (
                      <span className="text-11 font-semibold text-brand-600">Рекомендация изменилась</span>
                    )}
                    {configured && row.state === 'DRAFT' && row.canEditResult && (
                      <span className="text-11 text-muted" title="Итог сохранён черновиком без подтверждения — выберите значение ещё раз">
                        черновик · не подтверждён
                      </span>
                    )}
                    {!configured && row.canConfirmPublication && (
                      <span className="flex flex-col items-center gap-1">
                        <span className="flex items-center gap-1 text-11 text-brand-600">
                          <AlertTriangle className="size-3.5" aria-hidden />
                          Рекомендация теперь {row.recommendedValue}
                        </span>
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => actions.onRepublish(row)}>
                          Подтвердить и опубликовать
                        </Button>
                      </span>
                    )}
                    {rowError?.studentProfileId === studentId && (
                      <p role="alert" className="max-w-xs text-center text-11 font-semibold text-danger-fg">{rowError.message}</p>
                    )}
                  </div>
                </td>
                {showAttestation && (
                  <td className="px-6 py-4">
                    <AttestationCell row={row} editMode={editMode} busy={busy} actions={actions} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cx('px-6 py-3 text-center text-11 font-bold uppercase text-slate-400', className)}>{children}</th>;
}

/** «80%» с расшифровкой по нажатию; «Нет СОЧ» — чего не хватает расчёту (Т1). */
function PercentCell({ row, onOpen }: { row: ClassFinalGradeRow; onOpen?: (row: ClassFinalGradeRow) => void }) {
  const caption = resultMissingCaption(row.result);
  return (
    <span className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={() => onOpen?.(row)}
        title={resultStatusHint(row.result) ?? componentsLine(row)}
        className="rounded-lg px-2 py-1 transition hover:bg-navy-50 hover:text-navy-700"
      >
        {row.result?.percent != null ? formatPercent(row.result.percent) : '—'}
      </button>
      {isPreliminary(row.result) ? (
        <>
          <span className="rounded bg-info-bg px-1.5 py-0.5 text-10 font-bold uppercase text-info-fg">{PRELIMINARY_LABEL}</span>
          <span className="text-11 font-normal text-muted">без СОЧ</span>
        </>
      ) : caption && <span className="text-11 font-normal text-muted">{caption}</span>}
    </span>
  );
}

/** Процент четверти полугодия (Б2, Б3): «79%», у второй — стрелка к первой и «нет СОЧ» под ним. */
function QuarterCell({ quarter, previous }: { quarter: QuarterResult | undefined; previous?: QuarterResult }) {
  const percent = quarter?.result?.roundedPercent ?? null;
  const trend = previous ? trendOf(previous.result?.roundedPercent, percent) : null;
  const missing = quarter?.result?.missingComponents?.includes('SOCH') && quarter.result.status !== 'NO_WORKS';
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span className={cx('flex items-center gap-1', percent != null ? 'font-semibold text-slate-900' : 'text-slate-300')}>
        {percent != null ? `${percent}%` : '—'}
        {trend === 'up' && <ArrowUp className="size-3.5 text-emerald-600" aria-label="выше первой четверти" />}
        {trend === 'down' && <ArrowDown className="size-3.5 text-red-600" aria-label="ниже первой четверти" />}
      </span>
      {missing && <span className="text-11 text-muted">нет СОЧ</span>}
    </span>
  );
}

/** Совокупный результат полугодия: процент и состав под ним — «ФО 81% · СОР 72%» (Б3, У3). */
function HalfYearResultCell({ row, onOpen }: { row: ClassFinalGradeRow; onOpen?: (row: ClassFinalGradeRow) => void }) {
  const caption = row.result?.percent == null ? resultMissingCaption(row.result) : componentsLine(row);
  return (
    <span className="flex flex-col items-center gap-0.5">
      <button type="button" onClick={() => onOpen?.(row)} title={resultStatusHint(row.result) ?? undefined}
        className="rounded-lg px-2 py-0.5 transition hover:bg-navy-50 hover:text-navy-700">
        {row.result?.roundedPercent != null ? `${row.result.roundedPercent}%` : '—'}
      </button>
      {caption && <span className="text-11 font-normal text-muted">{caption}</span>}
    </span>
  );
}

/**
 * Рекомендация: число (серый квадрат), «Зачёт»/«Незачёт» (зелёная/красная плашка) с основанием —
 * или прочерк и почему её нет (У3, У6). Полный текст причины — под курсором.
 */
function RecommendationCell({ row, passFail }: { row: ClassFinalGradeRow; passFail: boolean }) {
  const recommendation = row.recommendation;
  const value = recommendation?.available ? recommendation.value ?? row.recommendedValue : row.recommendedValue;
  if (passFail && recommendation?.available && (recommendation.resultKind === 'PASS' || recommendation.resultKind === 'FAIL')) {
    return (
      <span className="flex flex-col items-center gap-1">
        <Badge appearance="label" tone={recommendation.resultKind === 'PASS' ? 'green' : 'red'}>
          {FINAL_RESULT_LABELS[recommendation.resultKind]}
        </Badge>
        {recommendation.basis && <span className="max-w-[180px] text-center text-11 text-muted">{recommendation.basis}</span>}
      </span>
    );
  }
  if (!passFail && value != null) {
    return (
      <span className="flex justify-center">
        <span title={recommendation?.basis ?? undefined}
          className="flex size-[26px] items-center justify-center rounded-lg bg-slate-100 text-13 font-bold text-slate-600">
          {value}
        </span>
      </span>
    );
  }
  const gap = recommendationGap(recommendation);
  return (
    <span className="flex flex-col items-center gap-0.5"
      title={recommendation?.unavailableMessage ?? resultStatusHint(row.result) ?? 'Рекомендации нет: не хватает оценок за четверть'}>
      <span className="text-slate-300">—</span>
      {gap && <span className="max-w-[180px] text-center text-11 text-muted">{gap}</span>}
    </span>
  );
}

/**
 * Колонка «Итоговая оценка».
 * - черновик (или итога нет), `canEditResult`: ряд шкалы; у строки со статусом — прочерк (Т1),
 *   статус снимается из колонки аттестации («Изменить итог»);
 * - опубликованный ВНА в режиме изменения: положительные оценки — каждая открывает «Изменить итог» (Т5а, Т6);
 * - иначе — значение, у опубликованного с замком (Т5).
 */
function GradeCell({ row, finals, numeric, editMode, busy, actions, compact = false, staged }: {
  row: ClassFinalGradeRow; finals: ClassFinalGrades; numeric: boolean; editMode: boolean; busy: boolean;
  actions: QuarterFinalsActions;
  /** Полугодие (Б3): число — компактным полем, ряд из десяти кнопок рядом с четвертями не помещается. */
  compact?: boolean;
  staged?: number;
}) {
  const grade = row.finalGrade ?? null;
  const current = currentResult(grade);
  const published = grade?.status === 'PUBLISHED';
  const status = isAttestationStatus(current?.kind);
  const configured = Boolean(finals.attestation?.configured);
  // Черновик без подтверждения у настроенного предмета: повторный выбор того же значения подтверждает его.
  const repick = configured && row.state === 'DRAFT';

  // У10: рекомендация разошлась с опубликованным числом — выбор здесь, подтверждение кнопкой внизу.
  if (configured && editMode && row.canConfirmPublication && numeric && actions.onStageRepublish) {
    const recommended = row.recommendation?.available ? row.recommendation.value ?? null : row.recommendedValue ?? null;
    return (
      <ValuePicker
        ariaLabel={`Итог после изменения рекомендации: ${row.studentName ?? ''}`}
        options={finalValueOptions(finals).map((value) => ({ value, label: String(value) }))}
        value={staged ?? recommended ?? current?.value ?? null}
        disabled={busy}
        onChoose={(value) => actions.onStageRepublish!(row, value)}
      />
    );
  }

  if (row.canEditResult && published && editMode && !numeric) {
    return (
      <SegmentedChoice
        ariaLabel={`Итог вместо «${fullResultLabel(current)}»: ${row.studentName ?? ''}`}
        options={[{ value: 'PASS' as const, label: FINAL_RESULT_LABELS.PASS }]}
        selected={null}
        disabled={busy}
        onChoose={() => actions.onRequestChange(row, { kind: 'PASS', value: null })}
      />
    );
  }

  if (row.canEditResult && published && editMode) {
    const positive = finals.positiveValues?.length ? finals.positiveValues : finalValueOptions(finals);
    return (
      <SegmentedChoice
        ariaLabel={`Оценка вместо «${fullResultLabel(current)}»: ${row.studentName ?? ''}`}
        options={positive.map((value) => ({ value, label: String(value) }))}
        selected={null}
        disabled={busy}
        onChoose={(value) => actions.onRequestChange(row, { kind: 'NUMERIC', value })}
      />
    );
  }

  if (row.canEditResult && !published && !status && numeric && compact) {
    return (
      <ValuePicker
        ariaLabel={`Итоговая оценка: ${row.studentName ?? ''}`}
        options={finalValueOptions(finals).map((value) => ({ value, label: String(value) }))}
        value={current?.kind === 'NUMERIC' ? current.value : null}
        disabled={busy}
        onChoose={(value) => {
          if (repick || !(current?.kind === 'NUMERIC' && current.value === value)) actions.onPickValue(row, value);
        }}
      />
    );
  }

  if (row.canEditResult && !published && !status) {
    const otherKinds = (finals.allowedResultKinds ?? [])
      .filter((kind) => kind !== 'NUMERIC' && !isAttestationStatus(kind) && (numeric || kind === 'NOT_STUDIED'));
    const otherSelected = current != null && current.kind !== 'NUMERIC' && otherKinds.includes(current.kind);
    const base = numeric
      ? finalValueOptions(finals).map((value) => ({ value: value as number | ResultKind | typeof MORE, label: String(value) }))
      : (['PASS', 'FAIL'] as const).map((kind) => ({ value: kind as number | ResultKind | typeof MORE, label: FINAL_RESULT_LABELS[kind] }));
    const more = otherKinds.length > 0
      ? [{ value: MORE as number | ResultKind | typeof MORE, label: otherSelected ? shortResultLabel(current) : '…', title: 'Другой результат: ' + otherKinds.map((kind) => FINAL_RESULT_LABELS[kind].toLowerCase()).join(', ') }]
      : [];
    const selected = otherSelected ? MORE : current?.kind === 'NUMERIC' ? current.value : current?.kind ?? null;
    return (
      <SegmentedChoice
        ariaLabel={`Итоговая оценка: ${row.studentName ?? ''}`}
        options={[...base, ...more]}
        selected={selected}
        disabled={busy}
        onChoose={(value) => {
          if (value === MORE) {
            actions.onRequestChange(row, otherSelected ? current : null);
          } else if (typeof value === 'number') {
            if (repick || !(current?.kind === 'NUMERIC' && current.value === value)) actions.onPickValue(row, value);
          } else if (repick || current?.kind !== value) {
            actions.onPickResult(row, value);
          }
        }}
      />
    );
  }

  if (!current || status || (current.kind === 'NUMERIC' && current.value == null)) {
    return <span className="text-15 text-slate-300">—</span>;
  }
  return (
    <span className="flex items-center gap-1.5 text-15 font-bold text-slate-900" title={fullResultLabel(current)}>
      {shortResultLabel(current)}
      {(published || row.yearLocked) && <Lock className="size-4 text-slate-400" aria-label="Итог закрыт для правки" />}
    </span>
  );
}

/**
 * Колонка «Аттестация»: выбор ВНА | НА до публикации, плашка статуса после неё, значок причины
 * (подсказка «Причина …»), значок истории и «Исправить» у администрации.
 */
function AttestationCell({ row, editMode, busy, actions }: {
  row: ClassFinalGradeRow; editMode: boolean; busy: boolean; actions: QuarterFinalsActions;
}) {
  const grade = row.finalGrade ?? null;
  const status = isAttestationStatus(grade?.resultKind) ? grade!.resultKind as AttestationKind : null;
  const published = grade?.status === 'PUBLISHED';

  return (
    <span className="flex items-center gap-2">
      {row.canChangeAttestation ? (
        <SegmentedChoice
          ariaLabel={`Аттестация: ${row.studentName ?? ''}`}
          options={ATTESTATION_KINDS.map((kind) => ({
            value: kind, label: ATTESTATION_SHORT[kind], title: FINAL_RESULT_LABELS[kind], tone: STATUS_TONE[kind],
          }))}
          selected={status}
          disabled={busy}
          onChoose={(kind) => (kind === status ? actions.onRequestChange(row, null) : actions.onRequestStatus(row, kind))}
        />
      ) : status ? (
        <span
          title={FINAL_RESULT_LABELS[status]}
          className={cx('inline-flex rounded-lg', editMode && row.canEditResult && 'ring-2 ring-amber-200 ring-offset-1')}
        >
          <Badge appearance="solid" tone={STATUS_BADGE[status]}>{ATTESTATION_SHORT[status]}</Badge>
        </span>
      ) : null}
      {status && published && status === 'NOT_ATTESTED' && (
        <Lock className="size-4 text-slate-400" aria-label="Исправляет администратор" />
      )}
      {status && grade?.resultReason && (
        <HoverCard trigger={<MessageSquareText className="size-4" aria-hidden />} label="Причина статуса" title={reasonCaption(status)}>
          {grade.resultReason}
        </HoverCard>
      )}
      {hasNotableHistory(row) && (
        <Button variant="ghost" size="icon-sm" aria-label="История итога" title="История итога"
          icon={<History className="size-4 text-slate-400" />} onClick={() => actions.onOpenHistory(row)} />
      )}
      {row.canCorrectTechnicalError && (
        // Макет А0 рисует «Исправить» у ВНА/НА; у числа то же действие проявляется при наведении на
        // строку и при фокусе — иначе каждая строка таблицы кричала бы одной и той же ссылкой.
        <Button variant="link" size="text"
          className={cx('ml-auto font-semibold', !status && 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100')}
          onClick={() => actions.onCorrect(row)}>
          Исправить
        </Button>
      )}
    </span>
  );
}

/** «ФО 84,29% · СОР 72,5% · СОЧ 90%» — подсказка под курсором у процента. */
function componentsLine(row: ClassFinalGradeRow): string {
  return (row.result?.components ?? [])
    .filter((component) => component.workCount)
    .map((component) => `${component.code ? COMPONENT_SHORT[component.code] : ''} ${formatPercent(component.percent)}`)
    .join(' · ');
}
