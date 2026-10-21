import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { GradeChip } from '@/components/ui/GradeChip';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import {
  useReportBreakdown,
  useReportFinals,
  useReportSummary,
  type ReportFilter,
  type ReportOwner,
} from '@/hooks/reportingQueries';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import {
  attendanceDisplay,
  averageDisplay,
  counted,
  countDisplay,
  hasPartialData,
  isEmptyReport,
  lessonsDisplay,
  LESSONS,
  namesLabel,
  performanceDisplay,
  periodFinalsByStudent,
  periodLabel,
  SUBJECTS,
  type ReportRow,
} from '@/lib/reportingModel';
import { ReportHeaderCard } from '../reporting/ReportHeaderCard';
import { MetricCell, PartialDataNotice, ReportTable, StudentName, type ReportColumn } from '../reporting/ReportTable';
import { StudentReportDrawer } from '../reporting/StudentReportDrawer';

type Period = Schema<'MyClassContextPeriodView'>;
type View = 'subjects' | 'students';

const collator = new Intl.Collator('ru-RU');

function byName(rows: ReportRow[]): ReportRow[] {
  return [...rows].sort((a, b) => collator.compare(a.key?.name ?? '', b.key?.name ?? '') || (a.key?.id ?? 0) - (b.key?.id ?? 0));
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

function idParam(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * «Мой класс → Отчётность» (Figma 2196:22919, 2196:22973, 2196:23027, 2196:23092).
 *
 * <p>Все числа — ответы `/academic-reports` своего класса: клиент не складывает и не
 * усредняет. Вид, предмет детализации и открытый ученик живут в адресе рядом с классом
 * и периодом страницы, поэтому обновление страницы и «назад» возвращают тот же экран, а
 * смена класса сбрасывает выбор, чтобы данные одного класса не смешались с другим.
 */
export function MyClassReportTab({
  classId,
  className,
  academicYearId,
  yearName,
  periods,
  periodId,
  onSelectPeriod,
  onForbidden,
}: {
  classId: number;
  className: string;
  academicYearId: number | null;
  yearName: string;
  periods: Period[];
  periodId: number | null;
  onSelectPeriod: (periodId: string) => void;
  onForbidden: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = searchParams.get('reportView') === 'students' ? 'students' : 'subjects';
  const subjectId = idParam(searchParams.get('reportSubject'));
  const studentId = idParam(searchParams.get('reportStudent'));
  const period = periods.find((item) => item.id === periodId);
  const owner: ReportOwner = useMemo(() => ({ kind: 'homeroom', classId }), [classId]);
  const filter: ReportFilter | null = academicYearId == null || periodId == null
    ? null
    : { academicYearId, academicPeriodId: periodId };
  const subjectFilter = filter && subjectId != null ? { ...filter, subjectId } : null;

  const summary = useReportSummary(owner, subjectFilter ?? filter);
  const subjectRows = useReportBreakdown(owner, filter, 'SUBJECT');
  const studentRows = useReportBreakdown(owner, subjectFilter ?? filter, subjectId != null || view === 'students' ? 'STUDENT' : null);
  const finals = useReportFinals(owner, subjectFilter);

  useEffect(() => {
    if ([summary.error, subjectRows.error, studentRows.error, finals.error].some(isForbidden)) onForbidden();
  }, [finals.error, onForbidden, studentRows.error, subjectRows.error, summary.error]);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(changes)) {
      if (value == null) next.delete(name);
      else next.set(name, value);
    }
    setSearchParams(next);
  }

  const subjects = byName(subjectRows.data?.rows ?? []);
  const students = byName(studentRows.data?.rows ?? []);
  const subjectRow = subjects.find((row) => row.key?.id === subjectId);
  const context = `Данные за ${periodLabel(period)} · ${yearName}`;
  const queries = subjectId != null ? [summary, studentRows, subjectRows] : [summary, view === 'students' ? studentRows : subjectRows];
  const pending = queries.some((query) => query.isPending);
  const failed = queries.some((query) => query.isError);
  const studentRefs = students.map((row) => row.key!).filter((key) => key?.id != null);
  const openStudent = studentRefs.find((item) => item.id === studentId);
  const previousPeriod = period ? periods
    .filter((item) => item.startDate && period.startDate && item.startDate < period.startDate)
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))[0] : undefined;

  return (
    <div className="space-y-5">
      {subjectId != null && (
        <button type="button" onClick={() => update({ reportSubject: null, reportStudent: null })}
          className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Ко всем предметам
        </button>
      )}
      {subjectId != null && (
        <ReportHeaderCard
          title={subjectRow?.key?.name ?? 'Предмет'}
          subtitle={[namesLabel(subjectRow?.attributes?.teachers), className,
            summary.data?.metrics?.lessons?.completedLessonCount == null
              ? null : counted(summary.data.metrics.lessons.completedLessonCount, LESSONS)]
            .filter(Boolean).join(' · ')}
          metrics={summary.data?.metrics}
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect label="Учебный год" className="w-44" value="current" disabled onChange={() => undefined}>
          <option value="current">{yearName}</option>
        </FilterSelect>
        <FilterSelect label="Период" className="w-64" value={periodId == null ? '' : String(periodId)}
          disabled={periods.length === 0} onChange={(value) => { update({ reportStudent: null }); onSelectPeriod(value); }}>
          {periodId == null && <option value="">Выберите период</option>}
          {periods.filter((item) => item.id != null).map((item) => (
            <option key={item.id} value={item.id}>{periodLabel(item)}</option>
          ))}
        </FilterSelect>
        {subjectId == null && (
          <SegmentedTabs
            value={view}
            ariaLabel="Представление отчётности"
            onChange={(value) => update({ reportView: value === 'students' ? 'students' : null, reportStudent: null })}
            options={[{ value: 'subjects', label: 'По предметам' }, { value: 'students', label: 'По ученикам' }]}
          />
        )}
      </div>

      {filter == null ? (
        <EmptyBlock icon={<CalendarDays className="h-7 w-7" />} title={periods.length === 0
          ? 'Учебные периоды пока не настроены'
          : 'Выберите учебный период, чтобы увидеть отчётность'} />
      ) : pending ? <LoadingBlock label="Загрузка отчётности…" /> : failed ? (
        <ErrorBlock message="Не удалось загрузить отчётность." onRetry={() => queries.forEach((query) => void query.refetch())} />
      ) : isEmptyReport(summary.data?.metrics) ? (
        <section className="rounded-2xl border border-line bg-surface shadow-soft">
          <EmptyBlock
            icon={<CalendarDays className="h-7 w-7" />}
            title="Нет данных за выбранный период"
            description="Период ещё не начался или данные не внесены. Измените период."
            action={previousPeriod?.id != null ? (
              <Button variant="secondary" size="sm" onClick={() => onSelectPeriod(String(previousPeriod.id))}>
                Показать {previousPeriod.name}
              </Button>
            ) : undefined}
          />
        </section>
      ) : (
        <>
          <p className="text-13 text-slate-500">
            {context} · {subjectId != null
              ? `Ученики ${className} по предмету «${subjectRow?.key?.name ?? ''}»`
              : view === 'students' ? `Ученики ${className} по всем предметам` : `${className} по предметам`}
          </p>
          {hasPartialData(subjectId != null || view === 'students' ? students : subjects) && (
            <PartialDataNotice subject={subjectId != null || view === 'students' ? 'учеников' : 'предметов'} />
          )}
          {subjectId != null ? (
            <SubjectStudentsTable rows={students} finals={periodFinalsByStudent(finals.data ?? [], subjectId)}
              finalsReady={!finals.isPending} periodName={period?.name}
              selectedId={studentId} onOpen={(id) => update({ reportStudent: String(id) })} />
          ) : view === 'students' ? (
            <ReportTable
              label="Отчётность по ученикам"
              rows={students}
              rowKey={(row) => row.key?.id ?? 0}
              rowLabel={(row) => `Открыть карточку: ${row.key?.name}`}
              selectedKey={studentId}
              onOpen={(row) => update({ reportStudent: String(row.key?.id) })}
              total={{ caption: 'итого', title: 'Весь класс' }}
              columns={studentColumns(summary.data?.metrics)}
            />
          ) : (
            <ReportTable
              label="Отчётность по предметам"
              rows={subjects}
              rowKey={(row) => row.key?.id ?? 0}
              rowLabel={(row) => `Открыть предмет ${row.key?.name}`}
              onOpen={(row) => update({ reportSubject: String(row.key?.id), reportStudent: null })}
              total={{ caption: 'итого', title: 'Весь класс' }}
              columns={subjectColumns(summary.data?.metrics, subjectRows.data?.total ?? subjects.length)}
            />
          )}
        </>
      )}

      {openStudent && filter && (
        <StudentReportDrawer
          owner={owner}
          filter={filter}
          student={openStudent}
          className={className}
          context={`Данные за ${periodLabel(period)}`}
          students={studentRefs}
          highlightSubjectId={subjectId}
          onSelect={(id) => update({ reportStudent: String(id) })}
          onClose={() => update({ reportStudent: null })}
        />
      )}
    </div>
  );
}

function subjectColumns(total: ReportRow['metrics'], subjectCount: number): ReportColumn<ReportRow>[] {
  return [
    { key: 'subject', header: 'Предмет', className: 'w-56', cell: (row) => row.key?.name },
    {
      key: 'teacher', header: 'Учитель', cell: (row) => namesLabel(row.attributes?.teachers) || <span className="text-slate-400">—</span>,
      total: counted(subjectCount, SUBJECTS),
    },
    { key: 'lessons', header: 'Уроков', align: 'right', cell: (row) => <MetricCell value={lessonsDisplay(row.metrics)} />,
      total: <MetricCell value={lessonsDisplay(total)} strong /> },
    { key: 'average', header: 'Ср. балл', align: 'right', cell: (row) => <MetricCell value={averageDisplay(row.metrics)} />,
      total: <MetricCell value={averageDisplay(total)} strong /> },
    { key: 'performance', header: 'Успеваемость', align: 'right', cell: (row) => <MetricCell value={performanceDisplay(row.metrics)} />,
      total: <MetricCell value={performanceDisplay(total)} strong /> },
    { key: 'attendance', header: 'Посещаемость', align: 'right', cell: (row) => <MetricCell value={attendanceDisplay(row.metrics)} />,
      total: <MetricCell value={attendanceDisplay(total)} strong /> },
  ];
}

export function studentColumns(total: ReportRow['metrics']): ReportColumn<ReportRow>[] {
  return [
    { key: 'student', header: 'Ученик', className: 'w-72', cell: (row) => <StudentName name={row.key?.name ?? ''} /> },
    { key: 'average', header: 'Ср. балл', align: 'right', cell: (row) => <MetricCell value={averageDisplay(row.metrics)} />,
      total: <MetricCell value={averageDisplay(total)} strong /> },
    { key: 'missed', header: 'Пропуски', align: 'right', cell: (row) => <MetricCell value={countDisplay(row.metrics?.attendance?.missedCount)} />,
      total: <MetricCell value={countDisplay(total?.attendance?.missedCount)} strong /> },
    { key: 'late', header: 'Опоздания', align: 'right', cell: (row) => <MetricCell value={countDisplay(row.metrics?.attendance?.lateCount)} />,
      total: <MetricCell value={countDisplay(total?.attendance?.lateCount)} strong /> },
    { key: 'attendance', header: 'Посещаемость', align: 'right', cell: (row) => <MetricCell value={attendanceDisplay(row.metrics)} />,
      total: <MetricCell value={attendanceDisplay(total)} strong /> },
  ];
}

/** Ученики по одному предмету (Figma 2196:23027): оценки, средний, итог периода, пропуски. */
export function SubjectStudentsTable({
  rows,
  finals,
  finalsReady,
  periodName,
  selectedId,
  onOpen,
}: {
  rows: ReportRow[];
  finals: Map<number, number>;
  finalsReady: boolean;
  periodName?: string;
  selectedId: number | null;
  onOpen: (studentId: number) => void;
}) {
  return (
    <ReportTable
      label="Ученики по предмету"
      rows={rows}
      rowKey={(row) => row.key?.id ?? 0}
      rowLabel={(row) => `Открыть карточку: ${row.key?.name}`}
      selectedKey={selectedId}
      onOpen={(row) => row.key?.id != null && onOpen(row.key.id)}
      columns={[
        { key: 'student', header: 'Ученик', className: 'w-72', cell: (row) => <StudentName name={row.key?.name ?? ''} /> },
        { key: 'grades', header: 'Оценок', align: 'right', cell: (row) => <MetricCell value={countDisplay(row.metrics?.grades?.gradeCount)} /> },
        { key: 'average', header: 'Ср. балл', align: 'right', cell: (row) => <MetricCell value={averageDisplay(row.metrics)} /> },
        {
          key: 'final', header: periodName ? `Итог за ${periodName.replace(/^\d+\s*/, '')}` : 'Итог', align: 'right',
          cell: (row) => {
            const value = row.key?.id == null ? undefined : finals.get(row.key.id);
            if (!finalsReady) return <span className="text-slate-400">…</span>;
            return value == null
              ? <span className="text-slate-400" title="Итог за период не опубликован">—</span>
              : <span className="flex justify-end"><GradeChip size="sm" value={String(value)} /></span>;
          },
        },
        { key: 'missed', header: 'Пропуски', align: 'right', cell: (row) => <MetricCell value={countDisplay(row.metrics?.attendance?.missedCount)} /> },
        { key: 'attendance', header: 'Посещаемость', align: 'right', cell: (row) => <MetricCell value={attendanceDisplay(row.metrics)} /> },
      ]}
    />
  );
}
