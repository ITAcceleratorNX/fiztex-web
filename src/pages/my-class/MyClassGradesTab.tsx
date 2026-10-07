import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { GradeChip } from '@/components/ui/GradeChip';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useMyClassSubjectJournal, useMyClassSubjects } from '@/hooks/queries';
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
  defaultSubjectId,
  gradeTitle,
  isSummative,
  periodLabel,
  periodNoun,
  type JournalColumn,
  type JournalRow,
} from '@/lib/myClassGradesModel';

type Period = Schema<'MyClassContextPeriodView'>;
type GradeResults = Schema<'MyClassGradeResultsView'>;

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * Вкладка «Оценки» в режиме периода (Figma 2200:3502).
 *
 * <p>Только чтение: классный руководитель видит оценки и опубликованные итоги своего
 * класса, но ставить их права не получает (my-class-contract), поэтому клетки здесь не
 * ведут в урок, как в журнале предметника. Средний и процент приходят с сервера той же
 * формулой, что у предметника; клиент их только показывает.
 */
export function MyClassGradesTab({
  classId,
  periods,
  periodId,
  onSelectPeriod,
  onForbidden,
}: {
  classId: number;
  periods: Period[];
  periodId: number | null;
  onSelectPeriod: (periodId: string) => void;
  onForbidden: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const subjectsQuery = useMyClassSubjects(classId, periodId);
  const subjects = subjectsQuery.data?.items ?? [];
  const requestedSubjectId = Number(searchParams.get('subjectId'));
  const subjectId = subjects.find((subject) => subject.subjectId === requestedSubjectId)?.subjectId
    ?? defaultSubjectId(subjects);
  const journalQuery = useMyClassSubjectJournal(classId, periodId, subjectId);
  const period = periods.find((item) => item.id === periodId);
  const noun = periodNoun(period);

  useEffect(() => {
    if (isForbidden(subjectsQuery.error) || isForbidden(journalQuery.error)) onForbidden();
  }, [journalQuery.error, onForbidden, subjectsQuery.error]);

  // Предмет из адреса, которого у класса нет за этот период, не должен молча жить в ссылке.
  useEffect(() => {
    if (!subjectsQuery.data || !searchParams.has('subjectId')) return;
    if (requestedSubjectId === subjectId) return;
    const next = new URLSearchParams(searchParams);
    if (subjectId == null) next.delete('subjectId');
    else next.set('subjectId', String(subjectId));
    setSearchParams(next, { replace: true });
  }, [requestedSubjectId, searchParams, setSearchParams, subjectId, subjectsQuery.data]);

  // После сбоя связи упали оба запроса; одна кнопка должна поднять оба, а не по очереди.
  function retry() {
    if (subjectsQuery.isError) void subjectsQuery.refetch();
    if (journalQuery.isError) void journalQuery.refetch();
  }

  function selectSubject(nextId: string) {
    const next = new URLSearchParams(searchParams);
    next.set('subjectId', nextId);
    setSearchParams(next);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Предмет"
          className="w-60"
          value={subjectId == null ? '' : String(subjectId)}
          disabled={subjects.length === 0}
          onChange={selectSubject}
        >
          {subjects.map((subject) => (
            <option key={subject.subjectId} value={subject.subjectId}>{subject.subjectName}</option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Период"
          className="w-60"
          value={periodId == null ? '' : String(periodId)}
          disabled={periods.length === 0}
          onChange={onSelectPeriod}
        >
          {periods.filter((item) => item.id != null).map((item) => (
            <option key={item.id} value={item.id}>{periodLabel(item)}</option>
          ))}
        </FilterSelect>
        <SegmentedTabs
          value="PERIOD"
          ariaLabel="Окно оценок"
          onChange={() => undefined}
          options={[
            { value: 'MONTH', label: 'Месяц', disabled: true },
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
          <JournalBody classId={classId} noun={noun} data={journalQuery.data} />
        )}
      </section>
    </div>
  );
}

function JournalBody({
  classId,
  noun,
  data,
}: {
  classId: number;
  noun: string;
  data: NonNullable<ReturnType<typeof useMyClassSubjectJournal>['data']>;
}) {
  const journal = buildMyClassJournal({
    students: data.students,
    grades: data.grades,
    finals: data.finals,
    results: data.results.items ?? [],
  });
  if (journal.rows.length === 0) return <EmptyBlock title="В классе пока нет учеников" />;
  if (journal.columns.length === 0 && journal.rows.every((row) => row.finals.length === 0)) {
    return <EmptyBlock icon={<BookOpen className="h-7 w-7" />} title="По предмету пока нет оценок за этот период" />;
  }
  return <JournalTable classId={classId} noun={noun} columns={journal.columns} rows={journal.rows} policy={data.results.policy} />;
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
}: {
  classId: number;
  noun: string;
  columns: JournalColumn[];
  rows: JournalRow[];
  policy: GradeResults['policy'] | undefined;
}) {
  const byPercent = policy != null;
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
              title={byPercent ? weightsTitle(policy) : 'Средний балл шкальных оценок за период'}
              className={cx(STICKY, HEAD, 'right-60 w-20 min-w-20 border-x px-2 py-3 text-center text-ink')}
            >
              {byPercent ? 'Итог, %' : 'Ср. балл'}
            </th>
            <th scope="col" className={cx(STICKY, HEAD, 'right-0 w-60 min-w-60 px-2 py-3 text-center text-ink')}>
              Итог за {noun}
            </th>
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
              <td className={cx(STICKY, 'right-60 w-20 min-w-20 border-x border-line px-2 py-2 text-center text-13 font-bold text-ink')}>
                {byPercent ? <PercentCell row={row} /> : (
                  <span title={averageTitle(row)} className={cx(row.result?.averageGrade == null && 'font-normal text-slate-400')}>
                    {formatAverage(row.result?.averageGrade)}
                  </span>
                )}
              </td>
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
