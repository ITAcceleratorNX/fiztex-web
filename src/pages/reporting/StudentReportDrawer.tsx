import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { GradeChip } from '@/components/ui/GradeChip';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import {
  useReportBreakdown,
  useReportFinals,
  useReportSummary,
  type ReportFilter,
  type ReportOwner,
} from '@/hooks/reportingQueries';
import { cx } from '@/lib/format';
import {
  attendanceDisplay,
  averageDisplay,
  countDisplay,
  periodFinalsBySubject,
  type MetricDisplay,
  type ReportReference,
} from '@/lib/reportingModel';
import { MetricCell } from './ReportTable';

/**
 * Боковая карточка ученика (Figma «Шторка ученика» 2196:22570): сводка за выбранный
 * период и показатели по предметам. Всё — те же ответы отчётности, суженные до ученика
 * (`studentProfileId`), поэтому числа совпадают со строкой, из которой карточку открыли.
 *
 * <p>Фильтры страницы карточка не трогает: закрытие возвращает ту же таблицу, листание —
 * соседних учеников того же списка.
 */
export function StudentReportDrawer({
  owner,
  filter,
  student,
  className,
  context,
  students,
  highlightSubjectId,
  onSelect,
  onClose,
}: {
  owner: ReportOwner;
  /** Фильтр страницы; ученик добавляется к нему здесь. Класс обязателен. */
  filter: ReportFilter;
  student: ReportReference;
  className: string;
  /** «Данные за 1 четверть (01.09 – 31.10)». */
  context: string;
  /** Список, из которого открыли карточку, — для «ученик 4 из 24» и листания. */
  students: ReportReference[];
  /** Предмет детализации, из которой открыли карточку, — подсвечивается в таблице. */
  highlightSubjectId?: number | null;
  onSelect: (studentId: number) => void;
  onClose: () => void;
}) {
  // Предмет страницы карточку не сужает: в ней все предметы ученика.
  const scope: ReportFilter = { ...filter, subjectId: null, teacherProfileId: null, studentProfileId: student.id };
  const summary = useReportSummary(owner, scope);
  const subjects = useReportBreakdown(owner, scope, 'SUBJECT');
  const finals = useReportFinals(owner, scope);
  const index = students.findIndex((item) => item.id === student.id);
  const previous = index > 0 ? students[index - 1] : null;
  const next = index >= 0 && index < students.length - 1 ? students[index + 1] : null;
  const name = student.name ?? 'Ученик';
  const attendance = summary.data?.metrics?.attendance;
  const finalBySubject = periodFinalsBySubject(finals.data ?? []);

  return (
    <Modal
      open
      onClose={onClose}
      placement="right"
      size="md"
      title={(
        <span className="flex items-center gap-3">
          <Avatar name={name} size="lg" variant="navy" />
          <span>
            <span className="block">{name}</span>
            <span className="block text-sm font-normal text-slate-500">{className}</span>
          </span>
        </span>
      )}
      headerActions={(
        <div className="flex gap-2">
          <NavButton label="Предыдущий ученик" disabled={!previous} onClick={() => previous?.id != null && onSelect(previous.id)}>
            <ChevronLeft className="h-4 w-4" />
          </NavButton>
          <NavButton label="Следующий ученик" disabled={!next} onClick={() => next?.id != null && onSelect(next.id)}>
            <ChevronRight className="h-4 w-4" />
          </NavButton>
        </div>
      )}
    >
      <p className="text-13 text-slate-500">
        {context}{index >= 0 && ` · ученик ${index + 1} из ${students.length}`}
      </p>

      {summary.isPending || subjects.isPending ? <LoadingBlock label="Загрузка показателей ученика…" /> : summary.isError || subjects.isError ? (
        <ErrorBlock message="Не удалось загрузить показатели ученика." onRetry={() => {
          void summary.refetch();
          void subjects.refetch();
        }} />
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-4 gap-2">
            <Stat label="Ср. балл" value={averageDisplay(summary.data?.metrics)} />
            <Stat label="Пропуски" value={countDisplay(attendance?.missedCount)} />
            <Stat label="Опоздания" value={countDisplay(attendance?.lateCount)} />
            <Stat label="Посещ." value={attendanceDisplay(summary.data?.metrics)} />
          </dl>

          <div className="mt-6 overflow-hidden rounded-2xl border border-line">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Показатели ученика по предметам</caption>
              <thead>
                <tr className="bg-canvas text-10 font-semibold uppercase tracking-filter text-slate-400">
                  <th scope="col" className="px-4 py-3 text-left">Предмет</th>
                  <th scope="col" className="px-3 py-3 text-right">Ср. балл</th>
                  <th scope="col" className="px-3 py-3 text-center">Итог</th>
                  <th scope="col" className="px-4 py-3 text-right">Пропуски</th>
                </tr>
              </thead>
              <tbody>
                {(subjects.data?.rows ?? []).length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">За период данных по предметам нет</td></tr>
                ) : subjects.data!.rows.map((row) => {
                  const subjectId = row.key?.id;
                  const final = subjectId == null ? undefined : finalBySubject.get(subjectId);
                  const highlighted = subjectId != null && subjectId === highlightSubjectId;
                  return (
                    <tr key={subjectId} className={cx('border-t border-line', highlighted && 'bg-info-bg')}>
                      <th scope="row" className={cx('px-4 py-3 text-left font-semibold text-navy-700',
                        highlighted && 'border-l-2 border-navy-700')}>{row.key?.name}</th>
                      <td className="px-3 py-3 text-right tabular-nums"><MetricCell value={averageDisplay(row.metrics)} /></td>
                      <td className="px-3 py-3">
                        <span className="flex justify-center">
                          {final == null
                            ? <span className="text-slate-400" title="Итог за период не опубликован">—</span>
                            : <GradeChip size="sm" value={String(final)} />}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <MetricCell value={countDisplay(row.metrics?.attendance?.missedCount)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: MetricDisplay }) {
  return (
    <div className="rounded-xl bg-info-bg px-3 py-3">
      <dt className="text-10 font-semibold uppercase tracking-filter text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-navy-700"><MetricCell value={value} /></dd>
    </div>
  );
}

function NavButton({ label, disabled, onClick, children }: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-10 items-center justify-center rounded-lg border border-line text-navy-700 transition hover:bg-neutral-bg disabled:cursor-not-allowed disabled:text-slate-300"
    >
      {children}
    </button>
  );
}
