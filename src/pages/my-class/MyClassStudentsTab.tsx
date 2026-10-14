import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownUp, ChevronRight } from 'lucide-react';
import { ChangeBadge } from '@/components/dynamics/ChangeBadge';
import { Avatar } from '@/components/ui/Avatar';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useClassGradeDynamics } from '@/hooks/dynamicsQueries';
import { ApiError } from '@/lib/api';
import type { Schema } from '@/lib/apiSchemas';
import { cx } from '@/lib/format';
import {
  compareLabel,
  formatChange,
  formatIndicator,
  periodOf,
  PERIODS,
  sortByChange,
  windowLabel,
  type SortOrder,
} from '@/lib/dynamicsModel';
import { StudentDynamicsDrawer } from './StudentDynamicsDrawer';

type Row = Schema<'ClassStudentDynamicsView'>;
type Changed = Schema<'ChangedSubjectView'>;

/** Параметры динамики в адресе — общие для списка, панели ученика и предмета. */
export const DYNAMICS_PARAMS = ['dynPeriod', 'dynSort', 'dynStudent', 'dynSubject'];

const VISIBLE_SUBJECTS = 2;

function studentCountLabel(count: number): string {
  const plural = new Intl.PluralRules('ru-RU').select(count);
  return `${count} ${plural === 'one' ? 'ученик' : plural === 'few' ? 'ученика' : 'учеников'}`;
}

function sortOf(value: string | null): SortOrder {
  return value === 'decline' || value === 'growth' ? value : 'none';
}

function idParam(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * «Мой класс → Ученики» с динамикой оценок (Figma 2237:7435, 2216:44293, 2216:45314).
 *
 * <p>Средний класса, изменение и «Где изменилось» — ответ `/grade-dynamics` сервера;
 * сортировка лишь переставляет строки по уже полученному изменению. Период, порядок,
 * открытый ученик и предмет живут в адресе: обновление страницы и «назад» возвращают тот
 * же экран, а смена класса их сбрасывает (MyClassPage).
 */
export function MyClassStudentsTab({
  classId,
  className,
  onForbidden,
}: {
  classId: number;
  className: string;
  onForbidden: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = periodOf(searchParams.get('dynPeriod'));
  const sort = sortOf(searchParams.get('dynSort'));
  const studentId = idParam(searchParams.get('dynStudent'));
  const subjectId = idParam(searchParams.get('dynSubject'));
  const dynamics = useClassGradeDynamics(classId, period);

  useEffect(() => {
    if (dynamics.error instanceof ApiError && dynamics.error.status === 403) onForbidden();
  }, [dynamics.error, onForbidden]);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(changes)) {
      if (value == null) next.delete(name);
      else next.set(name, value);
    }
    setSearchParams(next);
  }

  const rows = sortByChange(dynamics.data?.students ?? [], sort, (row) => row.overall);
  const roster = rows.filter((row) => row.studentProfileId != null)
    .map((row) => ({ id: row.studentProfileId!, name: row.displayName ?? '' }));
  const open = roster.find((item) => item.id === studentId);
  const classAverage = dynamics.data?.classAverage;
  const averageText = formatIndicator(classAverage?.current);
  const nextSort: SortOrder = sort === 'none' ? 'decline' : sort === 'decline' ? 'growth' : 'none';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <SegmentedTabs
          value={period}
          ariaLabel="Период динамики"
          options={PERIODS}
          onChange={(value) => update({ dynPeriod: value === 'QUARTER' ? null : value, dynSubject: null })}
        />
        {dynamics.data && (
          <p className="text-13 text-slate-500">
            Данные за {windowLabel(dynamics.data.window)} · сравнение {compareLabel(dynamics.data.previousWindow)}
          </p>
        )}
        {dynamics.data && averageText != null && (
          <p className="ml-auto flex items-center gap-2 text-15 font-bold text-ink">
            Ср. балл {averageText}
            <ChangeBadge metric={classAverage} withStatus />
          </p>
        )}
      </div>

      <section aria-label="Динамика учеников класса" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
        {dynamics.isPending ? <LoadingBlock label="Загрузка динамики класса…" /> : dynamics.isError ? (
          <ErrorBlock message="Не удалось загрузить данные класса." onRetry={() => void dynamics.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyBlock title="В классе пока нет учеников" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-10 font-semibold uppercase tracking-filter text-slate-400">
                  <th scope="col" className="px-6 py-3 text-left">Ученик</th>
                  <th scope="col" className="px-3 py-3 text-right">Ср. балл</th>
                  <th scope="col" className="px-3 py-3 text-left" aria-sort={sort === 'none' ? 'none' : sort === 'growth' ? 'descending' : 'ascending'}>
                    <button type="button" onClick={() => update({ dynSort: nextSort === 'none' ? null : nextSort })}
                      className="inline-flex items-center gap-1 uppercase hover:text-navy-700"
                      title={sort === 'none' ? 'Сначала снижение' : sort === 'decline' ? 'Сначала рост' : 'Без сортировки'}>
                      Изменение <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">{sort === 'decline' ? '(сначала снижение)' : sort === 'growth' ? '(сначала рост)' : ''}</span>
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-3 text-left">Где изменилось</th>
                  <th scope="col" className="w-10"><span className="sr-only">Открыть</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <StudentRow key={row.studentProfileId} row={row}
                    selected={row.studentProfileId === studentId}
                    onOpen={() => update({ dynStudent: String(row.studentProfileId), dynSubject: null })} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {rows.length > 0 && <p className="text-sm text-muted">Всего: {studentCountLabel(rows.length)}</p>}

      {open && (
        <StudentDynamicsDrawer
          classId={classId}
          className={className}
          period={period}
          student={open}
          students={roster}
          subjectId={subjectId}
          onSelectStudent={(id) => update({ dynStudent: String(id), dynSubject: null })}
          onSelectSubject={(id) => update({ dynSubject: id == null ? null : String(id) })}
          onClose={() => update({ dynStudent: null, dynSubject: null })}
        />
      )}
    </div>
  );
}

function StudentRow({ row, selected, onOpen }: { row: Row; selected: boolean; onOpen: () => void }) {
  const name = row.displayName ?? '';
  const value = formatIndicator(row.overall?.current);
  return (
    <tr onClick={onOpen} className={cx('cursor-pointer border-b border-line transition last:border-b-0 hover:bg-slate-50', selected && 'bg-slate-100')}>
      <th scope="row" className="px-6 py-3 text-left">
        <button type="button" aria-label={`Открыть динамику: ${name}`} onClick={(event) => { event.stopPropagation(); onOpen(); }}
          className="flex items-center gap-3 font-bold text-ink focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700">
          <Avatar name={name} size="sm" variant="navy" />
          <span>{name}</span>
        </button>
      </th>
      <td className="px-3 py-3 text-right tabular-nums text-slate-700">{value ?? <span className="text-slate-400" title="Оценок за период нет">—</span>}</td>
      <td className="px-3 py-3">{value == null ? <span className="text-13 text-slate-400">Нет оценок за период</span> : <ChangeBadge metric={row.overall} />}</td>
      <td className="px-3 py-3"><ChangedSubjects subjects={row.changedSubjects ?? []} /></td>
      <td className="w-10 pr-4 text-right text-slate-400" aria-hidden="true"><ChevronRight className="ml-auto h-4 w-4" /></td>
    </tr>
  );
}

/** Видимые предметы и «+N» с остальными во всплывающем списке (Figma 2216:44293). */
function ChangedSubjects({ subjects }: { subjects: Changed[] }) {
  const [open, setOpen] = useState(false);
  if (subjects.length === 0) return <span className="text-slate-400">—</span>;
  const visible = subjects.slice(0, VISIBLE_SUBJECTS);
  const rest = subjects.slice(VISIBLE_SUBJECTS);
  return (
    <span className="flex flex-wrap items-center gap-2">
      {visible.map((subject) => <SubjectTag key={subject.subjectId} subject={subject} />)}
      {rest.length > 0 && (
        <span className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
          <button type="button" aria-expanded={open} aria-label={`Ещё ${rest.length}: ${rest.map((item) => item.subjectName).join(', ')}`}
            onClick={(event) => { event.stopPropagation(); setOpen(true); }}
            onBlur={() => setOpen(false)}
            className="rounded-md bg-info-bg px-2 py-0.5 text-13 font-bold text-navy-700">
            +{rest.length}
          </button>
          {open && (
            <span role="tooltip" onClick={(event) => event.stopPropagation()}
              className="absolute right-0 top-full z-20 mt-2 block w-56 rounded-xl border border-line bg-white p-3 text-left shadow-popover">
              <span className="block text-10 font-semibold uppercase tracking-filter text-slate-500">Ещё изменилось</span>
              {rest.map((subject) => (
                <span key={subject.subjectId} className="mt-2 flex justify-between text-13 text-ink">
                  {subject.subjectName}
                  <span className={subject.trend === 'GROWTH' ? 'font-bold text-green-700' : 'font-bold text-red-600'}>{formatChange(subject.change)}</span>
                </span>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function SubjectTag({ subject }: { subject: Changed }) {
  return (
    <span className="whitespace-nowrap rounded-md border border-line px-2 py-0.5 text-13 text-slate-600">
      {subject.subjectName}{' '}
      <span className={subject.trend === 'GROWTH' ? 'font-bold text-green-700' : 'font-bold text-red-600'}>{formatChange(subject.change)}</span>
    </span>
  );
}
