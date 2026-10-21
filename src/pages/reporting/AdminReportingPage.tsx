import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import {
  useReportBreakdown,
  useReportClasses,
  useReportDimensionTotal,
  useReportFinals,
  useReportPeriods,
  useReportSubjects,
  useReportSummary,
  useReportYears,
  type ReportDimension,
  type ReportFilter,
  type ReportOwner,
} from '@/hooks/reportingQueries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cx } from '@/lib/format';
import {
  attendanceDisplay,
  averageDisplay,
  CLASSES,
  counted,
  formatCount,
  hasPartialData,
  HOMEROOMS,
  isEmptyReport,
  lessonsDisplay,
  LESSONS,
  namesLabel,
  performanceDisplay,
  periodFinalsByStudent,
  periodLabel,
  STUDENTS,
  SUBJECTS,
  TEACHERS,
  yearLabel,
  type ReportMetrics,
  type ReportRow,
} from '@/lib/reportingModel';
import { studentColumns, SubjectStudentsTable } from '../my-class/MyClassReportTab';
import { ReportHeaderCard } from './ReportHeaderCard';
import { MetricCell, PartialDataNotice, ReportTable, type ReportColumn } from './ReportTable';
import { StudentReportDrawer } from './StudentReportDrawer';

const ADMIN: ReportOwner = { kind: 'admin' };
const collator = new Intl.Collator('ru-RU', { numeric: true });

type SchoolView = 'classes' | 'subjects' | 'teachers';
type Mode = 'school' | 'class' | 'subject' | 'teacher' | 'classSubject';

function idParam(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function byName(rows: ReportRow[]): ReportRow[] {
  return [...rows].sort((a, b) => collator.compare(a.key?.name ?? '', b.key?.name ?? '') || (a.key?.id ?? 0) - (b.key?.id ?? 0));
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Параметры детализации — сбрасываются вместе, когда пользователь уходит на уровень выше. */
const DRILL = ['classId', 'subjectId', 'teacherId', 'view', 'student'];

/**
 * Раздел «Отчётность» администратора (Figma 2196:23940 и соседние): сводка по школе,
 * разрезы «По классам / По предметам / По учителям» и детализация до ученика.
 *
 * <p>Состояние — в адресе: год, период, фильтры, вид и открытый ученик. Детализация —
 * это те же фильтры отчёта (класс, предмет, учитель), поэтому переход вглубь и выбор в
 * фильтре приводят к одному экрану, обновление страницы его сохраняет, а год и период
 * при переходах не меняются, пока пользователь не выберет другие.
 *
 * <p>Числа — ответы `/api/admin/academic-reports`; клиент их не пересчитывает. «Итого» —
 * сводка сервера по тому же срезу, а не сумма строк.
 */
export function AdminReportingPage() {
  useDocumentTitle('Отчётность');
  const [searchParams, setSearchParams] = useSearchParams();
  const years = useReportYears();
  const yearList = useMemo(() => [...(years.data?.content ?? [])]
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? '')), [years.data]);
  const requestedYear = idParam(searchParams.get('year'));
  const year = yearList.find((item) => item.id === requestedYear)
    ?? yearList.find((item) => item.status === 'ACTIVE')
    ?? yearList[0];
  const yearId = year?.id ?? null;

  const periodsQuery = useReportPeriods(yearId);
  const periods = useMemo(() => [...(periodsQuery.data ?? [])]
    .filter((item) => item.status !== 'ARCHIVED')
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')), [periodsQuery.data]);
  const periodParam = searchParams.get('period');
  const period = periodParam === 'all' ? null
    : periods.find((item) => item.id === idParam(periodParam))
      ?? periods.find((item) => item.startDate && item.endDate && item.startDate <= today() && today() <= item.endDate)
      ?? null;

  const classes = useReportClasses(yearId);
  const subjectsCatalog = useReportSubjects();
  const classId = idParam(searchParams.get('classId'));
  const subjectId = idParam(searchParams.get('subjectId'));
  const teacherId = idParam(searchParams.get('teacherId'));
  const studentId = idParam(searchParams.get('student'));
  const className = classes.data?.content?.find((item) => item.id === classId)?.name;
  const subjectName = subjectsCatalog.data?.content?.find((item) => item.id === subjectId)?.name;

  const mode: Mode = classId != null && subjectId != null ? 'classSubject'
    : classId != null ? 'class'
      : subjectId != null ? 'subject'
        : teacherId != null ? 'teacher' : 'school';
  const schoolView: SchoolView = searchParams.get('view') === 'subjects' ? 'subjects'
    : searchParams.get('view') === 'teachers' ? 'teachers' : 'classes';
  const classView = searchParams.get('view') === 'students' ? 'students' : 'subjects';

  const filter: ReportFilter | null = yearId == null || periodsQuery.isPending || periodsQuery.isError ? null : {
    academicYearId: yearId,
    academicPeriodId: period?.id ?? null,
    classId,
    subjectId,
    teacherProfileId: teacherId,
  };
  const dimension: ReportDimension = mode === 'school'
    ? (schoolView === 'classes' ? 'CLASS' : schoolView === 'subjects' ? 'SUBJECT' : 'TEACHER')
    : mode === 'class' ? (classView === 'students' ? 'STUDENT' : 'SUBJECT')
      : mode === 'classSubject' ? 'STUDENT' : 'CLASS';

  const summary = useReportSummary(ADMIN, filter);
  const rows = useReportBreakdown(ADMIN, filter, dimension);
  // Учителя зависят от класса и предмета, а не от выбранного учителя (ТЗ §4.1).
  const teacherOptions = useReportBreakdown(ADMIN, filter && { ...filter, teacherProfileId: null }, 'TEACHER');
  // Шапки детализации: строка класса/учителя несёт кл. руководителя, состав, предметы.
  const classRow = useReportBreakdown(ADMIN, filter && classId != null ? { ...filter, subjectId: null, teacherProfileId: null } : null,
    classId != null ? 'CLASS' : null);
  const teacherRow = useReportBreakdown(ADMIN, filter && mode === 'teacher' ? filter : null, mode === 'teacher' ? 'TEACHER' : null);
  const totals = {
    teachers: useReportDimensionTotal(ADMIN, filter, mode === 'school' && schoolView === 'subjects' ? 'TEACHER' : mode === 'subject' ? 'TEACHER' : null),
    subjects: useReportDimensionTotal(ADMIN, filter, mode === 'school' && schoolView === 'teachers' ? 'SUBJECT' : null),
    classes: useReportDimensionTotal(ADMIN, filter, mode === 'school' && schoolView === 'teachers' ? 'CLASS' : null),
  };
  const finals = useReportFinals(ADMIN, mode === 'classSubject' ? filter : null);

  const teachers = byName(teacherOptions.data?.rows ?? []);
  const teacherName = teachers.find((row) => row.key?.id === teacherId)?.key?.name
    ?? teacherRow.data?.rows.find((row) => row.key?.id === teacherId)?.key?.name;
  const sorted = byName(rows.data?.rows ?? []);
  const studentRefs = dimension === 'STUDENT' ? sorted.map((row) => row.key!).filter((key) => key?.id != null) : [];
  const openStudent = studentRefs.find((item) => item.id === studentId);

  useEffect(() => {
    // Ученик в адресе, которого нет в текущей таблице, не должен открывать чужую карточку.
    if (studentId != null && rows.data && dimension === 'STUDENT' && !openStudent) {
      const next = new URLSearchParams(searchParams);
      next.delete('student');
      setSearchParams(next, { replace: true });
    }
  }, [dimension, openStudent, rows.data, searchParams, setSearchParams, studentId]);

  function update(changes: Record<string, string | null>, drop: string[] = []) {
    const next = new URLSearchParams(searchParams);
    drop.forEach((name) => next.delete(name));
    for (const [name, value] of Object.entries(changes)) {
      if (value == null) next.delete(name);
      else next.set(name, value);
    }
    setSearchParams(next);
  }

  const resetFilters = () => update({}, DRILL);
  const yearText = yearLabel(year);
  const scopeText = [className, subjectName && `«${subjectName}»`, teacherName].filter(Boolean).join(' · ') || 'Вся школа';
  const previousPeriod = period ? [...periods].reverse().find((item) => (item.startDate ?? '') < (period.startDate ?? '')) : undefined;
  const loading = years.isPending || periodsQuery.isPending || summary.isPending || rows.isPending;
  const failed = years.isError || periodsQuery.isError || summary.isError || rows.isError;
  const singleTeacher = classId != null && subjectId != null && teachers.length === 1 ? teachers[0] : null;

  return (
    <div className="space-y-5">
      <h1 className="text-28 font-bold text-ink">Отчётность</h1>

      {mode !== 'school' && (
        <button
          type="button"
          onClick={() => (mode === 'classSubject' ? update({ subjectId: null, student: null, view: null }) : resetFilters())}
          className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {mode === 'classSubject' ? 'Назад' : 'К отчётности по школе'}
        </button>
      )}

      {mode !== 'school' && summary.data && !isEmptyReport(summary.data.metrics) && (
        <DetailHeader
          mode={mode}
          className={className}
          subjectName={subjectName}
          teacherName={teacherName}
          metrics={summary.data.metrics}
          classAttributes={classRow.data?.rows[0]?.attributes}
          teacherAttributes={teacherRow.data?.rows[0]?.attributes}
          subjectTeachers={teachers}
          teacherCount={totals.teachers.data}
          studentCount={summary.data.currentStudentCount}
        />
      )}

      <div className="grid gap-3 md:grid-cols-[minmax(0,10rem)_minmax(0,16rem)_minmax(0,10rem)_minmax(0,14rem)_minmax(0,16rem)]">
        <FilterSelect label="Учебный год" value={yearId == null ? '' : String(yearId)} disabled={yearList.length === 0}
          onChange={(value) => update({ year: value }, ['period', ...DRILL])}>
          {yearList.map((item) => <option key={item.id} value={item.id}>{yearLabel(item)}</option>)}
        </FilterSelect>
        <FilterSelect label="Период" value={period?.id == null ? 'all' : String(period.id)} disabled={yearId == null}
          onChange={(value) => update({ period: value, student: null })}>
          <option value="all">Весь учебный год</option>
          {periods.map((item) => <option key={item.id} value={item.id}>{periodLabel(item)}</option>)}
        </FilterSelect>
        <FilterSelect label="Класс" value={classId == null ? '' : String(classId)}
          onChange={(value) => update({ classId: value || null, student: null, view: null })}>
          <option value="">Все классы</option>
          {[...(classes.data?.content ?? [])].sort((a, b) => collator.compare(a.name ?? '', b.name ?? ''))
            .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </FilterSelect>
        <FilterSelect label="Предмет" value={subjectId == null ? '' : String(subjectId)}
          onChange={(value) => update({ subjectId: value || null, student: null, view: null })}>
          <option value="">Все предметы</option>
          {[...(subjectsCatalog.data?.content ?? [])].sort((a, b) => collator.compare(a.name ?? '', b.name ?? ''))
            .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </FilterSelect>
        <div>
          <FilterSelect label="Учитель" value={singleTeacher ? String(singleTeacher.key?.id) : teacherId == null ? '' : String(teacherId)}
            disabled={singleTeacher != null}
            onChange={(value) => update({ teacherId: value || null, student: null })}>
            {singleTeacher
              ? [<option key="only" value={singleTeacher.key?.id}>{singleTeacher.key?.name}</option>]
              : [
                <option key="all" value="">{classId != null && subjectId != null ? 'Все учителя предмета' : 'Все учителя'}</option>,
                ...teachers.map((row) => <option key={row.key?.id} value={row.key?.id}>{row.key?.name}</option>),
              ]}
          </FilterSelect>
          {classId != null && subjectId != null && teachers.length > 0 && (
            <p className="mt-1 text-11 text-slate-500">{singleTeacher
              ? 'Определяется классом и предметом'
              : `Предмет ведут ${counted(teachers.length, TEACHERS)} (подгруппы)`}</p>
          )}
        </div>
      </div>

      {(classId != null || subjectId != null || teacherId != null) && (
        <div className="flex flex-wrap items-center gap-2">
          {className && <Chip label={className} onRemove={() => update({ classId: null, student: null, view: null })} />}
          {subjectName && <Chip label={subjectName} onRemove={() => update({ subjectId: null, student: null })} />}
          {teacherName && <Chip label={teacherName} onRemove={() => update({ teacherId: null, student: null })} />}
          <button type="button" onClick={resetFilters} className="text-13 text-slate-500 hover:text-navy-700">Сбросить все</button>
        </div>
      )}

      <p className="text-13 text-slate-500">
        Данные за <span className="font-semibold text-slate-700">{periodLabel(period)}</span> · {yearText} · {scopeText}
      </p>

      {years.isPending ? <LoadingBlock label="Загрузка отчётности…" /> : years.isError ? (
        <ErrorBlock message="Не удалось загрузить учебные годы." onRetry={() => void years.refetch()} />
      ) : yearId == null ? (
        <EmptyBlock icon={<CalendarDays className="h-7 w-7" />} title="Учебные годы ещё не созданы"
          description="Чтобы появилась отчётность, создайте учебный год в разделе «Учебный год»." />
      ) : periodsQuery.isError ? (
        <ErrorBlock message="Не удалось загрузить учебные периоды." onRetry={() => void periodsQuery.refetch()} />
      ) : loading ? <LoadingBlock label="Загрузка отчётности…" /> : failed ? (
        <ErrorBlock message="Не удалось загрузить отчётность." onRetry={() => {
          void years.refetch(); void periodsQuery.refetch(); void summary.refetch(); void rows.refetch();
        }} />
      ) : isEmptyReport(summary.data?.metrics) ? (
        <section className="rounded-2xl border border-line bg-surface shadow-soft">
          <EmptyBlock
            icon={<CalendarDays className="h-7 w-7" />}
            title="Нет данных за выбранный период"
            description="Период ещё не начался или данные не внесены. Измените период или сбросьте фильтры."
            action={(
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="secondary" size="sm" onClick={resetFilters}>Сбросить фильтры</Button>
                {previousPeriod?.id != null && (
                  <Button variant="ghost" size="sm" onClick={() => update({ period: String(previousPeriod.id) })}>
                    Показать {previousPeriod.name}
                  </Button>
                )}
              </div>
            )}
          />
        </section>
      ) : (
        <>
          {mode === 'school' && (
            <SegmentedTabs value={schoolView} ariaLabel="Разрез отчётности" onChange={(value) => update({ view: value === 'classes' ? null : value })}
              options={[{ value: 'classes', label: 'По классам' }, { value: 'subjects', label: 'По предметам' }, { value: 'teachers', label: 'По учителям' }]} />
          )}
          {mode === 'class' && (
            <SegmentedTabs value={classView} ariaLabel="Представление класса" onChange={(value) => update({ view: value === 'students' ? 'students' : null, student: null })}
              options={[{ value: 'subjects', label: 'По предметам' }, { value: 'students', label: 'По ученикам' }]} />
          )}
          {hasPartialData(sorted) && <PartialDataNotice subject={partialSubject(dimension)} />}
          <ReportBody
            mode={mode}
            dimension={dimension}
            rows={sorted}
            total={summary.data?.metrics}
            studentCount={summary.data?.currentStudentCount ?? null}
            teacherTotal={totals.teachers.data}
            subjectTotal={totals.subjects.data}
            classTotal={totals.classes.data}
            finals={periodFinalsByStudent(finals.data ?? [], subjectId)}
            finalsReady={!finals.isPending || mode !== 'classSubject'}
            periodName={period?.name}
            selectedStudentId={studentId}
            onOpen={(row) => {
              const id = row.key?.id;
              if (id == null) return;
              if (dimension === 'STUDENT') update({ student: String(id) });
              else if (dimension === 'CLASS') {
                const only = row.attributes?.subjects?.length === 1 && mode === 'teacher' ? row.attributes.subjects[0].id : null;
                update({ classId: String(id), view: null, ...(only != null ? { subjectId: String(only) } : {}) });
              } else if (dimension === 'SUBJECT') update({ subjectId: String(id), view: null });
              else update({ teacherId: String(id), view: null });
            }}
          />
        </>
      )}

      {openStudent && filter && classId != null && (
        <StudentReportDrawer
          owner={ADMIN}
          filter={filter}
          student={openStudent}
          className={className ?? ''}
          context={`Данные за ${periodLabel(period)}`}
          students={studentRefs}
          highlightSubjectId={subjectId}
          onSelect={(id) => update({ student: String(id) })}
          onClose={() => update({ student: null })}
        />
      )}
    </div>
  );
}

function partialSubject(dimension: ReportDimension): string {
  return dimension === 'CLASS' ? 'классов' : dimension === 'SUBJECT' ? 'предметов' : dimension === 'TEACHER' ? 'учителей' : 'учеников';
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-info-bg px-2.5 py-1 text-13 font-semibold text-navy-700">
      {label}
      <button type="button" aria-label={`Убрать фильтр ${label}`} onClick={onRemove} className="rounded hover:text-ink">
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

function DetailHeader({
  mode, className, subjectName, teacherName, metrics, classAttributes, teacherAttributes, subjectTeachers, teacherCount, studentCount,
}: {
  mode: Mode;
  className?: string;
  subjectName?: string;
  teacherName?: string;
  metrics: ReportMetrics | undefined;
  classAttributes: ReportRow['attributes'];
  teacherAttributes: ReportRow['attributes'];
  subjectTeachers: ReportRow[];
  teacherCount: number | undefined;
  studentCount: number | null | undefined;
}) {
  const lessons = metrics?.lessons?.completedLessonCount;
  const lessonText = lessons == null ? null : counted(lessons, LESSONS);
  if (mode === 'class') {
    const homeroom = classAttributes?.homeroomTeacher?.name;
    return (
      <ReportHeaderCard title={`${className ?? 'Класс'} класс`} badge={(className ?? '').replace(/[«»"\s]/g, '')} metrics={metrics}
        subtitle={[homeroom ? `Кл. руководитель ${homeroom}` : 'Кл. руководитель не назначен',
          studentCount == null ? null : counted(studentCount, STUDENTS), lessonText].filter(Boolean).join(' · ')} />
    );
  }
  if (mode === 'classSubject') {
    const names = namesLabel(subjectTeachers.map((row) => row.key!).filter(Boolean));
    return (
      <ReportHeaderCard title={`${subjectName ?? 'Предмет'} · ${className ?? ''}`} badge={undefined} metrics={metrics}
        subtitle={[names && (subjectTeachers.length > 1 ? `${names} (подгруппы)` : names), lessonText].filter(Boolean).join(' · ')} />
    );
  }
  if (mode === 'subject') {
    return (
      <ReportHeaderCard title={subjectName ?? 'Предмет'} metrics={metrics}
        subtitle={['Вся школа', teacherCount == null ? null : counted(teacherCount, TEACHERS), lessonText].filter(Boolean).join(' · ')} />
    );
  }
  return (
    <ReportHeaderCard title={teacherName ?? 'Учитель'} round metrics={metrics}
      subtitle={[namesLabel(teacherAttributes?.subjects, 3),
        teacherAttributes?.classCount == null ? null : counted(teacherAttributes.classCount, CLASSES), lessonText]
        .filter(Boolean).join(' · ')} />
  );
}

function ReportBody({
  mode, dimension, rows, total, studentCount, teacherTotal, subjectTotal, classTotal,
  finals, finalsReady, periodName, selectedStudentId, onOpen,
}: {
  mode: Mode;
  dimension: ReportDimension;
  rows: ReportRow[];
  total: ReportMetrics | undefined;
  studentCount: number | null;
  teacherTotal: number | undefined;
  subjectTotal: number | undefined;
  classTotal: number | undefined;
  finals: Map<number, number>;
  finalsReady: boolean;
  periodName?: string;
  selectedStudentId: number | null;
  onOpen: (row: ReportRow) => void;
}) {
  if (mode === 'classSubject') {
    return <SubjectStudentsTable rows={rows} finals={finals} finalsReady={finalsReady} periodName={periodName}
      selectedId={selectedStudentId} onOpen={(id) => onOpen(rows.find((row) => row.key?.id === id)!)} />;
  }
  const metricColumns: ReportColumn<ReportRow>[] = [
    { key: 'lessons', header: 'Уроков', align: 'right', cell: (row) => <MetricCell value={lessonsDisplay(row.metrics)} />,
      total: <MetricCell value={lessonsDisplay(total)} strong /> },
    { key: 'average', header: 'Ср. балл', align: 'right', cell: (row) => <MetricCell value={averageDisplay(row.metrics)} />,
      total: <MetricCell value={averageDisplay(total)} strong /> },
    { key: 'performance', header: 'Успеваемость', align: 'right', cell: (row) => <MetricCell value={performanceDisplay(row.metrics)} />,
      total: <MetricCell value={performanceDisplay(total)} strong /> },
    { key: 'attendance', header: 'Посещаемость', align: 'right', cell: (row) => <MetricCell value={attendanceDisplay(row.metrics)} />,
      total: <MetricCell value={attendanceDisplay(total)} strong /> },
  ];
  const dash = <span className="text-slate-400">—</span>;
  const students: ReportColumn<ReportRow> = {
    key: 'students', header: 'Учеников', align: 'right',
    cell: (row) => row.attributes?.currentStudentCount == null ? dash : formatCount(row.attributes.currentStudentCount),
    total: studentCount == null ? undefined : formatCount(studentCount),
  };
  const common = {
    rows,
    rowKey: (row: ReportRow) => row.key?.id ?? 0,
    onOpen,
  };

  if (dimension === 'STUDENT') {
    return <ReportTable {...common} label="Отчётность по ученикам" rowLabel={(row) => `Открыть карточку: ${row.key?.name}`}
      selectedKey={selectedStudentId} total={{ caption: 'итого', title: 'Весь класс' }} columns={studentColumns(total)} />;
  }
  if (dimension === 'SUBJECT') {
    const inClass = mode === 'class';
    return <ReportTable {...common} label="Отчётность по предметам" rowLabel={(row) => `Открыть предмет ${row.key?.name}`}
      total={inClass ? undefined : { caption: 'итого', title: `Вся школа ${counted(rows.length, SUBJECTS)}` }}
      columns={[
        { key: 'subject', header: 'Предмет', className: 'w-56', cell: (row) => row.key?.name },
        {
          key: 'teachers', header: inClass ? 'Учитель' : 'Учителя',
          cell: (row) => {
            const list = row.attributes?.teachers ?? [];
            if (list.length === 0) return dash;
            return inClass || list.length === 1
              ? `${namesLabel(list)}${inClass && list.length > 1 ? ' (подгруппы)' : ''}`
              : counted(list.length, TEACHERS);
          },
          total: teacherTotal == null ? undefined : counted(teacherTotal, TEACHERS),
        },
        ...metricColumns,
      ]} />;
  }
  if (dimension === 'TEACHER') {
    return <ReportTable {...common} label="Отчётность по учителям" rowLabel={(row) => `Открыть учителя ${row.key?.name}`}
      total={{ caption: 'итого', title: `Вся школа ${counted(rows.length, TEACHERS)}` }}
      columns={[
        { key: 'teacher', header: 'Учитель', className: 'w-56', cell: (row) => row.key?.name },
        { key: 'subjects', header: 'Предметы', cell: (row) => namesLabel(row.attributes?.subjects, 3) || dash,
          total: subjectTotal == null ? undefined : counted(subjectTotal, SUBJECTS) },
        { key: 'classes', header: 'Классов', align: 'right',
          cell: (row) => row.attributes?.classCount == null ? dash : formatCount(row.attributes.classCount),
          total: classTotal == null ? undefined : formatCount(classTotal) },
        ...metricColumns,
      ]} />;
  }
  // CLASS: школа, классы предмета, классы учителя.
  const second: ReportColumn<ReportRow> = mode === 'subject'
    ? { key: 'teacher', header: 'Учитель', cell: (row) => namesLabel(row.attributes?.teachers) || dash }
    : mode === 'teacher'
      ? { key: 'subject', header: 'Предмет', cell: (row) => namesLabel(row.attributes?.subjects, 3) || dash }
      : {
        key: 'homeroom', header: 'Кл. руководитель',
        cell: (row) => row.attributes?.homeroomTeacher?.name ?? <span className="text-slate-400">Не назначен</span>,
        total: counted(rows.filter((row) => row.attributes?.homeroomTeacher).length, HOMEROOMS),
      };
  return <ReportTable {...common} label="Отчётность по классам" rowLabel={(row) => `Открыть класс ${row.key?.name}`}
    total={mode === 'school' ? { caption: 'итого', title: 'Вся школа' } : undefined}
    columns={[
      { key: 'class', header: 'Класс', className: cx('w-36'), cell: (row) => row.key?.name },
      second,
      students,
      ...metricColumns,
    ]} />;
}
