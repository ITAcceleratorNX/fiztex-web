import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { Select } from '@/components/ui/Field';
import { Pagination } from '@/components/ui/Pagination';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useFillControlFilters, useFillControlLessons, useFillControlSummary } from '@/hooks/fillControlQueries';
import { cx } from '@/lib/format';
import type { FillControlLesson, FillControlQuery, FillProblemType } from '@/lib/fillControlApi';
import {
  actionLabel,
  attendanceCaption,
  attendanceHref,
  PROBLEM_OPTIONS,
  problemFromParam,
  workCaption,
  workHref,
  workTitle,
  type FillControlBackState,
  type ProblemFilter,
} from '@/lib/fillControlModel';

const PAGE_SIZE = 20;
const FILTER_CONTROL =
  'w-auto min-w-40 rounded-lg border-line bg-surface px-3 py-2 text-13 font-medium text-ink';

/** Ключи в адресе — со своим префиксом: рядом живут фильтры самой страницы (`year`, `classId`…). */
const KEYS = {
  year: 'fcYear',
  period: 'fcPeriod',
  classId: 'fcClass',
  subject: 'fcSubject',
  teacher: 'fcTeacher',
  problem: 'fcProblem',
  page: 'fcPage',
} as const;

function numberParam(value: string | null): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * «Незаполненное»: прошедшие уроки без посещаемости и проведённые СОР/СОЧ без результатов
 * (Figma `phyztex` 2857:3279). Один компонент на три входа — администрации, учителя и классного
 * руководителя; различаются только набор фильтров и зафиксированный класс.
 *
 * <p>Ничего не считается на экране: счётчики, проблемы, `canEdit` и причина запрета приходят с
 * сервера, а допустимые значения фильтров — из `/filters` (чужих классов там нет). Фильтры и
 * страница живут в адресе, а ссылки строк несут «откуда пришли» — «← К незаполненным» возвращает
 * тот же список.
 */
export function FillControlPanel({
  showTeacherFilter = false,
  lockedClassId = null,
  lockedPeriodId = null,
  backLabel = '← К незаполненным',
}: {
  /** Фильтр по учителю: у администрации и классного руководителя (в рамках прав сервера). */
  showTeacherFilter?: boolean;
  /** «Мой класс»: класс задан вкладкой, а не фильтром. */
  lockedClassId?: number | null;
  lockedPeriodId?: number | null;
  backLabel?: string;
}) {
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  const requestedYear = numberParam(params.get(KEYS.year));
  const classId = lockedClassId ?? numberParam(params.get(KEYS.classId));
  const filtersQuery = useFillControlFilters(requestedYear, classId);
  const filters = filtersQuery.data;
  const yearId = requestedYear ?? filters?.academicYearId ?? null;

  const periodId = lockedPeriodId ?? numberParam(params.get(KEYS.period));
  const subjectId = numberParam(params.get(KEYS.subject));
  const teacherId = showTeacherFilter ? numberParam(params.get(KEYS.teacher)) : null;
  const problem: ProblemFilter = problemFromParam(params.get(KEYS.problem));
  const page = numberParam(params.get(KEYS.page)) ?? 0;

  const base: FillControlQuery = {
    academicYearId: yearId,
    academicPeriodId: periodId,
    classId,
    subjectId,
    teacherProfileId: teacherId,
  };
  const lessonsQuery = useFillControlLessons({
    ...base,
    problem: problem === 'ALL' ? null : problem,
    page,
    size: PAGE_SIZE,
  });
  const summaryQuery = useFillControlSummary(base);
  const summary = summaryQuery.data;

  function patch(next: Record<string, string | number | null>) {
    const updated = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') updated.delete(key);
      else updated.set(key, String(value));
    }
    setParams(updated, { replace: true });
  }

  const counters: Record<ProblemFilter, number> = {
    ALL: summary?.lessons ?? 0,
    ATTENDANCE: summary?.attendanceLessons ?? 0,
    ASSESSMENT: summary?.assessmentLessons ?? 0,
  };
  const options = PROBLEM_OPTIONS.map((option) => ({
    value: option.value,
    label: summary ? `${option.label} ${counters[option.value]}` : option.label,
  }));

  const backState: FillControlBackState = {
    fillControlBack: { to: `${location.pathname}${location.search}`, label: backLabel },
  };
  const pageData = lessonsQuery.data;
  const lessons = pageData?.content ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Select
          aria-label="Учебный год"
          value={yearId != null ? String(yearId) : ''}
          disabled={!filters}
          onChange={(e) =>
            patch({ [KEYS.year]: e.target.value || null, [KEYS.period]: null, [KEYS.page]: null })
          }
          className={FILTER_CONTROL}
        >
          {(filters?.years ?? []).map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </Select>

        {lockedPeriodId == null && (
          <Select
            aria-label="Четверть"
            value={periodId != null ? String(periodId) : ''}
            disabled={!filters}
            onChange={(e) => patch({ [KEYS.period]: e.target.value || null, [KEYS.page]: null })}
            className={FILTER_CONTROL}
          >
            <option value="">Все четверти</option>
            {(filters?.periods ?? []).map((period) => (
              <option key={period.id} value={period.id}>
                {period.name}
              </option>
            ))}
          </Select>
        )}

        {lockedClassId == null && (
          <Select
            aria-label="Класс"
            value={classId != null ? String(classId) : ''}
            disabled={!filters}
            onChange={(e) => patch({ [KEYS.classId]: e.target.value || null, [KEYS.page]: null })}
            className={FILTER_CONTROL}
          >
            <option value="">Все классы</option>
            {(filters?.classes ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
        )}

        <Select
          aria-label="Предмет"
          value={subjectId != null ? String(subjectId) : ''}
          disabled={!filters}
          onChange={(e) => patch({ [KEYS.subject]: e.target.value || null, [KEYS.page]: null })}
          className={FILTER_CONTROL}
        >
          <option value="">Все предметы</option>
          {(filters?.subjects ?? []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>

        {showTeacherFilter && filters?.teacherFilterAllowed && (
          <Select
            aria-label="Учитель"
            value={teacherId != null ? String(teacherId) : ''}
            onChange={(e) => patch({ [KEYS.teacher]: e.target.value || null, [KEYS.page]: null })}
            className={FILTER_CONTROL}
          >
            <option value="">Все учителя</option>
            {(filters?.teachers ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <SegmentedTabs<ProblemFilter>
        ariaLabel="Что не заполнено"
        appearance="outlined"
        value={problem}
        options={options}
        onChange={(next) => patch({ [KEYS.problem]: next === 'ALL' ? null : next, [KEYS.page]: null })}
        className="self-start"
      />

      {lessonsQuery.isLoading ? (
        <LoadingBlock />
      ) : lessonsQuery.isError || filtersQuery.isError ? (
        <ErrorBlock
          message="Не удалось загрузить незаполненные уроки"
          onRetry={() => {
            void lessonsQuery.refetch();
            void summaryQuery.refetch();
            void filtersQuery.refetch();
          }}
        />
      ) : lessons.length === 0 ? (
        <EmptyBlock
          icon={<ClipboardCheck className="h-7 w-7" aria-hidden="true" />}
          title="Незаполненных данных нет"
          description="Посещаемость и результаты проведённых работ внесены."
        />
      ) : (
        <>
          <FillControlTable
            lessons={lessons}
            problem={problem}
            showTeacher={showTeacherFilter}
            backState={backState}
          />
          <Pagination
            page={page}
            totalPages={pageData?.totalPages ?? 1}
            totalElements={pageData?.totalElements ?? lessons.length}
            pageSize={PAGE_SIZE}
            itemForms={['урок', 'урока', 'уроков']}
            label="Страницы незаполненных уроков"
            onPageChange={(next) => patch({ [KEYS.page]: next === 0 ? null : next })}
          />
        </>
      )}
    </div>
  );
}

function FillControlTable({
  lessons,
  problem,
  showTeacher,
  backState,
}: {
  lessons: FillControlLesson[];
  problem: ProblemFilter;
  showTeacher: boolean;
  backState: FillControlBackState;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <Th>Дата</Th>
            <Th>Класс</Th>
            <Th>Предмет</Th>
            {showTeacher && <Th>Учитель</Th>}
            <Th>Что не заполнено</Th>
            <Th className="text-right">Урок</Th>
          </tr>
        </thead>
        <tbody>
          {lessons.map((lesson) => (
            <FillControlRow
              key={lesson.lessonId}
              lesson={lesson}
              problem={problem}
              showTeacher={showTeacher}
              backState={backState}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Item = {
  key: string;
  type: FillProblemType;
  title: string;
  caption: string;
  tone: 'danger' | 'warning';
  canEdit: boolean;
  /** Ссылка приведёт на урок: сервер называет это `canView`, иначе строка без перехода. */
  canView: boolean;
  blocked: string | null;
  href: string;
};

function itemsOf(lesson: FillControlLesson, problem: ProblemFilter): Item[] {
  const items: Item[] = [];
  const id = lesson.lessonId ?? 0;
  if (lesson.attendance && (problem === 'ALL' || problem === 'ATTENDANCE')) {
    const caption = attendanceCaption(lesson.attendance);
    items.push({
      key: 'attendance',
      type: 'ATTENDANCE',
      title: 'Посещаемость',
      caption: caption.text,
      tone: caption.tone,
      canEdit: lesson.attendance.canEdit === true,
      canView: lesson.canView !== false,
      blocked: lesson.attendance.editBlockedMessage ?? null,
      href: attendanceHref(id),
    });
  }
  if (problem === 'ALL' || problem === 'ASSESSMENT') {
    for (const work of lesson.works ?? []) {
      const caption = workCaption(work);
      items.push({
        key: `work-${work.workId}`,
        type: 'ASSESSMENT',
        title: workTitle(work),
        caption: caption.text,
        tone: caption.tone,
        canEdit: work.canEdit === true,
        canView: lesson.canView !== false,
        blocked: work.editBlockedMessage ?? null,
        href: workHref(lesson),
      });
    }
  }
  return items;
}

function FillControlRow({
  lesson,
  problem,
  showTeacher,
  backState,
}: {
  lesson: FillControlLesson;
  problem: ProblemFilter;
  showTeacher: boolean;
  backState: FillControlBackState;
}) {
  const items = itemsOf(lesson, problem);
  return (
    <tr className="border-b border-line align-top last:border-b-0">
      <td className="whitespace-nowrap px-6 py-4 text-13 text-ink">
        {formatDate(lesson.lessonDate)}
        {lesson.startTime && <span className="ml-2 text-muted tabular-nums">{lesson.startTime.slice(0, 5)}</span>}
      </td>
      <td className="px-4 py-4 text-13 text-ink">
        {lesson.className ?? '—'}
        {lesson.subgroupName && (
          <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-10 text-muted">
            {lesson.subgroupName}
          </span>
        )}
      </td>
      <td className="px-4 py-4 text-13 text-ink">{lesson.subjectName ?? '—'}</td>
      {showTeacher && <td className="px-4 py-4 text-13 text-muted">{lesson.teacherName ?? '—'}</td>}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.key} className="min-h-10">
              <p className="text-13 font-semibold text-ink">{item.title}</p>
              <p className="flex items-center gap-1.5 text-13 text-muted">
                <span
                  aria-hidden="true"
                  className={cx('size-1.5 rounded-full', item.tone === 'danger' ? 'bg-red-500' : 'bg-orange-400')}
                />
                {item.caption}
              </p>
              {item.blocked && <p className="mt-0.5 text-11 text-subtle">{item.blocked}</p>}
            </div>
          ))}
        </div>
      </td>
      <td className="whitespace-nowrap px-6 py-3 text-right">
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.key} className="flex min-h-10 items-start justify-end pt-0.5">
              {!item.canView ? (
                <span className="text-13 text-subtle" title={item.blocked ?? undefined}>
                  Только список
                </span>
              ) : (
              <Link
                to={item.href}
                state={backState}
                aria-label={`${actionLabel(item.type, item.canEdit)}: ${item.title}, ${formatDate(lesson.lessonDate)}`}
                className="text-13 font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
              >
                {actionLabel(item.type, item.canEdit)} →
              </Link>
              )}
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cx('px-4 py-4 text-left text-11 font-bold uppercase text-subtle first:px-6 last:px-6', className)}>
      {children}
    </th>
  );
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}.${month}.${year}` : iso;
}
