import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarCheck2 } from 'lucide-react';
import { AttendanceDot, AttendanceLegend } from '@/components/ui/AttendanceDot';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useMyClassAttendanceJournal } from '@/hooks/queries';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import { cx } from '@/lib/format';
import { buildAttendanceJournal, type AttendanceColumn, type AttendanceRow } from '@/lib/myClassAttendanceModel';
import { PeriodFilter, SubjectFilter, useMyClassSubject } from './myClassFilters';

type Period = Schema<'MyClassContextPeriodView'>;

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * Вкладка «Посещаемость» (Figma 2200:4046): уроки предмета за период и точка у каждого
 * ученика. Только чтение — отметку ставят в листе урока, а классному руководителю его
 * назначение прав на посещаемость не даёт.
 *
 * <p>Колонки — уже начавшиеся уроки, а не весь период: будущий урок отмечать нечем, и
 * серая точка «не опубликовано» на нём читалась бы как долг учителя. Пустая клетка —
 * урок не этого ученика (чужая подгруппа), а не отсутствие данных.
 */
export function MyClassAttendanceTab({
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
  const { query: subjectsQuery, subjects, subjectId, selectSubject, correctSubject } = useMyClassSubject(classId, periodId);
  const journalQuery = useMyClassAttendanceJournal(classId, periodId, subjectId);

  useEffect(() => {
    if (isForbidden(subjectsQuery.error) || isForbidden(journalQuery.error)) onForbidden();
  }, [journalQuery.error, onForbidden, subjectsQuery.error]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    correctSubject(next);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [correctSubject, searchParams, setSearchParams]);

  function retry() {
    if (subjectsQuery.isError) void subjectsQuery.refetch();
    if (journalQuery.isError) void journalQuery.refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <SubjectFilter subjects={subjects} subjectId={subjectId} onChange={selectSubject} />
        <PeriodFilter periods={periods} periodId={periodId} onChange={onSelectPeriod} />
      </div>
      <AttendanceLegend />

      <section aria-label="Посещаемость класса" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
        {periodId == null ? (
          <EmptyBlock icon={<CalendarCheck2 className="h-7 w-7" />} title={periods.length === 0
            ? 'Учебные периоды пока не настроены'
            : 'Выберите учебный период, чтобы увидеть посещаемость'} />
        ) : subjectsQuery.isPending ? <LoadingBlock label="Загрузка предметов…" /> : subjectsQuery.isError ? (
          <ErrorBlock message="Не удалось загрузить посещаемость." onRetry={retry} />
        ) : subjects.length === 0 ? (
          <EmptyBlock icon={<CalendarCheck2 className="h-7 w-7" />} title="У класса пока нет предметов за этот период" />
        ) : journalQuery.isPending ? <LoadingBlock label="Загрузка посещаемости…" /> : journalQuery.isError ? (
          <ErrorBlock message="Не удалось загрузить посещаемость." onRetry={retry} />
        ) : (
          <JournalBody data={journalQuery.data} />
        )}
      </section>
    </div>
  );
}

function JournalBody({ data }: { data: Schema<'MyClassAttendanceJournalView'> }) {
  const { columns, rows } = buildAttendanceJournal(data);
  if (rows.length === 0) return <EmptyBlock title="В классе пока нет учеников" />;
  if (columns.length === 0) {
    return <EmptyBlock icon={<CalendarCheck2 className="h-7 w-7" />} title="По предмету пока нет уроков за этот период" />;
  }
  return <JournalTable columns={columns} rows={rows} />;
}

const STICKY = 'sticky z-10 bg-surface';
const HEAD = 'border-b border-line bg-canvas text-10 font-bold uppercase tracking-filter';

/** ФИО закреплены слева: уроков предмета в четверти бывает несколько десятков. */
function JournalTable({ columns, rows }: { columns: AttendanceColumn[]; rows: AttendanceRow[] }) {
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
                key={column.lessonId}
                scope="col"
                title={column.title}
                className={cx(HEAD, 'min-w-16 border-r px-1 py-2 text-center font-semibold last:border-r-0')}
              >
                <span className="block text-slate-400">{column.date}</span>
                <span className={cx('block max-w-24 truncate font-normal normal-case', column.cancelled ? 'text-slate-400' : 'text-slate-500')}>
                  {column.event}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.studentProfileId} className="border-b border-line last:border-b-0">
              <th
                scope="row"
                title={row.fullName}
                className={cx(STICKY, 'left-0 w-44 min-w-44 max-w-44 truncate border-r border-line px-4 py-2.5 text-left text-xs font-medium text-ink')}
              >
                {row.shortName}
              </th>
              {columns.map((column) => {
                const cell = row.cells.get(column.lessonId);
                return (
                  <td key={column.lessonId} title={cell?.title} className="border-r border-line px-1 py-2.5 text-center last:border-r-0">
                    {cell && (
                      <>
                        <AttendanceDot mark={cell.mark} />
                        <span className="sr-only">{cell.title}</span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
