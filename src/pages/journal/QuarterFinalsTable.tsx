import { AlertTriangle, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  ATTESTATION_SHORT,
  authorLabel,
  decidedResult,
  familySees,
  fullResultLabel,
  isAttestationStatus,
  needsReason,
  publicationBadge,
  shortResultLabel,
  type AttestationKind,
  type ResultValue,
} from '@/lib/attestationModel';
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

/** Допустимые итоги экрана: `allowedValues` сервера, без них — запасные 2…5. */
export function finalValueOptions(finals: Pick<ClassFinalGrades, 'allowedValues'> | null | undefined): number[] {
  return finals?.allowedValues && finals.allowedValues.length > 0 ? finals.allowedValues : [...FINAL_VALUES];
}

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
 *
 * <p>ATTESTATION-001: в ячейке итога один активный результат — число 1…10 либо ВНА/НА. Что
 * можно сделать со строкой, решает сервер (`canEditResult`, `canChangeAttestation`,
 * `canConfirmPublication`); таблица только раскладывает его ответ по кнопкам.
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
  onRequestStatus,
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
  /** «Подтвердить и опубликовать» — ожидающее изменение ВНА/НА или итог после правки баллов. */
  onRepublish?: (row: ClassFinalGradeRow) => void;
  /**
   * Выбор, которому нужна причина: поставить ВНА/НА, снять статус числом, отменить ожидающее
   * изменение. Открывает окно статуса — сохранять напрямую такой выбор нельзя.
   */
  onRequestStatus?: (row: ClassFinalGradeRow, target: ResultValue) => void;
}) {
  const rows = finals.rows ?? [];
  const byPolicy = scope === 'PERIOD' && finals.gradingPolicy != null;
  const options = finalValueOptions(finals);

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
                  <FinalResultCell
                    row={row}
                    finals={finals}
                    scope={scope}
                    options={options}
                    busy={busyStudentId === studentId}
                    onPick={onPick}
                    onPickResult={onPickResult}
                    onRequestStatus={onRequestStatus}
                    onRepublish={onRepublish}
                    onOpenHistory={onOpenHistory}
                    onCorrect={onCorrect}
                  />
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
 * Ячейка итога: выбор, состояние публикации, что видит семья и что ждёт подтверждения.
 *
 * Кнопки — по признакам строки от сервера, без своих правил:
 * - числа — `canEditResult`; у администрации — только снятие статуса числом, то есть при
 *   `canChangeAttestation` и статусе в самой строке (не в ожидающем изменении);
 * - ВНА/НА — `canChangeAttestation`, только в итоге четверти: годовой ВНА живёт прежней
 *   кнопкой результата;
 * - «Не изучался», зачёт — `canEditResult` и пока итог не опубликован.
 * Выбор со статусом до или после идёт через окно с причиной (`onRequestStatus`), остальное
 * сохраняется сразу (`onPick`).
 */
function FinalResultCell({
  row,
  finals,
  scope,
  options,
  busy,
  onPick,
  onPickResult,
  onRequestStatus,
  onRepublish,
  onOpenHistory,
  onCorrect,
}: {
  row: ClassFinalGradeRow;
  finals: ClassFinalGrades;
  scope: FinalGrade['scope'];
  options: number[];
  busy: boolean;
  onPick: (row: ClassFinalGradeRow, value: number) => void;
  onPickResult?: (row: ClassFinalGradeRow, kind: NonNullable<FinalGrade['resultKind']>) => void;
  onRequestStatus?: (row: ClassFinalGradeRow, target: ResultValue) => void;
  onRepublish?: (row: ClassFinalGradeRow) => void;
  onOpenHistory?: (row: ClassFinalGradeRow) => void;
  onCorrect?: (row: ClassFinalGradeRow) => void;
}) {
  const grade = row.finalGrade ?? null;
  const decided = decidedResult(grade);
  const published = grade?.status === 'PUBLISHED';
  const periodScope = scope === 'PERIOD';
  const kinds = finals.allowedResultKinds ?? [];
  const statusKinds = periodScope ? kinds.filter(isAttestationStatus) : [];
  const otherKinds = kinds.filter((kind) => kind !== 'NUMERIC' && (!periodScope || !isAttestationStatus(kind)));
  const numbersEnabled = Boolean(row.canEditResult)
    || (Boolean(row.canChangeAttestation) && isAttestationStatus(grade?.resultKind));
  const statusesEnabled = Boolean(row.canChangeAttestation) && statusKinds.length > 0;
  const showNumbers = dataModeNumeric(finals) && numbersEnabled;
  const selectable = showNumbers || statusesEnabled;
  // Пилот 3.1/3.2: опубликованный ВНА снимается только положительным итогом — сервер это
  // проверит, а выбор не предлагает заведомо отклоняемого.
  const numberOptions = published && grade?.resultKind === 'TEMP_UNATTESTED' ? positiveFinalValues(options) : options;
  const badge = publicationBadge(grade);
  const family = familySees(grade);
  const pending = grade?.pendingChange ?? null;

  function chooseNumber(value: number) {
    if (decided?.kind === 'NUMERIC' && decided.value === value) return;
    if (needsReason(decided?.kind, 'NUMERIC')) onRequestStatus?.(row, { kind: 'NUMERIC', value });
    else onPick(row, value);
  }

  function chooseStatus(kind: AttestationKind) {
    if (decided?.kind === kind) return;
    onRequestStatus?.(row, { kind, value: null });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="flex items-center justify-center gap-3">
        {selectable ? (
          <span
            role="group"
            aria-label={`Итог: ${row.studentName ?? ''}`}
            className={cx(
              'inline-flex items-center gap-1 rounded-lg border border-slate-200 p-0.5',
              busy && 'pointer-events-none opacity-60',
            )}
          >
            {showNumbers && numberOptions.map((option) => (
              <ResultButton
                key={option}
                label={String(option)}
                selected={decided?.kind === 'NUMERIC' && decided.value === option}
                onClick={() => chooseNumber(option)}
              />
            ))}
            {/* Числа менять нельзя (опубликованное число), а решение — не статус: оно всё равно
                стоит в ряду выбранным, иначе ячейка показывала бы только «ВНА НА» без итога. */}
            {!showNumbers && decided && !isAttestationStatus(decided.kind) && (
              <span
                title={fullResultLabel(decided)}
                className="flex h-[26px] min-w-[26px] items-center justify-center rounded-md bg-navy-700 px-1 text-13 font-bold text-white"
              >
                {shortResultLabel(decided)}
              </span>
            )}
            {(showNumbers || (decided && !isAttestationStatus(decided.kind))) && statusesEnabled && (
              <span aria-hidden className="mx-0.5 h-5 w-px bg-slate-200" />
            )}
            {statusesEnabled && statusKinds.map((kind) => (
              <ResultButton
                key={kind}
                label={ATTESTATION_SHORT[kind]}
                title={FINAL_RESULT_LABELS[kind]}
                ariaLabel={`${ATTESTATION_SHORT[kind]} — ${FINAL_RESULT_LABELS[kind]}`}
                selected={decided?.kind === kind}
                onClick={() => chooseStatus(kind)}
              />
            ))}
          </span>
        ) : (
          <span
            className="flex items-center gap-2 text-15 font-bold text-slate-900"
            title={decided ? fullResultLabel(decided) : undefined}
          >
            {row.yearLocked && <Lock className="size-4 text-slate-500" aria-label="Предмет закрыт за год" />}
            {shortResultLabel(decided)}
          </span>
        )}
        {row.recommendationChanged && (
          <span title="Оценки изменили после выставления итога — рекомендация сейчас другая" className="text-brand-600">
            <AlertTriangle className="size-4" />
          </span>
        )}
      </span>

      {(badge || (row.canEditResult && !published && otherKinds.length > 0)) && (
        <span className="flex flex-wrap items-center justify-center gap-2">
          {badge && <Badge appearance="label" tone={badge.tone}>{badge.label}</Badge>}
          {row.canEditResult && !published && otherKinds.map((kind) => (
            <Button
              key={kind}
              variant="secondary"
              size="sm"
              disabled={busy}
              aria-pressed={grade?.resultKind === kind}
              onClick={() => onPickResult?.(row, kind)}
            >
              {FINAL_RESULT_LABELS[kind]}
            </Button>
          ))}
        </span>
      )}

      {pending && family && (
        <p className="max-w-xs text-center text-11 text-muted">
          Ученик видит «{fullResultLabel(family)}». Ждёт подтверждения: «{fullResultLabel(decided)}»
          {' — '}{authorLabel(pending.changedByName, pending.changedByRole)}
        </p>
      )}

      {row.canConfirmPublication ? (
        <span className="flex flex-col items-center gap-1">
          {!pending && (
            <span className="max-w-xs text-center text-11 text-brand-600">
              Требуется повторное подтверждение: рекомендация теперь {row.recommendedValue}, ученик видит {finalResultLabel(grade)}
            </span>
          )}
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => onRepublish?.(row)}>
            Подтвердить и опубликовать
          </Button>
        </span>
      ) : pending ? (
        <span className="text-11 font-semibold text-amber-700">Подтверждает учитель предмета</span>
      ) : null}

      {(pending && row.canChangeAttestation) || grade?.id ? (
        <span className="flex flex-wrap justify-center gap-2">
          {pending && row.canChangeAttestation && grade && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onRequestStatus?.(row, { kind: grade.resultKind ?? 'NUMERIC', value: grade.value ?? null })}
            >
              Отменить изменение
            </Button>
          )}
          {grade?.id && (
            <Button variant="ghost" size="sm" onClick={() => onOpenHistory?.(row)}>История итога</Button>
          )}
          {finals.canCorrectTechnicalErrors && published && (
            <Button variant="ghost" size="sm" onClick={() => onCorrect?.(row)}>Исправить техническую ошибку</Button>
          )}
        </span>
      ) : null}

      {(!grade?.resultKind || grade.resultKind === 'NUMERIC') && row.publicationIssues?.map((issue) => (
        <p key={issue} className="max-w-sm text-center text-11 text-danger-fg">{issue}</p>
      ))}
    </div>
  );
}

/**
 * Кнопка выбора итога (макет 2098:1382): число или ВНА/НА в одном ряду. Выбранная — navy,
 * как у выбора оценки урока; повторное нажатие по выбранной ничего не меняет.
 */
function ResultButton({
  label,
  title,
  ariaLabel,
  selected,
  onClick,
}: {
  label: string;
  title?: string;
  ariaLabel?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      className={cx(
        'h-[26px] min-w-[26px] rounded-md px-1 text-13 font-bold transition',
        selected ? 'bg-navy-700 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-navy-700',
      )}
    >
      {label}
    </button>
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
