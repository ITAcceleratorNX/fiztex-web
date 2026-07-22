import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { cx, pluralRu } from '@/lib/format';
import {
  PERIOD_TYPE_LABELS,
  SCHOOL_STATUS_LABELS,
  YEAR_STATUS_LABELS,
} from '@/platform/labels';
import { AcademicYearFormModal } from '@/platform/modals/AcademicYearFormModal';
import { ClassFormModal } from '@/platform/modals/ClassFormModal';
import { PeriodFormModal } from '@/platform/modals/PeriodFormModal';
import {
  activateAcademicYear,
  archiveAcademicYear,
  listAcademicYears,
  listClasses,
  listPeriods,
} from '@/platform/services';
import type {
  AcademicPeriod,
  AcademicPeriodType,
  AcademicYear,
  SchoolClass,
} from '@/platform/types';

const ARCHIVE_YEARS_PREVIEW = 4;
const PERIODS_PREVIEW = 6;
const CLASSES_PAGE_SIZE = 8;

function formatDotDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** `5А` → `5 «А»` for the classes table. */
function formatClassLabel(name: string): string {
  const m = name.trim().match(/^(\d+)\s*[«"']?\s*([A-Za-zА-Яа-яЁё])\s*[»"']?/);
  if (m) return `${m[1]} «${m[2].toUpperCase()}»`;
  return name;
}

const PERIOD_TYPE_TONE: Record<AcademicPeriodType, string> = {
  QUARTER: 'bg-[#eff6ff] text-[#2563eb]',
  TRIMESTER: 'bg-[#fff7ed] text-[#d97706]',
  SEMESTER: 'bg-teal-50 text-teal-700',
  CUSTOM: 'bg-[#f5f3ff] text-[#7c3aed]',
};

function periodStatusDisplay(period: AcademicPeriod): { label: string; className: string } {
  if (period.status === 'ACTIVE') {
    return { label: 'Активна', className: 'bg-[#ecfdf5] text-[#059669]' };
  }
  if (period.status === 'ARCHIVED') {
    return { label: 'Архив', className: 'bg-[#f3f4f6] text-[#4b5563]' };
  }
  const start = period.startDate ? new Date(period.startDate) : null;
  if (start && !Number.isNaN(start.getTime()) && start.getTime() > Date.now()) {
    return { label: 'Планируется', className: 'bg-[#eff6ff] text-[#2563eb]' };
  }
  return { label: 'Отключён', className: 'bg-[#fff7ed] text-[#d97706]' };
}

function SectionHeader({ title, action }: { title: string; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[22px] font-bold tracking-tight text-[#1a1f36]">{title}</h2>
      {action}
    </div>
  );
}

function PrimaryCta({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white shadow-[0px_4px_5px_rgba(251,146,60,0.16)] transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Plus className="size-4" strokeWidth={2.5} />
      {children}
    </button>
  );
}

function OutlineCta({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1 rounded-lg border-[1.5px] border-navy-700 bg-transparent px-4 text-sm font-semibold text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Plus className="size-4" strokeWidth={2.5} />
      {children}
    </button>
  );
}

function OutlineButton({
  onClick,
  tone = 'navy',
  children,
}: {
  onClick: () => void;
  tone?: 'navy' | 'gray';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex items-center rounded-lg border-[1.5px] px-4 py-2 text-[13px] font-semibold transition',
        tone === 'navy'
          ? 'border-navy-700 text-navy-700 hover:bg-navy-50'
          : 'border-[#9ca3af] text-[#6b7280] hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}

export function DashboardPage() {
  const toast = useToast();

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [yearFormOpen, setYearFormOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [periodFormOpen, setPeriodFormOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<AcademicPeriod | null>(null);
  const [classFormOpen, setClassFormOpen] = useState(false);

  const [showAllArchiveYears, setShowAllArchiveYears] = useState(false);
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const [classesPage, setClassesPage] = useState(0);

  const activeYear = useMemo(
    () => years.find((y) => y.status === 'ACTIVE') ?? null,
    [years],
  );
  const draftYears = useMemo(() => years.filter((y) => y.status === 'DRAFT'), [years]);
  const archivedYears = useMemo(
    () => years.filter((y) => y.status === 'ARCHIVED'),
    [years],
  );

  const visibleArchived = showAllArchiveYears
    ? archivedYears
    : archivedYears.slice(0, ARCHIVE_YEARS_PREVIEW);
  const hiddenArchiveCount = Math.max(0, archivedYears.length - ARCHIVE_YEARS_PREVIEW);

  const visiblePeriods = showAllPeriods ? periods : periods.slice(0, PERIODS_PREVIEW);
  const hiddenPeriodsCount = Math.max(0, periods.length - PERIODS_PREVIEW);

  const classesTotalPages = Math.max(1, Math.ceil(classes.length / CLASSES_PAGE_SIZE));
  const visibleClasses = classes.slice(
    classesPage * CLASSES_PAGE_SIZE,
    classesPage * CLASSES_PAGE_SIZE + CLASSES_PAGE_SIZE,
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const yearList = await listAcademicYears();
      setYears(yearList);
      const focusYear =
        yearList.find((y) => y.status === 'ACTIVE') ?? yearList[0] ?? null;

      if (focusYear) {
        const [periodList, classList] = await Promise.all([
          listPeriods(focusYear.id),
          listClasses({ academicYearId: focusYear.id }),
        ]);
        setPeriods(periodList);
        setClasses(classList);
      } else {
        setPeriods([]);
        setClasses([]);
      }
      setClassesPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleArchiveYear(year: AcademicYear) {
    if (!window.confirm(`Завершить учебный год «${year.name}»? Он будет переведён в архив.`)) {
      return;
    }
    try {
      await archiveAcademicYear(year.id);
      toast.success('Учебный год завершён');
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось завершить год');
    }
  }

  async function handleActivateYear(year: AcademicYear) {
    try {
      await activateAcademicYear(year.id);
      toast.success('Учебный год активирован');
      await reload();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ANOTHER_YEAR_ACTIVE') {
        toast.error('Сначала завершите текущий активный год');
      } else {
        toast.error(err instanceof Error ? err.message : 'Не удалось активировать');
      }
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-[28px] font-bold leading-none tracking-tight text-[#1a1f36]">Главная</h1>

      {loading ? (
        <div className="rounded-2xl bg-white p-6 shadow-[0px_4px_6px_rgba(0,0,0,0.02)]">
          <LoadingBlock label="Загрузка…" />
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white p-6 shadow-[0px_4px_6px_rgba(0,0,0,0.02)]">
          <ErrorBlock message={error} onRetry={() => void reload()} />
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {/* ── Учебные годы ─────────────────────────────────────── */}
          <section className="flex flex-col gap-5">
            <SectionHeader
              title="Учебные годы"
              action={
                <PrimaryCta
                  onClick={() => {
                    setEditingYear(null);
                    setYearFormOpen(true);
                  }}
                >
                  Создать учебный год
                </PrimaryCta>
              }
            />

            {years.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 shadow-[0px_4px_6px_rgba(0,0,0,0.02)]">
                <EmptyBlock
                  title="Учебных годов пока нет"
                  description="Создайте первый учебный год, например 2026–2027."
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {activeYear ? (
                  <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-[0px_4px_6px_rgba(0,0,0,0.02)]">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h3 className="text-lg font-bold text-[#1a1f36]">{activeYear.name}</h3>
                          <span className="inline-flex items-center rounded-[20px] bg-[#ecfdf5] px-2.5 py-1 text-xs font-semibold text-[#059669]">
                            Активен
                          </span>
                        </div>
                        <p className="text-[13px] text-[#6b7280]">Активный учебный год</p>
                      </div>
                      <p className="text-[13px] text-[#6b7280]">
                        Начало: {formatDotDate(activeYear.startDate)}
                        <span className="mx-2">|</span>
                        Окончание: {formatDotDate(activeYear.endDate)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <OutlineButton
                        tone="navy"
                        onClick={() => {
                          setEditingYear(activeYear);
                          setYearFormOpen(true);
                        }}
                      >
                        Редактировать
                      </OutlineButton>
                      <OutlineButton tone="gray" onClick={() => void handleArchiveYear(activeYear)}>
                        Завершить
                      </OutlineButton>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white p-6 shadow-[0px_4px_6px_rgba(0,0,0,0.02)]">
                    <p className="text-sm text-[#6b7280]">
                      Нет активного учебного года.
                      {draftYears[0]
                        ? ' Активируйте черновик или создайте новый.'
                        : ' Создайте учебный год.'}
                    </p>
                  </div>
                )}

                {draftYears.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {draftYears.map((year) => (
                      <div
                        key={year.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#f3f4f6] bg-white p-5 shadow-[0px_2px_2px_rgba(0,0,0,0.01)]"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-base font-bold text-[#1a1f36]">{year.name}</p>
                            <span className="inline-flex items-center rounded-[20px] bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              {YEAR_STATUS_LABELS.DRAFT}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#6b7280]">
                            {formatDotDate(year.startDate)} – {formatDotDate(year.endDate)}
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingYear(year);
                              setYearFormOpen(true);
                            }}
                            className="text-[13px] font-semibold text-navy-700 hover:text-navy-800"
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleActivateYear(year)}
                            className="text-[13px] font-semibold text-brand-500 hover:text-brand-600"
                          >
                            Активировать
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {archivedYears.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {visibleArchived.map((year) => (
                        <div
                          key={year.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[#f3f4f6] bg-white p-5 shadow-[0px_2px_2px_rgba(0,0,0,0.01)]"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-bold text-[#1a1f36]">{year.name}</p>
                              <span className="inline-flex items-center rounded-[20px] bg-[#f3f4f6] px-2.5 py-1 text-xs font-semibold text-[#4b5563]">
                                Архив
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[#6b7280]">
                              {formatDotDate(year.startDate)} – {formatDotDate(year.endDate)}
                            </p>
                          </div>
                          <Link
                            to="/admin/academic-year"
                            className="shrink-0 text-[13px] font-semibold text-navy-700 hover:text-navy-800"
                          >
                            Открыть →
                          </Link>
                        </div>
                      ))}
                    </div>
                    {hiddenArchiveCount > 0 && !showAllArchiveYears && (
                      <button
                        type="button"
                        onClick={() => setShowAllArchiveYears(true)}
                        className="text-sm font-semibold text-[#6b7280] hover:text-navy-700"
                      >
                        Показать ещё {hiddenArchiveCount}{' '}
                        {pluralRu(hiddenArchiveCount, ['год', 'года', 'лет'])}
                      </button>
                    )}
                    {showAllArchiveYears && archivedYears.length > ARCHIVE_YEARS_PREVIEW && (
                      <button
                        type="button"
                        onClick={() => setShowAllArchiveYears(false)}
                        className="text-sm font-semibold text-[#6b7280] hover:text-navy-700"
                      >
                        Свернуть архив
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Периоды ──────────────────────────────────────────── */}
          <section className="flex flex-col gap-5">
            <SectionHeader
              title="Периоды"
              action={
                <OutlineCta
                  disabled={!activeYear && years.length === 0}
                  onClick={() => {
                    setEditingPeriod(null);
                    setPeriodFormOpen(true);
                  }}
                >
                  Создать период
                </OutlineCta>
              }
            />

            {!activeYear && years.length === 0 ? (
              <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.02)]">
                <EmptyBlock
                  title="Сначала создайте учебный год"
                  description="Периоды привязываются к активному учебному году."
                />
              </div>
            ) : periods.length === 0 ? (
              <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.02)]">
                <EmptyBlock
                  title="Периодов пока нет"
                  description={`Добавьте четверть или триместр для ${activeYear?.name ?? 'учебного года'}.`}
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0px_4px_12px_0px_rgba(0,0,0,0.02)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px]">
                    <thead>
                      <tr className="h-10 border-b border-[#e5e7eb] bg-[#f9fafb] text-left text-[11px] font-semibold uppercase text-[#9ca3af]">
                        <th className="w-[140px] px-6 font-semibold">Тип</th>
                        <th className="px-2 font-semibold">Название</th>
                        <th className="w-40 px-2 font-semibold">Дата начала</th>
                        <th className="w-40 px-2 font-semibold">Дата окончания</th>
                        <th className="w-[150px] px-2 font-semibold">Статус</th>
                        <th className="w-[120px] px-2 text-right font-semibold">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePeriods.map((period) => {
                        const status = periodStatusDisplay(period);
                        return (
                          <tr
                            key={period.id}
                            className="h-[52px] border-b border-[#f3f4f6] last:border-b-0"
                          >
                            <td className="px-6">
                              <span
                                className={cx(
                                  'inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold',
                                  PERIOD_TYPE_TONE[period.type],
                                )}
                              >
                                {period.type === 'CUSTOM'
                                  ? 'Кастомный'
                                  : PERIOD_TYPE_LABELS[period.type]}
                              </span>
                            </td>
                            <td className="px-2 text-sm font-semibold text-[#1a1f36]">
                              {period.name}
                            </td>
                            <td className="px-2 text-[13px] text-[#6b7280]">
                              {formatDotDate(period.startDate)}
                            </td>
                            <td className="px-2 text-[13px] text-[#6b7280]">
                              {formatDotDate(period.endDate)}
                            </td>
                            <td className="px-2">
                              <span
                                className={cx(
                                  'inline-flex items-center rounded-[20px] px-2.5 py-1 text-xs font-semibold',
                                  status.className,
                                )}
                              >
                                {status.label}
                              </span>
                            </td>
                            <td className="px-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPeriod(period);
                                  setPeriodFormOpen(true);
                                }}
                                className="text-[13px] font-semibold text-navy-700 transition hover:text-navy-800"
                              >
                                Редактировать
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {(hiddenPeriodsCount > 0 || showAllPeriods) && (
                  <div className="flex items-center justify-between border-t border-[#e5e7eb] bg-[#f9fafb] px-6 py-3">
                    {hiddenPeriodsCount > 0 && !showAllPeriods ? (
                      <button
                        type="button"
                        onClick={() => setShowAllPeriods(true)}
                        className="text-sm font-semibold text-[#6b7280] hover:text-navy-700"
                      >
                        Показать ещё {hiddenPeriodsCount}
                      </button>
                    ) : showAllPeriods && periods.length > PERIODS_PREVIEW ? (
                      <button
                        type="button"
                        onClick={() => setShowAllPeriods(false)}
                        className="text-sm font-semibold text-[#6b7280] hover:text-navy-700"
                      >
                        Свернуть
                      </button>
                    ) : (
                      <span />
                    )}
                    <Link
                      to="/admin/periods"
                      className="text-[13px] font-semibold text-navy-700 hover:text-navy-800"
                    >
                      Все периоды →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Классы ───────────────────────────────────────────── */}
          <section className="flex flex-col gap-5">
            <SectionHeader
              title="Классы"
              action={
                <PrimaryCta
                  disabled={years.length === 0}
                  onClick={() => setClassFormOpen(true)}
                >
                  Создать класс
                </PrimaryCta>
              }
            />

            {years.length === 0 ? (
              <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.02)]">
                <EmptyBlock
                  title="Сначала создайте учебный год"
                  description="Классы создаются внутри учебного года."
                />
              </div>
            ) : classes.length === 0 ? (
              <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.02)]">
                <EmptyBlock
                  title="Классов пока нет"
                  description={`Создайте класс для ${activeYear?.name ?? 'учебного года'}.`}
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0px_4px_12px_0px_rgba(0,0,0,0.02)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="h-10 border-b border-[#e5e7eb] bg-[#f9fafb] text-left text-[11px] font-semibold uppercase text-[#9ca3af]">
                        <th className="w-[180px] px-6 font-semibold">Класс</th>
                        <th className="px-2 font-semibold">Учебный год</th>
                        <th className="w-[200px] px-2 font-semibold">Кол-во учеников</th>
                        <th className="w-[180px] px-2 font-semibold">Статус</th>
                        <th className="w-[120px] px-2 text-right font-semibold">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleClasses.map((item) => (
                        <tr
                          key={item.id}
                          className="h-[52px] border-b border-[#f3f4f6] last:border-b-0"
                        >
                          <td className="px-6 text-sm font-bold text-navy-700">
                            {formatClassLabel(item.name)}
                          </td>
                          <td className="px-2 text-[13px] text-[#6b7280]">
                            {item.academicYearName}
                          </td>
                          <td className="px-2 text-[13px] text-[#6b7280]">{item.studentCount}</td>
                          <td className="px-2">
                            <span
                              className={cx(
                                'inline-flex items-center rounded-[20px] px-2.5 py-1 text-xs font-semibold',
                                item.status === 'ACTIVE'
                                  ? 'bg-[#ecfdf5] text-[#059669]'
                                  : 'bg-[#f3f4f6] text-[#4b5563]',
                              )}
                            >
                              {item.status === 'ACTIVE'
                                ? 'Активен'
                                : SCHOOL_STATUS_LABELS[item.status]}
                            </span>
                          </td>
                          <td className="px-2 text-right">
                            <Link
                              to="/admin/classes"
                              className="text-[13px] font-semibold text-navy-700 transition hover:text-navy-800"
                            >
                              Просмотреть
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-[#e5e7eb] bg-[#f9fafb] px-6 py-3 text-[13px] text-[#9ca3af]">
                  <span>
                    {classes.length === 0
                      ? '0'
                      : `${classesPage * CLASSES_PAGE_SIZE + 1}–${Math.min(
                          classes.length,
                          (classesPage + 1) * CLASSES_PAGE_SIZE,
                        )}`}{' '}
                    из {classes.length}
                  </span>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/admin/classes"
                      className="font-semibold text-navy-700 hover:text-navy-800"
                    >
                      Все классы →
                    </Link>
                    {classesTotalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={classesPage <= 0}
                          onClick={() => setClassesPage((p) => Math.max(0, p - 1))}
                          className="flex size-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:opacity-40"
                        >
                          <ChevronLeft className="size-4" />
                        </button>
                        <button
                          type="button"
                          disabled={classesPage + 1 >= classesTotalPages}
                          onClick={() => setClassesPage((p) => p + 1)}
                          className="flex size-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800 disabled:opacity-40"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      <AcademicYearFormModal
        open={yearFormOpen}
        onClose={() => setYearFormOpen(false)}
        year={editingYear}
        onSaved={() => void reload()}
      />
      <PeriodFormModal
        open={periodFormOpen}
        onClose={() => setPeriodFormOpen(false)}
        period={editingPeriod}
        years={years}
        defaultYearId={activeYear?.id}
        onSaved={() => void reload()}
      />
      <ClassFormModal
        open={classFormOpen}
        onClose={() => setClassFormOpen(false)}
        years={years}
        defaultYearId={activeYear?.id}
        onSaved={() => void reload()}
      />
    </div>
  );
}
