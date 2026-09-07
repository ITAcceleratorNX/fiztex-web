import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarX2, ClipboardList } from 'lucide-react';
import { Select } from '@/components/ui/Field';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cx, personShortName } from '@/lib/format';
import type { AdminJournalSummary, UnfilledLesson } from '@/lib/attendanceAdminApi';
import type { AttendanceReason, AttendanceStatus } from '@/lib/attendanceApi';
import {
  defaultMonthValue,
  monthOptionsOfYear,
  reasonBreakdownRows,
} from '@/lib/attendanceAdminModel';
import { REASON_OPTIONS, STATUS_OPTIONS } from '@/lib/attendanceModel';
import { groupClassesByGrade } from '@/lib/platformCoreApi';
import {
  useAdminAttendanceJournal,
  useUnfilledLessons,
} from '@/platform/hooks/useAttendanceAdmin';
import {
  useAcademicYears,
  useAllTeachers,
  useClassStudents,
  useSchoolClasses,
} from '@/platform/hooks/useScheduleSettings';
import { useClassSubgroups, useSchoolSubjects } from '@/platform/hooks/useSubgroups';
import { AdminJournalTable } from './AdminJournalTable';
import { UnfilledLessonsTable } from './UnfilledLessonsTable';

const FILTER_CONTROL =
  'w-auto min-w-40 rounded-lg border-line bg-gray-50 px-3 py-2 text-13 font-medium text-ink';

type AttendanceTab = 'journal' | 'unfilled';

/**
 * Посещаемость по школе (ATTENDANCE-001 §23).
 *
 * <p>Раздел администрации поверх двух готовых эндпоинтов, а не второй экран урока:
 * журнал «ученики × уроки» за месяц и список закончившихся уроков без публикации.
 * Отметку по-прежнему ставят на уроке — отсюда в него ведут и клетки, и строки.
 *
 * <p>Класс в журнале обязателен: у разных классов разные занятия, и одна сетка на
 * школу — это не таблица, а декартово произведение (контракт §23). Незаполненные
 * уроки, наоборот, смотрят целиком, поэтому там класс — необязательный фильтр.
 *
 * <p>Фильтры живут в адресе: ссылку на «5 «А», сентябрь, пропуски по болезни»
 * пересылают завучу так же, как ссылку на журнал оценок.
 */
export function AttendanceAdminPage() {
  useDocumentTitle('Посещаемость');

  const [params, setParams] = useSearchParams();
  const tab: AttendanceTab = params.get('tab') === 'unfilled' ? 'unfilled' : 'journal';

  const yearsQuery = useAcademicYears();
  const years = useMemo(() => yearsQuery.data?.content ?? [], [yearsQuery.data]);
  const yearId = numberParam(params.get('year')) ?? years[0]?.id ?? null;
  const year = years.find((option) => option.id === yearId) ?? null;

  const months = useMemo(() => monthOptionsOfYear(year), [year]);
  const month = params.get('month') ?? defaultMonthValue(months);

  const classesQuery = useSchoolClasses(yearId);
  // Плоским списком: `Select` — не нативный `<select>` и `<optgroup>` не понимает,
  // а имя класса и так несёт параллель («5 «А»»). Группировкой пользуемся только
  // ради порядка: 5 перед 10, «А» перед «Б».
  const classes = useMemo(
    () => groupClassesByGrade(classesQuery.data?.content ?? []).flatMap((group) => group.classes),
    [classesQuery.data],
  );
  const classId = numberParam(params.get('classId'));

  const subjectsQuery = useSchoolSubjects();
  const subjects = subjectsQuery.data?.content ?? [];
  const subjectId = numberParam(params.get('subjectId'));

  // Подгруппы, как и ученики, живут внутри класса: без него список пуст, а не «все».
  const subgroupsQuery = useClassSubgroups(classId);
  const subgroups = subgroupsQuery.data ?? [];
  const subgroupId = numberParam(params.get('subgroupId'));

  const teachersQuery = useAllTeachers();
  const teachers = useMemo(
    () =>
      [...(teachersQuery.data?.content ?? [])].sort((a, b) =>
        personShortName(a).localeCompare(personShortName(b), 'ru'),
      ),
    [teachersQuery.data],
  );
  const teacherProfileId = numberParam(params.get('teacherId'));

  // Ученики берутся из выбранного класса, а не из школы: фильтр внутри журнала класса
  // списком на 800 человек — это не выбор, а поиск иголки.
  const studentsQuery = useClassStudents(yearId, classId);
  const students = useMemo(
    () =>
      [...(studentsQuery.data?.content ?? [])].sort((a, b) =>
        personShortName(a).localeCompare(personShortName(b), 'ru'),
      ),
    [studentsQuery.data],
  );
  const studentProfileId = numberParam(params.get('studentId'));

  const status = (params.get('status') as AttendanceStatus | null) ?? null;
  const reason = (params.get('reason') as AttendanceReason | null) ?? null;
  const page = numberParam(params.get('page')) ?? 0;

  function patch(next: Record<string, string | number | null>) {
    const updated = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === '') updated.delete(key);
      else updated.set(key, String(value));
    }
    setParams(updated, { replace: true });
  }

  const journalQuery = useAdminAttendanceJournal(
    classId != null
      ? {
          month,
          classId,
          subgroupId,
          subjectId,
          teacherProfileId,
          studentProfileId,
          status,
          reason,
        }
      : null,
  );
  const unfilledQuery = useUnfilledLessons({ month, classId, page, size: 20 });

  return (
    <div className="flex flex-col gap-5">
      <div className="min-w-0">
        <h1 className="text-28 font-bold text-ink">Посещаемость</h1>
        <p className="max-w-3xl text-13 text-muted">
          Журнал за месяц и уроки, посещаемость которых так и не опубликовали. Отметки
          ставятся на уроке — отсюда в него ведут и клетки журнала, и строки списка.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(next) => patch({ tab: next, page: null })}>
        <TabsList>
          <TabsTrigger value="journal">Журнал класса</TabsTrigger>
          <TabsTrigger value="unfilled">Незаполненные уроки</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2.5">
        <Select
          aria-label="Учебный год"
          value={yearId != null ? String(yearId) : ''}
          disabled={yearsQuery.isLoading || years.length === 0}
          onChange={(e) => patch({ year: e.target.value || null, classId: null, month: null })}
          className={FILTER_CONTROL}
        >
          {years.length === 0 && <option value="">Учебный год</option>}
          {years.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Месяц"
          value={month ?? ''}
          disabled={months.length === 0}
          onChange={(e) => patch({ month: e.target.value || null, page: null })}
          className={FILTER_CONTROL}
        >
          {months.length === 0 && <option value="">Месяц</option>}
          {months.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Класс"
          value={classId != null ? String(classId) : ''}
          disabled={classesQuery.isLoading || classes.length === 0}
          onChange={(e) =>
            patch({
              classId: e.target.value || null,
              // И подгруппа, и ученик принадлежат прежнему классу: оставить их значит
              // фильтровать новый класс по чужим сущностям и всегда видеть пусто.
              subgroupId: null,
              studentId: null,
              page: null,
            })
          }
          className={FILTER_CONTROL}
        >
          <option value="">{tab === 'journal' ? 'Выберите класс' : 'Все классы'}</option>
          {classes.map((schoolClass) => (
            <option key={schoolClass.id} value={schoolClass.id}>
              {schoolClass.name}
            </option>
          ))}
        </Select>

        {tab === 'journal' && (
          <>
            <Select
              aria-label="Предмет"
              value={subjectId != null ? String(subjectId) : ''}
              disabled={subjectsQuery.isLoading}
              onChange={(e) => patch({ subjectId: e.target.value || null })}
              className={FILTER_CONTROL}
            >
              <option value="">Все предметы</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Подгруппа"
              value={subgroupId != null ? String(subgroupId) : ''}
              disabled={classId == null || subgroupsQuery.isLoading || subgroups.length === 0}
              onChange={(e) => patch({ subgroupId: e.target.value || null })}
              className={FILTER_CONTROL}
            >
              <option value="">{subgroupOptionsHint(classId, subgroups.length)}</option>
              {subgroups.map((subgroup) => (
                <option key={subgroup.id} value={subgroup.id}>
                  {subgroupLabel(subgroup)}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Учитель"
              value={teacherProfileId != null ? String(teacherProfileId) : ''}
              disabled={teachersQuery.isLoading || teachers.length === 0}
              onChange={(e) => patch({ teacherId: e.target.value || null })}
              className={FILTER_CONTROL}
            >
              <option value="">Все учителя</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {personShortName(teacher)}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Ученик"
              value={studentProfileId != null ? String(studentProfileId) : ''}
              disabled={classId == null || studentsQuery.isLoading || students.length === 0}
              onChange={(e) => patch({ studentId: e.target.value || null })}
              className={FILTER_CONTROL}
            >
              <option value="">{classId == null ? 'Сначала класс' : 'Все ученики'}</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {personShortName(student)}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Статус"
              value={status ?? ''}
              onChange={(e) => patch({ status: e.target.value || null })}
              className={FILTER_CONTROL}
            >
              <option value="">Все статусы</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>

            <Select
              aria-label="Причина"
              value={reason ?? ''}
              onChange={(e) => patch({ reason: e.target.value || null })}
              className={FILTER_CONTROL}
            >
              <option value="">Все причины</option>
              {REASON_OPTIONS.filter((option) => option.value != null).map((option) => (
                <option key={option.value} value={option.value!}>
                  {option.label}
                </option>
              ))}
            </Select>
          </>
        )}
      </div>

      {tab === 'journal' ? (
        <JournalTab
          classId={classId}
          loading={journalQuery.isLoading}
          error={journalQuery.isError ? errorText(journalQuery.error) : null}
          onRetry={() => void journalQuery.refetch()}
          journal={journalQuery.data}
        />
      ) : (
        <UnfilledTab
          loading={unfilledQuery.isLoading}
          error={unfilledQuery.isError ? errorText(unfilledQuery.error) : null}
          onRetry={() => void unfilledQuery.refetch()}
          lessons={unfilledQuery.data?.content ?? []}
          page={page}
          totalPages={unfilledQuery.data?.totalPages ?? 0}
          onPageChange={(next) => patch({ page: next > 0 ? next : null })}
        />
      )}
    </div>
  );
}

function JournalTab({
  classId,
  loading,
  error,
  onRetry,
  journal,
}: {
  classId: number | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  journal: ReturnType<typeof useAdminAttendanceJournal>['data'];
}) {
  if (classId == null) {
    return (
      <EmptyBlock
        icon={<ClipboardList className="size-7" />}
        title="Класс не выбран"
        description="Таблица «ученики × уроки» строится по классу: у разных классов разные занятия."
      />
    );
  }
  if (loading) return <LoadingBlock label="Загрузка журнала…" />;
  if (error) return <ErrorBlock message={error} onRetry={onRetry} />;

  const lessons = journal?.lessons ?? [];
  const rows = journal?.rows ?? [];

  if (!journal || lessons.length === 0) {
    return (
      <EmptyBlock
        icon={<ClipboardList className="size-7" />}
        title="За этот месяц уроков нет"
        description="В выбранном месяце у класса нет занятий — проверьте месяц и фильтры."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SummaryStrip summary={journal.summary} />
      {rows.length === 0 ? (
        /*
         * Уроки есть, а строк нет — значит ни один лист не заполняли: ученик попадает в
         * журнал вместе со своей отметкой, а не из списка класса. Прятать за этим сводку
         * нельзя: «124 урока не заполнено» — ровно то, зачем администратор сюда пришёл.
         */
        <EmptyBlock
          icon={<ClipboardList className="size-7" />}
          title="Ни один урок месяца не отмечен"
          description="Ученики появятся в таблице, когда учителя заполнят листы. Список незакрытых уроков — на соседней вкладке."
        />
      ) : (
        <div className="rounded-2xl border border-line bg-white p-2">
          <AdminJournalTable journal={journal} />
        </div>
      )}
    </div>
  );
}

function SummaryStrip({ summary }: { summary: AdminJournalSummary | undefined }) {
  if (!summary) return null;
  const reasons = reasonBreakdownRows(summary.reasonBreakdown);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap gap-2">
        <Stat label="Уроков" value={summary.lessonCount} />
        <Stat label="Заполнено" value={summary.filledCount} tone="success" />
        <Stat label="Не заполнено" value={summary.unfilledCount} tone="attention" />
        <Stat label="Присутствий" value={summary.attendedCount} />
        <Stat label="Пропусков" value={summary.missedCount} />
        <Stat label="Опозданий" value={summary.lateCount} />
        <Stat label="Освобождений" value={summary.excusedCount} />
      </div>
      {reasons.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-11 font-semibold uppercase text-subtle">Причины пропусков</span>
          {reasons.map((row) => (
            <span key={row.reason} className="rounded bg-gray-100 px-2 py-0.5 text-11 text-muted">
              {row.label}: <span className="font-semibold text-ink">{row.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone?: 'success' | 'attention';
}) {
  return (
    <span
      className={cx(
        'flex min-w-24 flex-col rounded-lg px-3 py-2',
        tone === 'success' && 'bg-success-bg',
        tone === 'attention' && 'bg-attention-bg',
        !tone && 'bg-gray-50',
      )}
    >
      <span className="text-11 text-muted">{label}</span>
      <span className="text-base font-bold tabular-nums text-ink">{value ?? 0}</span>
    </span>
  );
}

function UnfilledTab({
  loading,
  error,
  onRetry,
  lessons,
  page,
  totalPages,
  onPageChange,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  lessons: UnfilledLesson[];
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
}) {
  if (loading) return <LoadingBlock label="Загрузка уроков…" />;
  if (error) return <ErrorBlock message={error} onRetry={onRetry} />;
  if (lessons.length === 0) {
    return (
      <EmptyBlock
        icon={<CalendarX2 className="size-7" />}
        title="Незаполненных уроков нет"
        description="Все закончившиеся уроки выбранного месяца опубликованы."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-white">
        <UnfilledLessonsTable lessons={lessons} />
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border border-line px-3 py-1.5 text-13 text-muted transition hover:bg-gray-50 disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-11 text-muted">
            Стр. {page + 1} из {totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border border-line px-3 py-1.5 text-13 text-muted transition hover:bg-gray-50 disabled:opacity-40"
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * «Группа 1 · Английский» — имя подгруппы само по себе не говорит, какого она деления,
 * а делений у класса бывает несколько.
 */
function subgroupLabel(subgroup: { name: string; groupSet: { name: string } | null }): string {
  return subgroup.groupSet?.name ? `${subgroup.name} · ${subgroup.groupSet.name}` : subgroup.name;
}

/** У пустого списка две разные причины, и молчать о них — значит выглядеть сломанным. */
function subgroupOptionsHint(classId: number | null, count: number): string {
  if (classId == null) return 'Сначала класс';
  return count === 0 ? 'Делений нет' : 'Все подгруппы';
}

function numberParam(raw: string | null): number | null {
  const parsed = raw != null ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось загрузить данные';
}
