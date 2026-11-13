import { useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download, Minus, Trophy } from 'lucide-react';
import { DynamicsChart } from '@/components/dynamics/DynamicsChart';
import { Button } from '@/components/ui/Button';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { downloadReportExcel, type ReportFilter, type ReportOwner } from '@/hooks/reportingQueries';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import {
  basisLabel,
  changeDisplay,
  decimalDisplay,
  formatCount,
  performanceValueDisplay,
  ratingStateHint,
  type ClassRating,
  type ClassRatingRow,
  type DynamicsPoint,
  type MetricDisplay,
  type ReportPerformance,
  type StudentRating,
  type StudentRatingRow,
} from '@/lib/reportingModel';
import { MetricCell, ReportTable, StudentName } from './ReportTable';

/**
 * Блоки «Учебной отчётности и рейтингов» поверх существующих таблиц отчёта: сводная
 * успеваемость, полный рейтинг учеников, сравнение классов, динамика и Excel.
 *
 * <p>Ничего не считается здесь: места, порядок, средние, полнота и «Предварительно»
 * приходят с сервера (ТЗ Frontend §6, §8). Блоки общие для администратора, классного
 * руководителя и учителя-предметника — роль решает только набор запросов страницы.
 */

/** Карточки над таблицами: успеваемость с основой расчёта, полнота и ВНА/НА. */
export function PerformanceStrip({
  performance,
  attendance,
  pending,
  failed,
}: {
  performance: ReportPerformance | null | undefined;
  attendance?: MetricDisplay;
  pending: boolean;
  failed: boolean;
}) {
  const statuses = (performance?.temporarilyUnattestedCount ?? 0) + (performance?.notAttestedCount ?? 0);
  return (
    <section aria-label="Сводная успеваемость" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Средний балл" hint={performance ? basisLabel(performance.basis, performance.preliminary) : undefined}
        accent={performance?.preliminary}>
        {pending ? <span className="text-slate-400">…</span> : failed
          ? <span className="text-13 text-red-600">Не загрузилось</span>
          : <MetricCell value={performanceValueDisplay(performance)} strong />}
      </Kpi>
      {attendance && (
        <Kpi label="Посещаемость" hint="По опубликованным отметкам">
          <MetricCell value={attendance} strong />
        </Kpi>
      )}
      <Kpi label="Учеников в расчёте"
        hint={(performance?.studentsExcluded ?? 0) > 0
          ? `Ещё ${formatCount(performance?.studentsExcluded ?? 0)} — с неполными данными или ВНА/НА`
          : 'Данные полные'}>
        {pending || !performance ? <span className="text-slate-400">—</span> : formatCount(performance.studentsWithResult ?? 0)}
      </Kpi>
      <Kpi label="ВНА / НА" hint="Не входят в средние и не считаются нулём">
        {pending || !performance ? <span className="text-slate-400">—</span>
          : statuses === 0 ? '0'
            : `${formatCount(performance.temporarilyUnattestedCount ?? 0)} / ${formatCount(performance.notAttestedCount ?? 0)}`}
      </Kpi>
    </section>
  );
}

function Kpi({ label, hint, accent, children }: { label: string; hint?: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-soft">
      <p className="text-10 font-semibold uppercase tracking-filter text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{children}</p>
      {hint && <p className={cx('mt-1 text-11', accent ? 'font-semibold text-amber-700' : 'text-slate-500')}>{hint}</p>}
    </div>
  );
}

/** Подпись над рейтингом: основа, «Предварительно», сколько без места и почему. */
function RatingNotice({ basis, preliminary, unranked, statuses, extra }: {
  basis: string | undefined;
  preliminary: boolean | undefined;
  unranked?: number;
  statuses?: number;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-13 text-slate-500">
      <span className={cx('font-semibold', preliminary ? 'text-amber-700' : 'text-slate-700')}>
        {basisLabel(basis, preliminary)}
      </span>
      {unranked != null && unranked > 0 && <span>Без места: {formatCount(unranked)} — данные неполные</span>}
      {statuses != null && statuses > 0 && <span>ВНА/НА: {formatCount(statuses)} — показаны отдельно, не нулём</span>}
      {extra}
    </div>
  );
}

function PlaceCell({ place, hint }: { place: number | null | undefined; hint?: string }) {
  if (place == null) return <span className="text-slate-400" title={hint}>—</span>;
  return <span className="font-semibold tabular-nums text-ink">{place}</span>;
}

/** Полный рейтинг учеников — не топ-5; равные места и порядок — как отдал сервер. */
export function StudentRatingTable({
  rating,
  pending,
  error,
  onRetry,
  showClass,
  selectedId,
  onOpen,
}: {
  rating: StudentRating | undefined;
  pending: boolean;
  error: unknown;
  onRetry: () => void;
  showClass: boolean;
  selectedId?: number | null;
  onOpen?: (row: StudentRatingRow) => void;
}) {
  const [view, setView] = useState<'all' | 'declining'>('all');
  if (pending) return <LoadingBlock label="Загрузка рейтинга…" />;
  if (error || !rating) return <ErrorBlock message={errorText(error, 'Не удалось загрузить рейтинг учеников.')} onRetry={onRetry} />;
  const previous = rating.previousPeriod;
  const all = rating.items ?? [];
  // «Снижение результатов» — те, у кого сервер посчитал падение к прошлому периоду;
  // сильнее упавшие — выше. Сравнения нет — ученика в этом списке нет.
  const rows = view === 'declining' && previous
    ? decliningRows(all)
    : all;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RatingNotice basis={rating.basis} preliminary={rating.preliminary} unranked={rating.unrankedCount}
          statuses={(rating.temporarilyUnattestedCount ?? 0) + (rating.notAttestedCount ?? 0)} />
        {previous && (
          <SegmentedTabs value={view} ariaLabel="Ученики рейтинга" onChange={setView}
            options={[{ value: 'all', label: 'Все ученики' }, { value: 'declining', label: 'Снижение результатов' }]} />
        )}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-5 py-8 text-center text-13 text-slate-500">
          {view === 'declining' && previous
            ? `Снижения к периоду «${previous.name}» нет`
            : 'Недостаточно данных для рейтинга за выбранный период'}
        </p>
      ) : (
        <ReportTable
          label="Рейтинг учеников"
          rows={rows}
          rowKey={(row) => row.student?.id ?? 0}
          rowLabel={(row) => `Открыть карточку: ${row.student?.name}`}
          selectedKey={selectedId}
          onOpen={onOpen}
          columns={[
            { key: 'student', header: 'Ученик', className: 'w-72', cell: (row) => <StudentName name={row.student?.name ?? ''} /> },
            { key: 'place', header: 'Место', align: 'right', cell: (row) => <PlaceCell place={row.place} hint={ratingStateHint(row)} /> },
            ...(showClass ? [{ key: 'class', header: 'Класс', cell: (row: StudentRatingRow) => row.schoolClass?.name ?? '—' }] : []),
            { key: 'value', header: 'Ср. балл', align: 'right',
              cell: (row) => <MetricCell value={decimalDisplay(row.value, ratingStateHint(row) ?? 'Нет данных')} /> },
            ...(previous ? [{
              key: 'change', header: `К «${previous.name}»`, align: 'right' as const,
              cell: (row: StudentRatingRow) => <Change value={row.change} />,
            }] : []),
            { key: 'subjects', header: 'Предметов', align: 'right',
              cell: (row) => `${row.subjectsWithResult ?? 0} из ${row.subjectsExpected ?? 0}` },
            { key: 'note', header: 'Примечание', cell: (row) => <RatingNote row={row} /> },
          ]}
        />
      )}
    </div>
  );
}

/** Падение к прошлому периоду, сильнее упавшие — выше. */
export function decliningRows(rows: StudentRatingRow[]): StudentRatingRow[] {
  return rows.filter((row) => row.change != null && row.change < 0)
    .sort((a, b) => (a.change ?? 0) - (b.change ?? 0));
}

function RatingNote({ row }: { row: StudentRatingRow }) {
  const statuses = [
    row.temporarilyUnattestedCount ? `ВНА: ${row.temporarilyUnattestedCount}` : null,
    row.notAttestedCount ? `НА: ${row.notAttestedCount}` : null,
  ].filter(Boolean).join(' · ');
  if (row.state === 'RANKED') return null;
  return <span className="text-13 text-slate-500">{statuses || ratingStateHint(row)}</span>;
}

/**
 * Сравнение классов. «Лучший класс» — только когда сервер назвал победителя; иначе
 * таблица с предупреждением о неполном сравнении и без кубка (ТЗ §5–6).
 */
export function ClassRatingTable({
  rating,
  pending,
  error,
  onRetry,
  onOpen,
}: {
  rating: ClassRating | undefined;
  pending: boolean;
  error: unknown;
  onRetry: () => void;
  onOpen?: (row: ClassRatingRow) => void;
}) {
  if (pending) return <LoadingBlock label="Загрузка сравнения классов…" />;
  if (error || !rating) return <ErrorBlock message={errorText(error, 'Не удалось загрузить сравнение классов.')} onRetry={onRetry} />;
  const rows = rating.items ?? [];
  const leader = rows.find((row) => row.schoolClass?.id === rating.leaderClassId);
  return (
    <div className="space-y-3">
      <RatingNotice basis={rating.basis} preliminary={rating.preliminary}
        extra={leader ? (
          <span className="inline-flex items-center gap-1 font-semibold text-navy-700">
            <Trophy className="h-4 w-4" aria-hidden="true" /> Лучший класс: {leader.schoolClass?.name}
          </span>
        ) : null} />
      {!rating.comparable && rows.length > 1 && (
        <p role="note" className="flex items-start gap-2 rounded-xl bg-warning-bg px-4 py-3 text-13 text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Сравнение неполное: у части классов данные заполнены не полностью, поэтому лучший класс не определяется.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-5 py-8 text-center text-13 text-slate-500">
          Нет классов для сравнения за выбранный период
        </p>
      ) : (
        <ReportTable
          label="Рейтинг классов"
          rows={rows}
          rowKey={(row) => row.schoolClass?.id ?? 0}
          rowLabel={(row) => `Открыть класс ${row.schoolClass?.name}`}
          onOpen={onOpen}
          columns={[
            { key: 'class', header: 'Класс', className: 'w-40', cell: (row) => row.schoolClass?.name },
            { key: 'place', header: 'Место', align: 'right', cell: (row) => <PlaceCell place={row.place} /> },
            { key: 'value', header: 'Ср. балл', align: 'right',
              cell: (row) => <MetricCell value={decimalDisplay(row.value, 'Недостаточно данных для расчёта')} /> },
            { key: 'students', header: 'С результатом', align: 'right',
              cell: (row) => `${formatCount(row.studentsWithResult ?? 0)} из ${formatCount(row.currentStudentCount ?? 0)}` },
            { key: 'statuses', header: 'ВНА / НА', align: 'right',
              cell: (row) => `${formatCount(row.temporarilyUnattestedCount ?? 0)} / ${formatCount(row.notAttestedCount ?? 0)}` },
            { key: 'complete', header: 'Данные',
              cell: (row) => row.complete
                ? <span className="text-13 text-success-fg">Полные</span>
                : <span className="text-13 text-amber-700">Неполные</span> },
          ]}
        />
      )}
    </div>
  );
}

/**
 * Динамика по периодам года: график среднего и таблица с изменением к прошлому периоду.
 * Период без данных — пропуск и «Нет данных», а не точка на нуле (ТЗ Frontend §5).
 */
export function DynamicsPanel({
  points,
  pending,
  error,
  onRetry,
}: {
  points: DynamicsPoint[] | undefined;
  pending: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (pending) return <LoadingBlock label="Загрузка динамики…" />;
  if (error || !points) return <ErrorBlock message={errorText(error, 'Не удалось загрузить динамику.')} onRetry={onRetry} />;
  const withValue = points.filter((point) => point.performance?.value != null && point.period?.endDate);
  const first = points[0]?.period?.startDate;
  const last = points[points.length - 1]?.period?.endDate;
  return (
    <div className="space-y-4">
      {withValue.length > 0 && first && last && (
        <section aria-label="График среднего балла по периодам" className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
          <p className="mb-2 text-13 font-semibold text-ink">Средний балл по периодам</p>
          <DynamicsChart from={first} to={last} label="Средний балл по периодам"
            formatValue={(value) => value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            lines={[{
              key: 'performance', label: 'Средний балл',
              points: withValue.map((point) => ({ date: midpoint(point.period!.startDate!, point.period!.endDate!), value: point.performance!.value! })),
            }]} />
        </section>
      )}
      <ReportTable
        label="Динамика по периодам"
        rows={points}
        rowKey={(point) => point.period?.id ?? 0}
        rowLabel={(point) => point.period?.name ?? ''}
        columns={[
          { key: 'period', header: 'Период', className: 'w-48', cell: (point) => point.period?.name },
          { key: 'value', header: 'Ср. балл', align: 'right',
            cell: (point) => <MetricCell value={decimalDisplay(point.performance?.value,
              point.started ? 'Недостаточно данных для расчёта' : 'Период ещё не начался')} /> },
          { key: 'change', header: 'Изменение', align: 'right', cell: (point) => <Change value={point.performanceChange} /> },
          { key: 'attendance', header: 'Посещаемость', align: 'right',
            cell: (point) => <MetricCell value={percentDisplay(point.attendancePercent?.value)} /> },
          { key: 'attendanceChange', header: 'Изменение', align: 'right', cell: (point) => <Change value={point.attendanceChange} percent /> },
          { key: 'note', header: 'Примечание',
            cell: (point) => !point.started ? <span className="text-13 text-slate-400">Не начался</span>
              : point.performance?.preliminary ? <span className="text-13 text-amber-700">Предварительно</span> : null },
        ]}
      />
    </div>
  );
}

function Change({ value, percent = false }: { value: number | null | undefined; percent?: boolean }) {
  const change = changeDisplay(value);
  if (change.missing) return <MetricCell value={change} />;
  const Icon = change.trend === 'up' ? ArrowUpRight : change.trend === 'down' ? ArrowDownRight : Minus;
  return (
    <span className={cx('inline-flex items-center gap-1 tabular-nums',
      change.trend === 'up' ? 'text-success-fg' : change.trend === 'down' ? 'text-red-600' : 'text-slate-500')}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {change.text}{percent ? ' п.п.' : ''}
    </span>
  );
}

function percentDisplay(value: number | null | undefined): MetricDisplay {
  if (value == null) return { text: '—', hint: 'Посещаемость за период не отмечалась', missing: true };
  return { text: `${value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%`, missing: false };
}

function midpoint(start: string, end: string): string {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return new Date(a + (b - a) / 2).toISOString().slice(0, 10);
}

/** Кнопка серверной выгрузки: те же фильтры, что на экране; ошибка — тостом. */
export function ExportButton({ owner, filter, fileName }: {
  owner: ReportOwner;
  filter: ReportFilter | null;
  fileName: string;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" aria-hidden="true" />}
      loading={busy} disabled={filter == null || busy}
      onClick={async () => {
        if (!filter) return;
        setBusy(true);
        try {
          await downloadReportExcel(owner, filter, fileName);
        } catch (error) {
          toast.error(errorText(error, 'Не удалось выгрузить отчёт. Попробуйте ещё раз.'));
        } finally {
          setBusy(false);
        }
      }}>
      Excel
    </Button>
  );
}

function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 403) return 'Нет доступа к этим данным.';
  return fallback;
}
