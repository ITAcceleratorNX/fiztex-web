import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import {
  useClassRating,
  useReportBreakdown,
  useReportDynamics,
  useReportFinals,
  useReportPerformance,
  useReportSummary,
  useStudentRating,
  useTeacherReportContext,
  type ReportFilter,
  type ReportOwner,
} from '@/hooks/reportingQueries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  attendanceDisplay,
  reportAverageDisplay,
  counted,
  isEmptyReport,
  lessonsDisplay,
  LESSONS,
  periodFinalsByStudent,
  periodLabel,
  reportFileName,
  STUDENTS,
  type ReportRow,
} from '@/lib/reportingModel';
import { SubjectStudentsTable } from '../my-class/MyClassReportTab';
import { ReportHeaderCard } from './ReportHeaderCard';
import { ClassRatingTable, DynamicsPanel, ExportButton, PerformanceStrip, StudentRatingTable } from './ReportInsights';
import { MetricCell, ReportTable } from './ReportTable';
import { StudentReportDrawer } from './StudentReportDrawer';
import { AiReportDrawer, type AiDrawerTarget } from './ai/AiReportDrawer';
import { AiReportStrip } from './ai/AiReportStrip';
import { ROUTES } from '@/lib/routes';
import { SpecialReportSection } from './special/SpecialReportSection';
import { isSpecialSection, SECTION_OPTIONS, type Section } from './special/sections';

const TEACHER: ReportOwner = { kind: 'teacher' };
const collator = new Intl.Collator('ru-RU', { numeric: true });


function idParam(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Отчётность учителя-предметника (ТЗ «Учебная отчётность и рейтинги», Frontend §2).
 *
 * <p>Те же таблицы, карточки и шторка, что у администратора и классного руководителя, но
 * по `/api/teacher/academic-reports`: только его классы и только его предмет. Что можно
 * выбрать, говорит сервер (`/context`) — чужих классов в фильтрах нет вовсе, а не «есть,
 * но отвечают 403».
 *
 * <p>Без класса экран — сравнение его классов по предмету и рейтинг учеников всех этих
 * классов. С классом — ученики класса, рейтинг и динамика. Состояние живёт в адресе.
 */
export function TeacherReportingPage() {
  useDocumentTitle('Отчётность');
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [aiTarget, setAiTarget] = useState<AiDrawerTarget | null>(null);
  const requestedYear = idParam(searchParams.get('year'));
  const selectedSection = searchParams.get('section');
  const reportKind = selectedSection === 'assessment' ? 'ASSESSMENT'
    : selectedSection === 'classPerformance' ? 'CLASS_PERFORMANCE'
      : selectedSection === 'teacherPerformance' ? 'TEACHER_PERFORMANCE' : undefined;
  const context = useTeacherReportContext(requestedYear, reportKind);
  const yearId = context.data?.academicYearId ?? null;
  const year = context.data?.years?.find((item) => item.id === yearId);
  const periods = useMemo(() => [...(context.data?.periods ?? [])]
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')), [context.data]);
  const pairs = useMemo(() => context.data?.assignments ?? [], [context.data]);

  const subjects = useMemo(() => {
    const unique = new Map<number, string>();
    pairs.forEach((pair) => pair.subject?.id != null && unique.set(pair.subject.id, pair.subject.name ?? ''));
    return [...unique.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => collator.compare(a.name, b.name));
  }, [pairs]);
  const requestedSubject = idParam(searchParams.get('subjectId'));
  const subjectId = subjects.find((item) => item.id === requestedSubject)?.id ?? subjects[0]?.id ?? null;
  const subjectName = subjects.find((item) => item.id === subjectId)?.name;
  const classes = useMemo(() => pairs
    .filter((pair) => pair.subject?.id === subjectId && pair.schoolClass?.id != null)
    .map((pair) => ({ id: pair.schoolClass!.id!, name: pair.schoolClass!.name ?? '' }))
    .sort((a, b) => collator.compare(a.name, b.name)), [pairs, subjectId]);
  const requestedClass = idParam(searchParams.get('classId'));
  // Класс другого предмета после смены предмета не тянется за ним — его просто нет в списке.
  const classId = classes.find((item) => item.id === requestedClass)?.id ?? null;
  const className = classes.find((item) => item.id === classId)?.name ?? '';

  const periodParam = searchParams.get('period');
  const period = periodParam === 'all' ? null
    : periods.find((item) => item.id === idParam(periodParam))
      ?? periods.find((item) => item.startDate && item.endDate && item.startDate <= today() && today() <= item.endDate)
      ?? null;
  const sectionValue = searchParams.get('section');
  const section: Section = isSpecialSection(sectionValue) ? sectionValue
    : sectionValue === 'rating' ? 'rating'
      : sectionValue === 'dynamics' && classId != null ? 'dynamics' : 'metrics';
  const special = isSpecialSection(section) ? section : null;
  const subgroupId = classId == null ? null : idParam(searchParams.get('subgroupId'));
  const studentId = idParam(searchParams.get('student'));

  const filter: ReportFilter | null = yearId == null || subjectId == null ? null : {
    academicYearId: yearId, academicPeriodId: period?.id ?? null, classId, subjectId,
  };
  // Специальные формы читают свои адреса: сводка и разрезы раздела в это время не нужны.
  const classFilter = filter && classId != null && !special ? filter : null;

  const summary = useReportSummary(TEACHER, classFilter);
  const performance = useReportPerformance(TEACHER, classFilter);
  const classRows = useReportBreakdown(TEACHER, filter && classId == null && section === 'metrics' ? filter : null, 'CLASS');
  const studentRows = useReportBreakdown(TEACHER, classFilter && section === 'metrics' ? classFilter : null, 'STUDENT');
  const finals = useReportFinals(TEACHER, classFilter && section === 'metrics' ? classFilter : null);
  const studentRating = useStudentRating(TEACHER, section === 'rating' ? filter : null);
  const classRating = useClassRating(TEACHER, section === 'rating' && classId == null ? filter : null);
  const dynamics = useReportDynamics(TEACHER, section === 'dynamics' ? classFilter : null);

  const students = useMemo(() => [...(studentRows.data?.rows ?? [])]
    .sort((a, b) => collator.compare(a.key?.name ?? '', b.key?.name ?? '')), [studentRows.data]);
  const studentRefs = section === 'rating'
    ? (studentRating.data?.items ?? []).map((row) => row.student!).filter((item) => item?.id != null)
    : students.map((row) => row.key!).filter((item) => item?.id != null);
  const studentsLoaded = section === 'rating' ? studentRating.data != null : studentRows.data != null;
  const openStudent = classId == null ? undefined : studentRefs.find((item) => item.id === studentId);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(changes)) {
      if (value == null) next.delete(name);
      else next.set(name, value);
    }
    setSearchParams(next);
  }

  useEffect(() => {
    // Ученик в адресе, которого нет в текущем списке, не открывает чужую карточку.
    if (studentId != null && studentsLoaded && !openStudent) {
      const next = new URLSearchParams(searchParams);
      next.delete('student');
      setSearchParams(next, { replace: true });
    }
  }, [openStudent, searchParams, setSearchParams, studentId, studentsLoaded]);

  const scopeText = [className, subjectName && `«${subjectName}»`].filter(Boolean).join(' · ') || 'Мои классы';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-28 font-bold text-ink">Отчётность</h1>
        {!special && <ExportButton owner={TEACHER} filter={filter} fileName={reportFileName(year?.name, period?.name)} />}
      </div>

      <SegmentedTabs value={section} ariaLabel="Раздел отчётности"
        onChange={(value) => update({ section: value === 'metrics' ? null : value, student: null, subgroupId: null })}
        options={SECTION_OPTIONS.map((option) => option.value === 'metrics'
          ? { ...option, label: classId == null ? 'Сравнение классов' : 'Ученики' }
          : option.value === 'dynamics' ? { ...option, disabled: classId == null } : option)} />

      {context.isPending ? <LoadingBlock label="Загрузка отчётности…" /> : context.isError ? (
        <ErrorBlock message="Не удалось загрузить ваши классы и предметы." onRetry={() => void context.refetch()} />
      ) : yearId == null || subjects.length === 0 ? (
        <EmptyBlock icon={<CalendarDays className="h-7 w-7" />} title="Нет предметных назначений"
          description="Отчётность учителя строится по классам и предметам, которые вам назначены в учебном году." />
      ) : (
        <>
          {!special && classId != null && summary.data && !isEmptyReport(summary.data.metrics) && (
            <ReportHeaderCard title={`${subjectName ?? 'Предмет'} · ${className}`} metrics={summary.data.metrics}
              performance={performance.data?.performance}
              subtitle={[summary.data.currentStudentCount == null ? null : counted(summary.data.currentStudentCount, STUDENTS),
                summary.data.metrics?.lessons?.completedLessonCount == null
                  ? null : counted(summary.data.metrics.lessons.completedLessonCount, LESSONS)].filter(Boolean).join(' · ')} />
          )}

          <div className="grid gap-3 md:grid-cols-[minmax(0,10rem)_minmax(0,16rem)_minmax(0,14rem)_minmax(0,12rem)]">
            <FilterSelect label="Учебный год" value={String(yearId)} disabled={(context.data?.years ?? []).length < 2}
              onChange={(value) => update({ year: value, period: null, classId: null, student: null, subgroupId: null })}>
              {(context.data?.years ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Период" value={period?.id == null ? 'all' : String(period.id)}
              onChange={(value) => update({ period: value, student: null, subgroupId: null })}>
              <option value="all">Весь учебный год</option>
              {periods.map((item) => <option key={item.id} value={item.id}>{periodLabel(item)}</option>)}
            </FilterSelect>
            <FilterSelect label="Предмет" value={String(subjectId)}
              onChange={(value) => update({ subjectId: value, classId: null, student: null, subgroupId: null })}>
              {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Класс" value={classId == null ? '' : String(classId)}
              onChange={(value) => update({ classId: value || null, student: null, subgroupId: null,
                // Динамика без класса не строится — уходим в сравнение классов.
                ...(value || section !== 'dynamics' ? {} : { section: null }) })}>
              <option value="">Все мои классы</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </FilterSelect>
          </div>

          <p className="text-13 text-slate-500">
            Данные за <span className="font-semibold text-slate-700">{periodLabel(period)}</span> · {year?.name} · {scopeText}
          </p>

          {!special && (
            <AiReportStrip
              description="По ученику, классу или всем вашим классам за выбранный период"
              historyHref={`${ROUTES.myReporting}/ai-reports${classId != null ? `?classId=${classId}&subjectId=${subjectId}` : subjectId != null ? `?subjectId=${subjectId}` : ''}`}
              historyState={{ back: `${location.pathname}${location.search}` }}
              onCreate={() => setAiTarget({ kind: 'create', academicYearId: yearId, preset: {
                owner: 'SUBJECT_TEACHER', classId, subjectId, academicPeriodId: period?.id ?? null,
                type: classId == null && classes.length > 1 ? 'CLASSES' : 'CLASS',
              } })} />
          )}

          {classId != null && !special && (
            <PerformanceStrip performance={performance.data?.performance} pending={performance.isPending}
              failed={performance.isError} attendance={attendanceDisplay(summary.data?.metrics)} />
          )}

          {special && filter && (
            <SpecialReportSection
              owner={TEACHER}
              form={special}
              filter={{ ...filter, subgroupId }}
              fileParts={[year?.name, period?.name ?? 'год', className || null, subjectName]}
              onSubgroup={(id) => update({ subgroupId: id == null ? null : String(id) })}
            />
          )}

          {section === 'metrics' && classId == null && (
            classRows.isPending ? <LoadingBlock label="Загрузка классов…" /> : classRows.isError ? (
              <ErrorBlock message="Не удалось загрузить сравнение классов." onRetry={() => void classRows.refetch()} />
            ) : (
              <ReportTable
                label="Мои классы по предмету"
                rows={classRows.data?.rows ?? []}
                rowKey={(row: ReportRow) => row.key?.id ?? 0}
                rowLabel={(row) => `Открыть класс ${row.key?.name}`}
                onOpen={(row) => row.key?.id != null && update({ classId: String(row.key.id), student: null })}
                columns={[
                  { key: 'class', header: 'Класс', className: 'w-40', cell: (row) => row.key?.name },
                  { key: 'students', header: 'Учеников', align: 'right',
                    cell: (row) => row.attributes?.currentStudentCount ?? <span className="text-slate-400">—</span> },
                  { key: 'lessons', header: 'Уроков', align: 'right', cell: (row) => <MetricCell value={lessonsDisplay(row.metrics)} /> },
                  { key: 'average', header: 'Ср. балл', align: 'right', cell: (row) => <MetricCell value={reportAverageDisplay(row.metrics, row.performance)} /> },
                  { key: 'attendance', header: 'Посещаемость', align: 'right', cell: (row) => <MetricCell value={attendanceDisplay(row.metrics)} /> },
                ]}
              />
            )
          )}

          {section === 'metrics' && classId != null && (
            studentRows.isPending ? <LoadingBlock label="Загрузка учеников…" /> : studentRows.isError ? (
              <ErrorBlock message="Не удалось загрузить учеников класса." onRetry={() => void studentRows.refetch()} />
            ) : (
              <SubjectStudentsTable rows={students} finals={periodFinalsByStudent(finals.data ?? [], subjectId)}
                finalsReady={!finals.isPending} periodName={period?.name} selectedId={studentId}
                onOpen={(id) => update({ student: String(id) })} />
            )
          )}

          {section === 'rating' && (
            <div className="space-y-6">
              {classId == null && (
                <section className="space-y-3">
                  <h2 className="text-lg font-semibold text-ink">Сравнение моих классов</h2>
                  <ClassRatingTable rating={classRating.data} pending={classRating.isPending} error={classRating.error}
                    onRetry={() => void classRating.refetch()}
                    onOpen={(row) => row.schoolClass?.id != null && update({ classId: String(row.schoolClass.id) })} />
                </section>
              )}
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-ink">Рейтинг учеников по предмету</h2>
                <StudentRatingTable rating={studentRating.data} pending={studentRating.isPending} error={studentRating.error}
                  onRetry={() => void studentRating.refetch()} showClass={classId == null} selectedId={studentId}
                  onOpen={classId == null ? undefined : (row) => row.student?.id != null && update({ student: String(row.student.id) })} />
              </section>
            </div>
          )}

          {section === 'dynamics' && (
            <DynamicsPanel points={dynamics.data?.points} pending={dynamics.isPending} error={dynamics.error}
              onRetry={() => void dynamics.refetch()} />
          )}
        </>
      )}

      {openStudent && classFilter && (
        <StudentReportDrawer
          owner={TEACHER}
          filter={classFilter}
          student={openStudent}
          className={className}
          context={`Данные за ${periodLabel(period)} · ${subjectName ?? ''}`}
          students={studentRefs}
          highlightSubjectId={subjectId}
          keepSubject
          onSelect={(id) => update({ student: String(id) })}
          onClose={() => update({ student: null })}
          onAiReport={() => setAiTarget({ kind: 'create', academicYearId: yearId, preset: {
            owner: 'SUBJECT_TEACHER', type: 'STUDENT', classId, subjectId, studentProfileId: openStudent.id,
            academicPeriodId: period?.id ?? null,
          } })}
        />
      )}

      {aiTarget && <AiReportDrawer reader="teacher" target={aiTarget} onClose={() => setAiTarget(null)} />}
    </div>
  );
}
