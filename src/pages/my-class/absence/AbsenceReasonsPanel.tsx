import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarCheck2, ChevronRight, CircleCheck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { FilterSelect } from '@/components/ui/FilterSelect';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useMyClassAbsenceDays, useMyClassStudentOptions } from '@/hooks/absenceReasonQueries';
import {
  GROUP_OPTIONS,
  absenceStatusBadge,
  groupCount,
  groupOf,
  lessonsCount,
  listDate,
  listReason,
  pendingResponsesChip,
  type AbsenceDayItem,
} from '@/lib/absenceReasonModel';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import { cx } from '@/lib/format';
import { PeriodFilter } from '../myClassFilters';
import { AbsenceDayDrawer } from './AbsenceDayDrawer';

type Period = Schema<'MyClassContextPeriodView'>;

/** Параметры раздела в адресе: ссылка из уведомления открывает тот же вид и тот же день. */
export const ABSENCE_PARAMS = ['absenceGroup', 'absenceStudent', 'absencePage', 'absenceDate', 'absenceDayStudent'];

/**
 * «Мой класс → Посещаемость → Причины отсутствий» (Figma `phyztex` К2–К16). Строка — ученик и
 * дата, а не урок; по умолчанию «Требуют действия». Строки, группы и их размер приходят с
 * сервера, фильтры уходят параметрами. Строка открывает карточку дня справа — как «Динамика
 * ученика» в соседней вкладке.
 */
export function AbsenceReasonsPanel({
  classId,
  className,
  periods,
  periodId,
  onSelectPeriod,
  onForbidden,
}: {
  classId: number;
  className: string;
  periods: Period[];
  periodId: number | null;
  onSelectPeriod: (periodId: string) => void;
  onForbidden: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const group = groupOf(searchParams.get('absenceGroup'));
  const studentProfileId = Number(searchParams.get('absenceStudent')) || null;
  const page = Math.max(0, Number(searchParams.get('absencePage')) || 0);
  const openDate = searchParams.get('absenceDate');
  const openStudent = Number(searchParams.get('absenceDayStudent')) || null;

  const students = useMyClassStudentOptions(classId);
  const list = useMyClassAbsenceDays(classId, { periodId, studentProfileId, group, page });

  useEffect(() => {
    if (list.error instanceof ApiError && list.error.status === 403) onForbidden();
  }, [list.error, onForbidden]);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(changes)) {
      if (value == null) next.delete(name);
      else next.set(name, value);
    }
    setSearchParams(next);
  }

  function openDay(item: AbsenceDayItem) {
    update({ absenceDate: item.date ?? null, absenceDayStudent: String(item.studentProfileId) });
  }

  const counts = list.data?.counts;
  const items = list.data?.items ?? [];
  const openRow = items.find((item) => item.studentProfileId === openStudent && item.date === openDate);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <PeriodFilter periods={periods} periodId={periodId} onChange={(value) => {
          update({ absencePage: null });
          onSelectPeriod(value);
        }} />
        <FilterSelect
          label="Ученик"
          className="w-56"
          value={studentProfileId == null ? '' : String(studentProfileId)}
          onChange={(value) => update({ absenceStudent: value || null, absencePage: null })}
        >
          <option value="">Все ученики</option>
          {(students.data ?? []).map((student) => (
            <option key={student.studentProfileId} value={student.studentProfileId}>
              {student.displayName ?? [student.lastName, student.firstName].filter(Boolean).join(' ')}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Состояние"
          className="w-60"
          value={group}
          onChange={(value) => update({ absenceGroup: value === 'ACTION_REQUIRED' ? null : value, absencePage: null })}
        >
          {GROUP_OPTIONS.map((option) => {
            const count = groupCount(counts, option.value);
            return (
              <option key={option.value} value={option.value}>
                {count == null ? option.label : `${option.label} (${count})`}
              </option>
            );
          })}
        </FilterSelect>
      </div>

      {periodId == null ? (
        <section className="rounded-2xl border border-line bg-surface">
          <EmptyBlock icon={<CalendarCheck2 className="h-7 w-7" />} title={periods.length === 0
            ? 'Учебные периоды пока не настроены'
            : 'Выберите учебный период, чтобы увидеть отсутствия'} />
        </section>
      ) : list.isPending ? (
        <section className="rounded-2xl border border-line bg-surface"><LoadingBlock label="Загружаем отсутствия…" /></section>
      ) : list.isError ? (
        <section className="rounded-2xl border border-line bg-surface">
          <ErrorBlock
            message={list.error instanceof ApiError && list.error.status !== 0
              ? 'Не удалось загрузить отсутствия. Повторите попытку.'
              : 'Не удалось загрузить отсутствия: нет связи с сервером. Проверьте подключение и повторите попытку.'}
            onRetry={() => void list.refetch()}
          />
        </section>
      ) : items.length === 0 ? (
        <section className="rounded-2xl border border-line bg-surface">
          {group === 'ACTION_REQUIRED' ? (
            <EmptyBlock
              icon={<CircleCheck className="h-7 w-7" />}
              title="Все отсутствия обработаны"
              description="Нет дат, где нужно указать или подтвердить причину. Ответы родителей появятся здесь, как только они их отправят."
            />
          ) : (
            <EmptyBlock icon={<CalendarCheck2 className="h-7 w-7" />} title={emptyTitle(group)} />
          )}
        </section>
      ) : (
        <>
          <div className={cx(list.isPlaceholderData && 'pointer-events-none opacity-60 transition-opacity')}>
            <DataTable label="Причины отсутствий" appearance="registry">
              <thead>
                <tr>
                  <th scope="col" className="w-32">Дата</th>
                  <th scope="col">Ученик</th>
                  <th scope="col" className="w-32">Пропущено</th>
                  <th scope="col" className="w-60">Причина</th>
                  <th scope="col" className="w-52">Статус</th>
                  <th scope="col" className="w-12"><span className="sr-only">Открыть</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <AbsenceRow key={`${item.studentProfileId}@${item.date}`} item={item} onOpen={() => openDay(item)} />
                ))}
              </tbody>
            </DataTable>
          </div>
          <Pagination
            page={page}
            totalPages={list.data?.totalPages ?? 0}
            totalElements={list.data?.totalItems ?? 0}
            pageSize={list.data?.size ?? 20}
            itemForms={['дня', 'дней', 'дней']}
            label="Страницы отсутствий"
            onPageChange={(next) => update({ absencePage: next === 0 ? null : String(next) })}
          />
        </>
      )}

      {openDate && openStudent != null && (
        <AbsenceDayDrawer
          classId={classId}
          className={className}
          studentProfileId={openStudent}
          date={openDate}
          fallbackName={openRow?.studentName}
          onClose={() => update({ absenceDate: null, absenceDayStudent: null })}
        />
      )}
    </div>
  );
}

function emptyTitle(group: string): string {
  if (group === 'AWAITING_PARENT') return 'Ответов родителей никто не ждёт';
  if (group === 'CONFIRMED') return 'Подтверждённых причин за период пока нет';
  return 'За период отсутствий нет';
}

function AbsenceRow({ item, onOpen }: { item: AbsenceDayItem; onOpen: () => void }) {
  const badge = absenceStatusBadge(item.status);
  const chip = pendingResponsesChip(item.status, item.pendingResponseCount);
  const reason = listReason(item);
  return (
    <tr onClick={onOpen} className="cursor-pointer transition hover:bg-slate-50">
      <td className="whitespace-nowrap text-sm">{listDate(item.date)}</td>
      <td className="text-sm font-medium">
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onOpen(); }}
          className="text-left hover:text-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700"
        >
          {item.studentName}
        </button>
      </td>
      <td className="whitespace-nowrap text-sm">{lessonsCount(item.absentLessonCount)}</td>
      <td className={cx('text-sm', reason.muted ? 'text-slate-400' : 'text-ink')}>{reason.text}</td>
      <td>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={badge.tone} dot>{badge.label}</Badge>
          {chip && <Badge tone="amber" dot>{chip}</Badge>}
        </span>
      </td>
      <td className="text-right">
        <ChevronRight className="ml-auto size-[18px] text-slate-400" aria-hidden="true" />
      </td>
    </tr>
  );
}
