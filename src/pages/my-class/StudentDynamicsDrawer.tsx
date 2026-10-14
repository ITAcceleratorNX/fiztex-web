import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChangeBadge } from '@/components/dynamics/ChangeBadge';
import { DynamicsChart, type ChartMarker } from '@/components/dynamics/DynamicsChart';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useStudentGradeDynamics, useStudentSubjectDynamics } from '@/hooks/dynamicsQueries';
import { cx } from '@/lib/format';
import {
  compareLabel,
  dayMonth,
  emptyReason,
  formatIndicator,
  formatSeriesValue,
  notGraded,
  pointKind,
  pointValue,
  windowLabel,
  type DynamicsMetric,
  type DynamicsPeriod,
  type DynamicsPoint,
  type DynamicsWindow,
} from '@/lib/dynamicsModel';

/**
 * Боковая панель динамики ученика (Figma 2216:45841) и его предмета (2216:47552).
 *
 * <p>Предмет открывается внутри той же панели: «‹ Белов Артём · все предметы» возвращает к
 * общей динамике, закрытие — к списку класса с тем же периодом. Всё, что на экране, —
 * ответы сервера; панель ничего не считает.
 */
export function StudentDynamicsDrawer({
  classId,
  className,
  period,
  student,
  students,
  subjectId,
  onSelectStudent,
  onSelectSubject,
  onClose,
}: {
  classId: number;
  className: string;
  period: DynamicsPeriod;
  student: { id: number; name: string };
  /** Список класса в текущем порядке — «ученик 4 из 24» и листание. */
  students: ReadonlyArray<{ id: number; name: string }>;
  subjectId: number | null;
  onSelectStudent: (studentId: number) => void;
  onSelectSubject: (subjectId: number | null) => void;
  onClose: () => void;
}) {
  const index = students.findIndex((item) => item.id === student.id);
  const previous = index > 0 ? students[index - 1] : null;
  const next = index >= 0 && index < students.length - 1 ? students[index + 1] : null;
  const overview = useStudentGradeDynamics(classId, student.id, period);
  const subject = useStudentSubjectDynamics(classId, student.id, subjectId, period);

  const header = subjectId == null ? (
    <span className="flex items-center gap-3">
      <Avatar name={student.name} size="lg" variant="navy" />
      <span>
        <span className="block">{student.name}</span>
        <span className="block text-sm font-normal text-slate-500">
          {className} класс{index >= 0 && ` · ученик ${index + 1} из ${students.length}`}
        </span>
      </span>
    </span>
  ) : (
    <span className="block">
      <button type="button" onClick={() => onSelectSubject(null)}
        className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />{student.name} · все предметы
      </button>
      <span className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-info-bg text-lg font-bold text-navy-700">
          {(subject.data?.subjectName ?? '?').slice(0, 1)}
        </span>
        <span>
          <span className="block">{subject.data?.subjectName ?? 'Предмет'}</span>
          <span className="block text-sm font-normal text-slate-500">{student.name} · {className} класс</span>
        </span>
      </span>
    </span>
  );

  return (
    <Modal
      open
      onClose={onClose}
      placement="right"
      size="xl"
      title={header}
      headerActions={subjectId == null ? (
        <div className="flex gap-2">
          <NavButton label="Предыдущий ученик" disabled={!previous} onClick={() => previous && onSelectStudent(previous.id)}>
            <ChevronLeft className="h-4 w-4" />
          </NavButton>
          <NavButton label="Следующий ученик" disabled={!next} onClick={() => next && onSelectStudent(next.id)}>
            <ChevronRight className="h-4 w-4" />
          </NavButton>
        </div>
      ) : undefined}
    >
      {subjectId == null ? (
        overview.isPending ? <LoadingBlock label="Загрузка динамики ученика…" /> : overview.isError ? (
          <ErrorBlock message="Не удалось загрузить динамику ученика." onRetry={() => void overview.refetch()} />
        ) : (
          <div className="space-y-5">
            <Headline metric={overview.data.overall} window={overview.data.window} previous={overview.data.previousWindow} />
            <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-line">
              <h3 className="text-lg font-bold text-ink">Динамика среднего балла</h3>
              <p className="mt-1 text-13 text-slate-500">По всем предметам</p>
              <div className="mt-4">
                {(overview.data.series ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">За период оценок пока нет</p>
                ) : (
                  <DynamicsChart
                    label={`Динамика среднего балла: ${student.name}`}
                    from={overview.data.window?.from ?? ''}
                    to={overview.data.window?.to ?? ''}
                    formatValue={(value) => formatSeriesValue({ value, mode: overview.data.overall?.current?.mode })}
                    lines={[
                      { key: 'student', label: student.name.split(' ')[1] ?? student.name, points: seriesPoints(overview.data.series) },
                      ...((overview.data.classSeries ?? []).length > 0
                        ? [{ key: 'class', label: 'Средний по классу (ориентир)', dashed: true, points: seriesPoints(overview.data.classSeries) }]
                        : []),
                    ]}
                  />
                )}
              </div>
            </section>
            <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-line">
              <h3 className="text-lg font-bold text-ink">По предметам</h3>
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr className="text-10 font-semibold uppercase tracking-filter text-slate-400">
                    <th scope="col" className="py-2 text-left">Предмет</th>
                    <th scope="col" className="py-2 text-right">Ср. балл</th>
                    <th scope="col" className="py-2 pl-4 text-left">Изменение</th>
                    <th scope="col" className="w-8"><span className="sr-only">Открыть</span></th>
                  </tr>
                </thead>
                <tbody>
                  {(overview.data.subjects ?? []).map((row) => {
                    const graded = !notGraded(row.metric);
                    return (
                      <tr key={row.subjectId} className={cx('border-t border-line', graded && 'cursor-pointer hover:bg-slate-50')}
                        onClick={graded ? () => onSelectSubject(row.subjectId ?? null) : undefined}>
                        <th scope="row" className="py-4 text-left font-semibold text-ink">
                          {graded ? (
                            <button type="button" className="text-left" onClick={(event) => { event.stopPropagation(); onSelectSubject(row.subjectId ?? null); }}>
                              {row.subjectName}
                            </button>
                          ) : row.subjectName}
                        </th>
                        <td className="py-4 text-right text-15 font-bold text-ink">{formatIndicator(row.metric?.current) ?? '—'}</td>
                        <td className="py-4 pl-4">
                          {graded ? <ChangeBadge metric={row.metric} />
                            : <span className="text-13 text-slate-500">Оценки не выставляются</span>}
                        </td>
                        <td className="w-8 text-right text-slate-400">{graded && <ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </div>
        )
      ) : subject.isPending ? <LoadingBlock label="Загрузка предмета…" /> : subject.isError ? (
        <ErrorBlock message="Не удалось загрузить динамику предмета." onRetry={() => void subject.refetch()} />
      ) : (
        <div className="space-y-5">
          <Headline metric={subject.data.metric} window={subject.data.window} previous={subject.data.previousWindow} />
          <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-line">
            <h3 className="text-lg font-bold text-ink">Оценки и средний балл</h3>
            <div className="mt-4">
              <SubjectChart
                name={`${subject.data.subjectName}: ${student.name}`}
                window={subject.data.window}
                points={subject.data.points ?? []}
                metric={subject.data.metric}
              />
            </div>
          </section>
          <GradeTiles points={subject.data.points ?? []} />
        </div>
      )}
    </Modal>
  );
}

function seriesPoints(series: ReadonlyArray<{ to?: string; value?: number | null }> | null | undefined) {
  return (series ?? []).filter((point) => point.to && point.value != null)
    .map((point) => ({ date: point.to!, value: Number(point.value) }));
}

/** «Средний балл · 1 четверть (01.09 – 27.10)», значение, изменение и «к 4 четверти 2025–2026». */
function Headline({ metric, window, previous }: {
  metric: DynamicsMetric | undefined;
  window: DynamicsWindow | undefined;
  previous: DynamicsWindow | null | undefined;
}) {
  const value = formatIndicator(metric?.current);
  return (
    <div>
      <p className="text-11 font-semibold uppercase tracking-filter text-slate-500">Средний балл · {windowLabel(window)}</p>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-28 font-bold text-ink">{value ?? '—'}</span>
        {value != null && <ChangeBadge metric={metric} />}
      </div>
      <p className="mt-2 text-13 text-slate-500">
        {value == null ? emptyReason(metric) : metric?.trend === 'INSUFFICIENT_DATA'
          ? 'За прошлый период оценок нет — сравнить пока не с чем'
          : compareLabel(previous)}
      </p>
    </div>
  );
}

function kindLabel(point: DynamicsPoint): string {
  const kind = pointKind(point);
  return kind === 'SOR' ? 'СОР' : kind === 'SOCH' ? 'СОЧ' : 'Оценка';
}

function SubjectChart({ name, window, points, metric }: {
  name: string;
  window: DynamicsWindow | undefined;
  points: DynamicsPoint[];
  metric: DynamicsMetric | undefined;
}) {
  const withValue = points.filter((point) => point.cumulativeValue != null);
  if (withValue.length === 0) return <p className="py-8 text-center text-sm text-slate-500">За период оценок пока нет</p>;
  const mode = metric?.current?.mode;
  const format = (value: number) => formatSeriesValue({ value, mode });
  const markers: ChartMarker[] = withValue.map((point) => {
    const v = pointValue(point);
    return {
      key: String(point.gradeId),
      date: point.date!,
      value: Number(point.cumulativeValue),
      kind: pointKind(point),
      title: `${dayMonth(point.date)} · ${kindLabel(point)} ${v.max ? `${v.main} из ${v.max}` : v.main} → средний ${format(Number(point.cumulativeValue))}`,
    };
  });
  const previous = metric?.previous;
  const reference = previous?.state === 'AVAILABLE' && previous.value != null && previous.mode === mode
    ? { value: Number(previous.value), label: `Прошлый период: ${format(Number(previous.value))}` }
    : undefined;
  return (
    <DynamicsChart
      label={`Оценки и средний балл: ${name}`}
      from={window?.from ?? withValue[0].date!}
      to={window?.to ?? withValue[withValue.length - 1].date!}
      formatValue={format}
      lines={[{ key: 'avg', label: 'Ср. балл', points: withValue.map((point) => ({ date: point.date!, value: Number(point.cumulativeValue) })) }]}
      markers={markers}
      reference={reference}
    />
  );
}

/** «Оценки за период · 17»: плитки по убыванию даты, СОР — зелёная рамка, СОЧ — тёмная. */
export function GradeTiles({ points }: { points: DynamicsPoint[] }) {
  const tiles = [...points].reverse();
  return (
    <section className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-line">
      <h3 className="text-lg font-bold text-ink">Оценки за период · {points.length}</h3>
      {tiles.length === 0 ? <p className="mt-3 text-sm text-slate-500">За период оценок нет</p> : (
        <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-2">
          {tiles.map((point) => {
            const kind = pointKind(point);
            const v = pointValue(point);
            return (
              <li key={point.gradeId}
                aria-label={`${kindLabel(point)} ${v.max ? `${v.main} из ${v.max}` : v.main}, ${dayMonth(point.date)}`}
                className={cx('flex h-20 flex-col items-center justify-center rounded-xl text-center',
                  kind === 'SOCH' ? 'bg-navy-700 text-white'
                    : kind === 'SOR' ? 'border-2 border-green-600 bg-white text-green-700'
                      : 'bg-info-bg text-navy-700')}>
                <span className="text-xl font-bold leading-none">
                  {v.main}{v.max && <span className="text-sm">/{v.max}</span>}
                </span>
                <span className={cx('mt-1 text-11', kind === 'SOCH' ? 'text-white/80' : 'text-slate-500')}>{dayMonth(point.date)}</span>
                {kind !== 'REGULAR' && <span className="mt-1 text-10 font-bold uppercase">{kind === 'SOR' ? 'СОР' : 'СОЧ'}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function NavButton({ label, disabled, onClick, children }: {
  label: string; disabled: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="flex size-10 items-center justify-center rounded-lg border border-line text-navy-700 transition hover:bg-neutral-bg disabled:cursor-not-allowed disabled:text-slate-300">
      {children}
    </button>
  );
}
