import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { GradeChip } from '@/components/ui/GradeChip';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useMyClassSubjectJournal } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import { cx } from '@/lib/format';
import { gradeValueLabel } from '@/lib/gradesModel';
import { COMPONENT_SHORT, componentsByCode, formatPercent, resultStatusHint } from '@/lib/gradingModel';
import { formatAverage, shortDate } from '@/lib/journalModel';
import {
  buildMyClassJournal,
  capitalize,
  columnEvent,
  defaultMonth,
  gradeTitle,
  isSummative,
  myClassMonths,
  periodNoun,
  type JournalColumn,
  type JournalRow,
  type MyClassMonth,
} from '@/lib/myClassGradesModel';
import { PeriodFilter, SubjectFilter, useMyClassSubject } from './myClassFilters';

type Period = Schema<'MyClassContextPeriodView'>;
type GradeResults = Schema<'MyClassGradeResultsView'>;
type View = 'MONTH' | 'PERIOD';

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * Вкладка «Оценки»: режим периода (Figma 2200:3502) и месяца (Figma 2200:4340).
 *
 * <p>Только чтение: классный руководитель видит оценки и опубликованные итоги своего
 * класса, но ставить их права не получает (my-class-contract), поэтому клетки здесь не
 * ведут в урок, как в журнале предметника. Средний и процент приходят с сервера той же
 * формулой, что у предметника; клиент их только показывает.
 *
 * <p>Месяц — окно внутри периода, а не отдельная выборка: сетка режется по дате урока из
 * тех же оценок периода, поэтому переключение месяцев не ходит на сервер. «Ср. балл» в
 * месяце — за весь период (решение 2026-10-07): так же считает журнал предметника, а
 * месячного среднего сервер не отдаёт. Итога периода в месяце нет, как в макете.
 */
export function MyClassGradesTab({
  classId,
  periods,
  periodId,
  schoolDate,
  onSelectPeriod,
  onForbidden,
}: {
  classId: number;
  periods: Period[];
  periodId: number | null;
  /** Сегодня по часам школы — с него открывается режим месяца. */
  schoolDate: string | undefined;
  onSelectPeriod: (periodId: string) => void;
  onForbidden: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { query: subjectsQuery, subjects, subjectId, selectSubject, correctSubject } = useMyClassSubject(classId, periodId);
  const journalQuery = useMyClassSubjectJournal(classId, periodId, subjectId);
  const period = periods.find((item) => item.id === periodId);
  const noun = periodNoun(period);
  const view: View = searchParams.get('view') === 'month' ? 'MONTH' : 'PERIOD';
  const months = useMemo(() => myClassMonths(periods), [periods]);
  const requestedMonth = searchParams.get('month');
  const month = view === 'MONTH'
    ? months.find((item) => item.academicPeriodId === periodId && item.month === requestedMonth)
      ?? defaultMonth(months, periodId, schoolDate)
    : null;

  useEffect(() => {
    if (isForbidden(subjectsQuery.error) || isForbidden(journalQuery.error)) onForbidden();
  }, [journalQuery.error, onForbidden, subjectsQuery.error]);

  // Предмет, режим и месяц из адреса, которых у класса за этот период нет, не должны молча
  // жить в ссылке. Одна правка на всё: два отдельных replace подряд затирали бы друг друга.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    correctSubject(next);
    if (next.has('view') && next.get('view') !== 'month') next.delete('view');
    if (month == null) next.delete('month');
    else if (requestedMonth !== month.month) next.set('month', month.month);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [correctSubject, month, requestedMonth, searchParams, setSearchParams]);

  // После сбоя связи упали оба запроса; одна кнопка должна поднять оба, а не по очереди.
  function retry() {
    if (subjectsQuery.isError) void subjectsQuery.refetch();
    if (journalQuery.isError) void journalQuery.refetch();
  }

  function selectView(nextView: View) {
    const next = new URLSearchParams(searchParams);
    if (nextView === 'MONTH') {
      next.set('view', 'month');
      const initial = defaultMonth(months, periodId, schoolDate);
      if (initial) next.set('month', initial.month);
    } else {
      next.delete('view');
      next.delete('month');
    }
    setSearchParams(next);
  }

  /** Месяц знает свой период: выбор задаёт обе координаты сразу. */
  function selectMonth(key: string) {
    const option = months.find((item) => item.key === key);
    if (!option) return;
    const next = new URLSearchParams(searchParams);
    next.set('periodId', String(option.academicPeriodId));
    next.set('month', option.month);
    setSearchParams(next);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <SubjectFilter subjects={subjects} subjectId={subjectId} onChange={selectSubject} />
        {view === 'MONTH' ? (
          <FilterSelect
            label="Период"
            className="w-60"
            value={month?.key ?? ''}
            disabled={months.length === 0}
            onChange={selectMonth}
          >
            {months.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </FilterSelect>
        ) : (
          <PeriodFilter periods={periods} periodId={periodId} onChange={onSelectPeriod} />
        )}
        <SegmentedTabs
          value={view}
          ariaLabel="Окно оценок"
          onChange={selectView}
          options={[
            { value: 'MONTH', label: 'Месяц' },
            { value: 'PERIOD', label: capitalize(noun) },
          ]}
        />
      </div>

      <section aria-label="Оценки класса" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
        {periodId == null ? (
          <EmptyBlock icon={<BookOpen className="h-7 w-7" />} title={periods.length === 0
            ? 'Учебные периоды пока не настроены'
            : 'Выберите учебный период, чтобы увидеть оценки'} />
        ) : subjectsQuery.isPending ? <LoadingBlock label="Загрузка предметов…" /> : subjectsQuery.isError ? (
          <ErrorBlock message="Не удалось загрузить оценки." onRetry={retry} />
        ) : subjects.length === 0 ? (
          <EmptyBlock icon={<BookOpen className="h-7 w-7" />} title="У класса пока нет предметов за этот период" />
        ) : journalQuery.isPending ? <LoadingBlock label="Загрузка оценок…" /> : journalQuery.isError ? (
          <ErrorBlock message="Не удалось загрузить оценки." onRetry={retry} />
        ) : (
          <JournalBody classId={classId} noun={noun} month={month} data={journalQuery.data} />
        )}
      </section>
    </div>
  );
}

function JournalBody({
  classId,
  noun,
  month,
  data,
}: {
  classId: number;
  noun: string;
  /** Окно режима «Месяц»; `null` — весь период. */
  month: MyClassMonth | null;
  data: NonNullable<ReturnType<typeof useMyClassSubjectJournal>['data']>;
}) {
  const journal = buildMyClassJournal({
    students: data.students,
    grades: data.grades,
    finals: data.finals,
    results: data.results.items ?? [],
    window: month ? { from: month.dateFrom, to: month.dateTo } : null,
  });
  if (journal.rows.length === 0) return <EmptyBlock title="В классе пока нет учеников" />;
  if (month && journal.columns.length === 0) {
    return <EmptyBlock icon={<BookOpen className="h-7 w-7" />} title="По предмету пока нет оценок за этот месяц" />;
  }
  if (journal.columns.length === 0 && journal.rows.every((row) => row.finals.length === 0)) {
    return <EmptyBlock icon={<BookOpen className="h-7 w-7" />} title="По предмету пока нет оценок за этот период" />;
  }
  return (
    <JournalTable
      classId={classId}
      noun={noun}
      columns={journal.columns}
      rows={journal.rows}
      policy={data.results.policy}
      showFinals={month == null}
    />
  );
}

/**
 * Итоговые колонки закреплены справа, ФИО — слева: оценок в четверти бывает несколько
 * десятков, и без закрепления средний и итог уезжали бы за горизонтальную прокрутку.
 */
const STICKY = 'sticky z-10 bg-surface';
const HEAD = 'border-b border-line bg-canvas text-10 font-bold uppercase tracking-filter';

function JournalTable({
  classId,
  noun,
  columns,
  rows,
  policy,
  showFinals,
}: {
  classId: number;
  noun: string;
  columns: JournalColumn[];
  rows: JournalRow[];
  policy: GradeResults['policy'] | undefined;
  /** В месяце итога периода нет, а средний — за весь период и подписан так. */
  showFinals: boolean;
}) {
  const byPercent = policy != null;
  const resultEdge = showFinals ? 'right-60 border-x' : 'right-0 border-l';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className={cx(STICKY, HEAD, 'left-0 w-44 min-w-44 border-r px-4 py-3 text-left text-slate-400')}>
              ФИО ученика
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(HEAD, 'w-14 min-w-14 border-r px-1 py-2 text-center font-semibold',
                  isSummative(column.kind) && 'bg-info-bg')}
              >
                <span className="block text-slate-400">{shortDate(column.date)}</span>
                <span className={cx('block normal-case', isSummative(column.kind) ? 'text-navy-700' : 'font-normal text-slate-500')}>
                  {columnEvent(column.kind)}
                </span>
              </th>
            ))}
            <th
              scope="col"
              title={byPercent ? weightsTitle(policy) : `Средний балл шкальных оценок за ${noun}`}
              className={cx(STICKY, HEAD, resultEdge, 'w-20 min-w-20 px-2 py-3 text-center text-ink')}
            >
              <span className="block">{byPercent ? 'Итог, %' : 'Ср. балл'}</span>
              {!showFinals && <span className="block font-normal normal-case text-slate-500">за {noun}</span>}
            </th>
            {showFinals && (
              <th scope="col" className={cx(STICKY, HEAD, 'right-0 w-60 min-w-60 px-2 py-3 text-center text-ink')}>
                Итог за {noun}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.studentProfileId} className="border-b border-line last:border-b-0">
              <th
                scope="row"
                title={row.fullName}
                className={cx(STICKY, 'left-0 w-44 min-w-44 max-w-44 truncate border-r border-line px-4 py-2 text-left text-xs font-medium text-ink')}
              >
                {row.shortName}
              </th>
              {columns.map((column) => {
                const grades = row.cells.get(column.key) ?? [];
                return (
                  <td
                    key={column.key}
                    className={cx('border-r border-line px-1 py-2 text-center align-middle',
                      isSummative(column.kind) && 'bg-info-bg')}
                  >
                    {grades.length > 0 ? (
                      <span className="flex items-center justify-center gap-1">
                        {grades.map((grade) => (
                          <GradeChip
                            key={grade.gradeId}
                            size="sm"
                            tone={grade.gradeType === 'SUMMATIVE_SECTION' || grade.gradeType === 'SUMMATIVE_TERM'
                              ? 'outline' : 'soft'}
                            value={gradeValueLabel(grade)}
                            title={gradeTitle(grade, classId)}
                          />
                        ))}
                      </span>
                    ) : (
                      <span className="text-slate-400" aria-label="Нет оценки">—</span>
                    )}
                  </td>
                );
              })}
              <td className={cx(STICKY, resultEdge, 'w-20 min-w-20 border-line px-2 py-2 text-center text-13 font-bold text-ink')}>
                {byPercent ? <PercentCell row={row} /> : (
                  <span title={averageTitle(row)} className={cx(row.result?.averageGrade == null && 'font-normal text-slate-400')}>
                    {formatAverage(row.result?.averageGrade)}
                  </span>
                )}
              </td>
              {showFinals && (
                <td className={cx(STICKY, 'right-0 w-60 min-w-60 px-2 py-2 text-center')}>
                  {row.finals.length > 0 ? (
                    <span className="flex items-center justify-center gap-1">
                      {row.finals.map((final) => (
                        <GradeChip
                          key={final.finalGradeId}
                          size="sm"
                          value={final.value == null ? null : String(final.value)}
                          title={final.publishedAt ? `Опубликован ${shortDate(final.publishedAt.slice(0, 10))}` : undefined}
                        />
                      ))}
                    </span>
                  ) : (
                    <span className="text-slate-400" title="Итог не опубликован">—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function averageTitle(row: JournalRow): string {
  const count = row.result?.scaleGradeCount ?? 0;
  if (count === 0) return 'Шкальных оценок за период нет';
  const one = new Intl.PluralRules('ru-RU').select(count) === 'one';
  return `По ${count} ${one ? 'шкальной оценке' : 'шкальным оценкам'} за период`;
}

/** Процент по политике: значение, а в подсказке — доли компонентов или причина прочерка. */
function PercentCell({ row }: { row: JournalRow }) {
  const result = row.result?.result;
  const parts = [...componentsByCode(result).values()]
    .filter((component) => component.code && component.workCount)
    .map((component) => `${COMPONENT_SHORT[component.code!]} ${formatPercent(component.percent)}`);
  const title = resultStatusHint(result) ?? (parts.length > 0 ? parts.join(' · ') : undefined);
  return result?.roundedPercent != null
    ? <span title={title}>{result.roundedPercent}%</span>
    : <span title={title} className="font-normal text-slate-400">—</span>;
}

function weightsTitle(policy: GradeResults['policy']): string {
  const weights = (policy?.components ?? [])
    .map((component) => `${component.code ? COMPONENT_SHORT[component.code] : '—'} ${component.weightPercent}%`)
    .join(' · ');
  return weights ? `Процент периода по политике оценивания: ${weights}` : 'Процент периода по политике оценивания';
}
