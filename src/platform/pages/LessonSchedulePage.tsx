import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  Copy,
  FileSpreadsheet,
  Loader2,
  Plus,
  Users,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, focusFirstInvalidField, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { lessonsApi } from '@/lib/lessonsApi';
import { scheduleSettingsApi } from '@/lib/scheduleSettingsApi';
import { subgroupsApi, teacherAvailabilityApi } from '@/lib/schedule2bApi';
import type { Weekday, WorkingDaysSource } from '@/lib/scheduleSettingsTypes';
import { cx } from '@/lib/format';
import {
  CopyScheduleModal,
  type CopyScheduleFormValues,
  type CopyStage,
} from './schedule/CopyScheduleModal';
import { EditScheduleDialog } from './schedule/EditScheduleDialog';
import { PublishConfirmDialog, type PublishStage } from './schedule/PublishConfirmDialog';
import { ScheduleConflictPanel } from './schedule/ScheduleConflictPanel';
import {
  ScheduleLessonFormModal,
  type LessonFormValues,
} from './schedule/ScheduleLessonFormModal';
import { ScheduleLegendBar, ScheduleWeeklyGrid } from './schedule/ScheduleWeeklyGrid';
import { LessonHorizonCard } from './schedule/LessonHorizonCard';
import { useScheduleOneTimeEvents } from './schedule/useScheduleOneTimeEvents';
import {
  archiveSchedule,
  checkSchedule,
  copySchedule,
  createDraftFromPublication,
  createSchedule,
  createScheduleLesson,
  deleteScheduleLesson,
  getConstructorContext,
  getSchedule,
  getScheduleGrid,
  listAcademicYears,
  listClasses,
  listPeriods,
  listScheduleHistory,
  listSchedules,
  publishSchedule,
  updateScheduleLesson,
  type ClassSchedule,
  type ConflictCheckReport,
  type ConflictFinding,
  type ConstructorContextView,
  type ScheduleGridView,
  type ScheduleHistoryRow,
  type ScheduleLesson,
  type ScheduleStatus,
} from '../services';
import type { AcademicPeriod, AcademicYear, SchoolClass } from '../types';
import { scheduleSettingsHref } from '@/lib/scheduleNavigation';
import { useScheduleNavigation } from '../hooks/useScheduleNavigation';

const SETTINGS_CARDS = [
  {
    key: 'templates',
    to: '/lesson-schedule/bell-templates',
    label: 'Шаблоны звонков',
    icon: Bell,
  },
  {
    key: 'calendar',
    to: '/lesson-schedule/calendar',
    label: 'Школьный календарь',
    icon: CalendarDays,
  },
  {
    key: 'teachers',
    to: '/lesson-schedule/teachers',
    label: 'Занятость учителей',
    icon: UserCheck,
  },
  {
    key: 'subgroups',
    to: '/lesson-schedule/subgroups',
    label: 'Подгруппы классов',
    icon: Users,
  },
  {
    key: 'import',
    to: '/lesson-schedule/import',
    label: 'Загрузка из Excel',
    icon: FileSpreadsheet,
  },
] as const;

type SettingsCardKey = (typeof SETTINGS_CARDS)[number]['key'];

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

/** Бейдж карточки настроек: раньше был константой «Настроено», теперь — реальное состояние. */
type CardStatus = { label: string; tone: 'ok' | 'warn' | 'muted' | 'loading' | 'error' };

function cardStatusForLoad(
  state: LoadState,
  ready: CardStatus,
  idle: CardStatus,
): CardStatus {
  if (state === 'loading') return { label: 'Загрузка', tone: 'loading' };
  if (state === 'error') return { label: 'Не удалось загрузить', tone: 'error' };
  return state === 'idle' ? idle : ready;
}

const CARD_STATUS_TONES: Record<CardStatus['tone'], string> = {
  ok: 'bg-success-bg text-success-fg',
  warn: 'bg-brand-50 text-brand-600',
  muted: 'bg-gray-100 text-gray-500',
  loading: 'bg-info-bg text-info-fg',
  error: 'bg-red-50 text-red-700',
};

const SCHEDULE_STATUS_TONES: Record<ScheduleStatus, string> = {
  DRAFT: 'bg-brand-50 text-brand-600',
  PUBLISHED: 'bg-success-bg text-success-fg',
  ARCHIVED: 'bg-gray-100 text-gray-500',
};

/**
 * Вытесненная публикация остаётся PUBLISHED — актуальность несёт отдельный флаг
 * `current`. Поэтому подпись считается по паре «статус + флаг», а не по статусу.
 */
function scheduleStatusLabel(schedule: ClassSchedule): string {
  if (schedule.status === 'DRAFT') return 'Черновик';
  if (schedule.status === 'ARCHIVED') return 'В архиве';
  return schedule.current ? 'Опубликовано' : 'Прошлая публикация';
}

function ScheduleStatusBadge({ schedule }: { schedule: ClassSchedule }) {
  return (
    <span
      className={cx(
        'shrink-0 rounded px-2 py-1 text-11 font-semibold',
        schedule.status === 'PUBLISHED' && !schedule.current
          ? 'bg-gray-100 text-gray-500'
          : SCHEDULE_STATUS_TONES[schedule.status],
      )}
    >
      {scheduleStatusLabel(schedule)}
    </span>
  );
}

/** Figma 2015:5831 — select в панели фильтров: gray-50, рамка, radius 8, 13px. */
const FILTER_CONTROL =
  'w-auto rounded-lg border-line bg-gray-50 px-3 py-2 text-13 font-medium text-ink';

/**
 * Кнопки панели по Figma 2015:4931 (режим редактирования) и 2015:5852 (просмотр).
 * Общая геометрия: radius 8, px 14 / py 8, 13px SemiBold, иконка 12px, gap 6.
 */
const PANEL_TONES = {
  /** btn-check 2015:4958 и btn-edit 2015:5852 — оранжевая заливка. */
  accent: 'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-300',
  /** btn-copy 2015:4956 и btn-publish 2015:4963 — серый контур. */
  muted: 'border border-line bg-white text-muted hover:bg-gray-50',
  /** Архива в макете нет — тихий вариант, чтобы не спорить с четвёркой из спеки. */
  ghost: 'text-muted hover:bg-gray-50',
} as const;

function PanelButton({
  tone = 'muted',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: keyof typeof PANEL_TONES;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-13 font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-60',
        PANEL_TONES[tone],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-3 shrink-0 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/**
 * Figma 2015:5364 — checking-central-card. В макете занимает место сетки,
 * а не накрывает её оверлеем: radius 16, p 60, круг 80 под спиннером 32.
 */
function CheckingCard() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-line bg-white p-[60px]">
      <span className="flex size-20 items-center justify-center rounded-full bg-gray-50">
        <Loader2 className="size-8 animate-spin text-navy-700" />
      </span>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xl font-bold text-ink">Проверяем расписание...</p>
        <p className="text-sm text-muted">Это может занять несколько секунд</p>
      </div>
    </div>
  );
}

export function LessonSchedulePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { context: filters, invalid, setContext: setScheduleContext, rememberContext } = useScheduleNavigation();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const yearId = filters.year ?? '';
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const periodId = filters.periodId ?? '';
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const classFilter = filters.classId ?? '';
  const [metadataYear, setMetadataYear] = useState('');
  const metadataReady = !!yearId && metadataYear === yearId;
  const selectedYearIsValid = years.some((year) => year.id === yearId);
  const filtersReady = metadataReady && filters.periodId != null && filters.classId != null
    && (!periodId || periods.some((period) => period.id === periodId))
    && (!classFilter || classes.some((schoolClass) => schoolClass.id === classFilter));
  const filterKey = `${yearId}/${periodId}/${classFilter}`;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const filterKeyRef = useRef(filterKey);
  filterKeyRef.current = filterKey;
  const selectionRef = useRef<{ filterKey: string; scheduleId: number | null }>({
    filterKey,
    scheduleId: null,
  });
  const setFilters = useCallback((patch: Partial<typeof filters>, replace = false) => {
    const next = { ...filtersRef.current, ...patch };
    filtersRef.current = next;
    const nextFilterKey = `${next.year ?? ''}/${next.periodId ?? ''}/${next.classId ?? ''}`;
    if (nextFilterKey !== filterKeyRef.current) {
      selectionRef.current = { filterKey: nextFilterKey, scheduleId: null };
    }
    filterKeyRef.current = nextFilterKey;
    setScheduleContext(patch, replace);
  }, [setScheduleContext]);
  const [loadedFilterKey, setLoadedFilterKey] = useState('');
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<ClassSchedule | null>(null);
  const [detailLoadedId, setDetailLoadedId] = useState<number | null>(null);
  const [grid, setGrid] = useState<ScheduleGridView | null>(null);
  const [history, setHistory] = useState<ScheduleHistoryRow[]>([]);
  const [context, setContext] = useState<ConstructorContextView | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: number; name: string }>>([]);
  const [conflictReport, setConflictReport] = useState<ConflictCheckReport | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [workingDaysSource, setWorkingDaysSource] = useState<WorkingDaysSource | null>(null);
  const [availability, setAvailability] = useState<{ total: number; needsReview: number } | null>(
    null,
  );
  const [groupSetCount, setGroupSetCount] = useState<number | null>(null);
  const [yearsLoading, setYearsLoading] = useState(true);
  const [yearsLoadError, setYearsLoadError] = useState(false);
  const [yearsRetry, setYearsRetry] = useState(0);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataLoadError, setMetadataLoadError] = useState(false);
  const [metadataRetry, setMetadataRetry] = useState(0);
  const [settingsSummaryState, setSettingsSummaryState] = useState<LoadState>('idle');
  const [settingsSummaryYear, setSettingsSummaryYear] = useState('');
  const [groupSetState, setGroupSetState] = useState<LoadState>('idle');
  const [groupSetClassId, setGroupSetClassId] = useState('');

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  /**
   * Экран открывается в режиме просмотра (Figma 2015:5786) — одна кнопка
   * «Редактировать». Для опубликованного расписания она сначала показывает
   * предупреждение (2015:17567), и только потом включается режим
   * редактирования с четырьмя кнопками (2015:4888).
   */
  const [editing, setEditing] = useState(false);
  const [editWarnOpen, setEditWarnOpen] = useState(false);
  /** Шаги мастера копирования и состояния публикации — см. макеты в самих компонентах. */
  const [copyStage, setCopyStage] = useState<CopyStage>('source');
  const [publishStage, setPublishStage] = useState<PublishStage>('confirm');
  const [createClassId, setCreateClassId] = useState('');
  const [createPeriodId, setCreatePeriodId] = useState('');
  const [createValidationRequest, setCreateValidationRequest] = useState(0);
  const [bellTemplateId, setBellTemplateId] = useState('');
  const createFormRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [checkPending, setCheckPending] = useState(false);
  const scheduleRequestSequence = useRef(0);
  const detailRequestSequence = useRef(0);
  const conflictRequestSequence = useRef(0);
  const previousFilterKey = useRef(filterKey);

  const scheduleListCurrent = filtersReady && !loading && loadedFilterKey === filterKey;
  const createPeriodValue = createPeriodId || periodId;
  const createClassValue = createClassId || classFilter;
  const createPeriodError = createValidationRequest > 0
    && (!createPeriodValue || !periods.some((period) => period.id === createPeriodValue))
    ? 'Выберите действующий период' : undefined;
  const createClassError = createValidationRequest > 0
    && (!createClassValue || !classes.some((schoolClass) => schoolClass.id === createClassValue))
    ? 'Выберите действующий класс' : undefined;

  useEffect(() => {
    if (createValidationRequest > 0) focusFirstInvalidField(createFormRef.current);
  }, [createValidationRequest]);
  const selectionMatchesFilters = selected != null
    && selected.academicYearId === Number(yearId)
    && (!periodId || selected.academicPeriodId === Number(periodId))
    && (!classFilter || selected.classId === Number(classFilter));
  const selectionIsCurrent = scheduleListCurrent
    && selectedId != null
    && detailLoadedId === selectedId
    && selected?.id === selectedId
    && selectionMatchesFilters
    && grid?.schedule.id === selectedId
    && context != null
    && !detailLoading
    && !detailError;
  const currentSchedule = selectionIsCurrent ? selected : null;
  const currentGrid = selectionIsCurrent ? grid : null;
  const currentHistory = selectionIsCurrent ? history : [];
  const currentContext = selectionIsCurrent ? context : null;
  const currentSelectedId = selectionIsCurrent ? selectedId : null;
  selectionRef.current = {
    filterKey,
    scheduleId: selectionIsCurrent ? selectedId : null,
  };

  function selectionRequestIsCurrent(requestFilterKey: string, scheduleId: number): boolean {
    return selectionRef.current.filterKey === requestFilterKey
      && selectionRef.current.scheduleId === scheduleId;
  }

  const [lessonMode, setLessonMode] = useState<'create' | 'edit'>('create');
  const [editingLesson, setEditingLesson] = useState<ScheduleLesson | null>(null);
  const [lockedSlot, setLockedSlot] = useState<{
    weekday: Weekday;
    lessonPeriodId: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setYearsLoading(true);
    setYearsLoadError(false);
    void listAcademicYears()
      .then((y) => {
        if (cancelled) return;
        setYears(y);
        setYearsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setYearsLoadError(true);
          setYearsLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [yearsRetry]);

  useEffect(() => {
    if (!invalid) return;
    toast.info('Некорректные параметры расписания сброшены. Выберите нужный контекст.');
    setFilters({}, true);
  }, [invalid, setFilters, toast]);

  useEffect(() => () => {
    scheduleRequestSequence.current += 1;
    detailRequestSequence.current += 1;
    conflictRequestSequence.current += 1;
  }, []);

  useEffect(() => {
    if (previousFilterKey.current === filterKey) return;
    previousFilterKey.current = filterKey;
    detailRequestSequence.current += 1;
    conflictRequestSequence.current += 1;
    setLoadedFilterKey('');
    setSchedules([]);
    setScheduleError(null);
    selectionRef.current = { filterKey, scheduleId: null };
    setSelectedId(null);
    setSelected(null);
    setDetailLoadedId(null);
    setGrid(null);
    setHistory([]);
    setContext(null);
    setDetailError(null);
    setDetailLoading(false);
    setConflictReport(null);
    setCheckPending(false);
    setEditing(false);
    setCreateOpen(false);
    setLessonOpen(false);
    setCopyOpen(false);
    setPublishOpen(false);
    setEditWarnOpen(false);
  }, [filterKey]);

  useEffect(() => {
    if (years.length === 0 || years.some((year) => year.id === yearId)) return;
    const nextYear = years.find((year) => year.status === 'ACTIVE') ?? years[0];
    if (yearId) toast.info('Выбранный учебный год недоступен. Открыт доступный учебный год.');
    setFilters({
      year: nextYear.id,
      ...(yearId ? { periodId: null, classId: null, scheduleId: null } : {}),
    }, true);
  }, [years, yearId, setFilters, toast]);

  useEffect(() => {
    if (yearsLoading || yearsLoadError || !yearId || !selectedYearIsValid) {
      setMetadataLoading(false);
      return;
    }
    let cancelled = false;
    setMetadataLoading(true);
    setMetadataLoadError(false);
    setMetadataYear('');
    setPeriods([]);
    setClasses([]);
    setTemplates([]);
    setScheduleError(null);
    void Promise.all([
      listPeriods(yearId),
      listClasses({ academicYearId: yearId }),
      scheduleSettingsApi.listBellTemplates(Number(yearId)),
    ])
      .then(([p, c, tPage]) => {
        if (cancelled) return;
        setPeriods(p);
        setClasses(c);
        setTemplates((tPage.content ?? []).map((t) => ({ id: t.id, name: t.name })));
        setMetadataYear(yearId);
        setMetadataLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setMetadataLoadError(true);
          setMetadataLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [yearId, years, yearsLoading, yearsLoadError, selectedYearIsValid, metadataRetry]);

  useEffect(() => {
    if (!metadataReady) return;
    const nextPeriod = filters.periodId === '' || periods.some((p) => p.id === filters.periodId)
      ? periodId : periods[0]?.id ?? '';
    const nextClass = filters.classId === '' || classes.some((c) => c.id === filters.classId)
      ? classFilter : classes[0]?.id ?? '';
    const unavailable = (!!periodId && nextPeriod !== periodId) || (!!classFilter && nextClass !== classFilter);
    if (unavailable) toast.info('Выбранный период или класс недоступен в этом году. Фильтры обновлены.');
    if (nextPeriod !== filters.periodId || nextClass !== filters.classId) {
      setFilters({ periodId: nextPeriod, classId: nextClass, ...(unavailable ? { scheduleId: null } : {}) }, true);
    }
    setCreatePeriodId(nextPeriod);
    setCreateClassId(nextClass);
  }, [metadataReady, periods, classes, periodId, classFilter, filters.periodId, filters.classId, setFilters, toast]);

  /**
   * Состояние карточек настроек. Отдельным запросом, а не по расписанию: бейджи
   * относятся к году целиком и должны быть честными даже до выбора класса.
   */
  useEffect(() => {
    if (yearsLoading || yearsLoadError || !yearId || !selectedYearIsValid) {
      setSettingsSummaryState('idle');
      setSettingsSummaryYear('');
      return;
    }
    const academicYearId = Number(yearId);
    let cancelled = false;
    setSettingsSummaryState('loading');
    setSettingsSummaryYear(yearId);
    setWorkingDaysSource(null);
    setAvailability(null);
    void Promise.all([
      scheduleSettingsApi.getWorkingDays(academicYearId),
      teacherAvailabilityApi.listSummaries({ academicYearId, size: 1 }),
      teacherAvailabilityApi.listSummaries({
        academicYearId,
        availability: 'NEEDS_REVIEW',
        size: 1,
      }),
    ])
      .then(([days, all, needsReview]) => {
        if (cancelled) return;
        setWorkingDaysSource(days.source);
        setAvailability({
          total: all.totalElements ?? 0,
          needsReview: needsReview.totalElements ?? 0,
        });
        setSettingsSummaryState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setWorkingDaysSource(null);
        setAvailability(null);
        setSettingsSummaryState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [yearId, years, yearsLoading, yearsLoadError, selectedYearIsValid]);

  useEffect(() => {
    setGroupSetCount(null);
    if (!filtersReady || !classFilter) {
      setGroupSetState('idle');
      setGroupSetClassId('');
      return;
    }
    let cancelled = false;
    setGroupSetState('loading');
    setGroupSetClassId(classFilter);
    void subgroupsApi
      .listGroupSets({ classId: Number(classFilter), status: 'ACTIVE' })
      .then((sets: unknown[]) => {
        if (!cancelled) {
          setGroupSetCount(sets.length);
          setGroupSetState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGroupSetCount(null);
          setGroupSetState('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [classFilter, filtersReady]);

  const reloadSchedules = useCallback(async () => {
    if (!filtersReady || filterKeyRef.current !== filterKey) return;
    const requestFilterKey = filterKey;
    const requestId = ++scheduleRequestSequence.current;
    const isCurrentRequest = () => requestId === scheduleRequestSequence.current
      && requestFilterKey === filterKeyRef.current;
    setLoading(true);
    setScheduleError(null);
    try {
      const list = await listSchedules({
        academicYearId: Number(yearId),
        academicPeriodId: periodId ? Number(periodId) : undefined,
        classId: classFilter ? Number(classFilter) : undefined,
      });
      if (!isCurrentRequest()) return;
      setSchedules(list);
      setLoadedFilterKey(requestFilterKey);
    } catch (err) {
      if (!isCurrentRequest()) return;
      setScheduleError('Не удалось загрузить расписание. Проверьте соединение и попробуйте ещё раз.');
    } finally {
      if (isCurrentRequest()) setLoading(false);
    }
  }, [yearId, periodId, classFilter, filtersReady, filterKey]);

  useEffect(() => {
    void reloadSchedules();
    return () => { scheduleRequestSequence.current += 1; };
  }, [reloadSchedules]);

  // Смена расписания возвращает экран в режим просмотра. Именно на selectedId,
  // а не в loadDetail: тот перевызывается после каждого сохранения урока.
  useEffect(() => {
    setEditing(false);
  }, [selectedId, yearId, periodId, classFilter, filters.scheduleId]);

  const loadDetail = useCallback(
    async (id: number, syncNavigation = true) => {
      if (!filtersReady || filterKeyRef.current !== filterKey) return;
      const requestFilterKey = filterKey;
      const requestId = ++detailRequestSequence.current;
      conflictRequestSequence.current += 1;
      selectionRef.current = { filterKey: requestFilterKey, scheduleId: null };
      const isCurrentRequest = () => requestId === detailRequestSequence.current
        && requestFilterKey === filterKeyRef.current;
      setSelectedId(id);
      if (syncNavigation) setFilters({ scheduleId: String(id) });
      setDetailLoading(true);
      setDetailError(null);
      setDetailLoadedId(null);
      setSelected(null);
      setGrid(null);
      setHistory([]);
      setContext(null);
      setConflictReport(null);
      try {
        const [sched, gridView, hist] = await Promise.all([
          getSchedule(id),
          getScheduleGrid(id),
          listScheduleHistory(id),
        ]);
        if (!isCurrentRequest()) return;
        const matchesFilters = sched.id === id
          && sched.academicYearId === Number(yearId)
          && (!periodId || sched.academicPeriodId === Number(periodId))
          && (!classFilter || sched.classId === Number(classFilter));
        const gridMatchesSchedule = gridView.schedule.id === sched.id
          && gridView.schedule.academicYearId === sched.academicYearId
          && gridView.schedule.academicPeriodId === sched.academicPeriodId
          && gridView.schedule.classId === sched.classId;
        if (!matchesFilters || !gridMatchesSchedule) {
          throw new Error('Ответ сервера относится к другому контексту. Повторите загрузку расписания.');
        }
        const ctx = await getConstructorContext({
          academicYearId: sched.academicYearId,
          classId: sched.classId,
          academicPeriodId: sched.academicPeriodId,
        });
        if (!isCurrentRequest()) return;
        if (ctx == null) {
          throw new Error('Контекст конструктора не загрузился. Повторите загрузку расписания.');
        }
        selectionRef.current = { filterKey: requestFilterKey, scheduleId: id };
        setSelected(sched);
        setGrid(gridView);
        setHistory(hist);
        setContext(ctx);
        setDetailLoadedId(id);
      } catch (err) {
        if (isCurrentRequest()) {
          setDetailError(err instanceof Error ? err.message : 'Не удалось открыть расписание');
        }
      } finally {
        if (isCurrentRequest()) setDetailLoading(false);
      }
    },
    [filtersReady, filterKey, yearId, periodId, classFilter, setFilters],
  );

  // Auto-pick schedule for selected year/period/class (prefer draft).
  useEffect(() => {
    // Never reject a saved version against a list from another filter context.
    if (!filtersReady || loading || pending || loadedFilterKey !== filterKey) return;
    const classId = Number(classFilter);
    const period = Number(periodId);
    const forCell = schedules.filter(
      (s) => s.classId === classId && s.academicPeriodId === period,
    );
    // Вытесненные публикации (PUBLISHED без current) сами по себе не открываются:
    // показывать вместо действующего расписания старую версию нельзя.
    const rank = (s: ClassSchedule) => {
      if (s.status === 'DRAFT') return 0;
      if (s.status === 'PUBLISHED') return s.current ? 1 : 2;
      return 3;
    };
    const requested = forCell.find((s) => String(s.id) === filters.scheduleId);
    const match = requested ?? [...forCell].sort((a, b) => rank(a) - rank(b))[0];
    const nextId = match ? String(match.id) : null;
    if (filters.scheduleId !== nextId) {
      if (filters.scheduleId) toast.info('Выбранная версия расписания недоступна. Показана доступная версия.');
      setFilters({ scheduleId: nextId }, true);
    }
    rememberContext({ ...filters, scheduleId: nextId });
    if (!match) {
      detailRequestSequence.current += 1;
      selectionRef.current = { filterKey, scheduleId: null };
      setSelected(null);
      setSelectedId(null);
      setDetailLoadedId(null);
      setGrid(null);
      setHistory([]);
      setContext(null);
      setDetailError(null);
      setDetailLoading(false);
    } else if (selectedId !== match.id || (
      detailLoadedId !== match.id && !detailLoading && !detailError
    )) {
      void loadDetail(match.id, false);
    }
  }, [schedules, periodId, classFilter, loading, pending, selectedId, loadDetail, filtersReady,
    loadedFilterKey, filterKey, filters, setFilters, rememberContext, toast, detailLoadedId,
    detailLoading, detailError]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const usePeriod = createPeriodValue;
    const useClass = createClassValue;
    const requestFilterKey = filterKey;
    if (!scheduleListCurrent || filterKeyRef.current !== requestFilterKey
      || !yearId || !usePeriod || !useClass
      || !periods.some((period) => period.id === usePeriod)
      || !classes.some((schoolClass) => schoolClass.id === useClass)) {
      setCreateValidationRequest((request) => request + 1);
      if (!yearId || !scheduleListCurrent || filterKeyRef.current !== requestFilterKey) {
        toast.error('Выберите действующий учебный год и дождитесь загрузки данных расписания');
      }
      return;
    }
    setPending(true);
    try {
      const created = await createSchedule({
        academicYearId: Number(yearId),
        academicPeriodId: Number(usePeriod),
        classId: Number(useClass),
        bellTemplateId: bellTemplateId ? Number(bellTemplateId) : null,
      });
      if (requestFilterKey !== filterKeyRef.current) return;
      toast.success('Расписание создано');
      setCreateOpen(false);
      setFilters({ periodId: usePeriod, classId: useClass, scheduleId: String(created.id) });
      await reloadSchedules();
      await loadDetail(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setPending(false);
    }
  }

  async function runConflictCheck(): Promise<ConflictCheckReport | null> {
    const scheduleId = currentSelectedId;
    if (!scheduleId) return null;
    const requestFilterKey = filterKeyRef.current;
    const requestId = ++conflictRequestSequence.current;
    const isCurrentRequest = () => requestId === conflictRequestSequence.current
      && requestFilterKey === filterKeyRef.current;
    setCheckPending(true);
    try {
      const report = await checkSchedule(scheduleId);
      if (!isCurrentRequest()) return null;
      setConflictReport(report);
      return report;
    } catch (err) {
      if (isCurrentRequest()) toast.error(err instanceof Error ? err.message : 'Ошибка проверки');
      return null;
    } finally {
      if (isCurrentRequest()) setCheckPending(false);
    }
  }

  async function handleCheck() {
    const report = await runConflictCheck();
    if (!report) return;
    if (report.summary.criticalCount === 0 && report.summary.warningCount === 0) {
      toast.success('Конфликтов нет');
    } else if (report.summary.criticalCount > 0) {
      toast.error(`Критических конфликтов: ${report.summary.criticalCount}`);
    } else {
      toast.success(`Предупреждений: ${report.summary.warningCount}`);
    }
  }

  async function handlePublishClick() {
    const report = await runConflictCheck();
    if (!report) return;
    setPublishStage('confirm');
    setPublishOpen(true);
  }

  async function handleConfirmPublish(confirmedWarningCodes: string[]) {
    const scheduleId = currentSelectedId;
    if (!scheduleId || !conflictReport) return;
    const requestFilterKey = filterKeyRef.current;
    setPending(true);
    try {
      await publishSchedule(scheduleId, {
        expectedRevision: conflictReport.draftRevision,
        confirmedWarningCodes,
      });
      if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      // Успех и отказ показываются в самой модалке (2015:17138 / 2015:17554),
      // а не тостом — так в макетах.
      setPublishStage('success');
      setConflictReport(null);
      // Расписание стало опубликованным — режим правки больше не действует.
      setEditing(false);
      await reloadSchedules();
      await loadDetail(scheduleId);
    } catch (err) {
      if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      if (err instanceof ApiError && err.details && typeof err.details === 'object') {
        const details = err.details as Partial<ConflictCheckReport>;
        if (details.criticals || details.warnings) {
          setConflictReport(details as ConflictCheckReport);
        }
      }
      setPublishStage('error');
    } finally {
      setPending(false);
    }
  }

  async function handleCreateDraft() {
    const scheduleId = currentSelectedId;
    if (!scheduleId) return;
    const requestFilterKey = filterKeyRef.current;
    setPending(true);
    try {
      const draft = await createDraftFromPublication(scheduleId);
      if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      toast.success('Черновик создан на основе публикации');
      await reloadSchedules();
      await loadDetail(draft.id);
    } catch (err) {
      if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      toast.error(err instanceof Error ? err.message : 'Не удалось создать черновик');
    } finally {
      setPending(false);
    }
  }

  /** Опубликованное расписание правится только через предупреждение (Figma 2015:17567). */
  function handleEditClick() {
    if (currentSchedule?.status === 'PUBLISHED') {
      setEditWarnOpen(true);
      return;
    }
    if (currentSchedule) setEditing(true);
  }

  /**
   * «Редактировать всё равно»: правится всегда черновик, а не публикация.
   *
   * Черновик у класса и периода может быть только один, поэтому уже существующий
   * открываем как есть — бэкенд на повторное создание отвечает конфликтом.
   */
  async function handleConfirmEdit() {
    const existingDraft = versions.find((v) => v.status === 'DRAFT');
    if (existingDraft) {
      setEditWarnOpen(false);
      await loadDetail(existingDraft.id);
      setEditing(true);
      toast.success('Открыт черновик этого расписания');
      return;
    }
    await handleCreateDraft();
    setEditWarnOpen(false);
    setEditing(true);
  }

  async function handleArchive() {
    const scheduleId = currentSelectedId;
    if (!scheduleId || !window.confirm('Архивировать расписание?')) return;
    const requestFilterKey = filterKeyRef.current;
    try {
      await archiveSchedule(scheduleId);
      if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      toast.success('Архивировано');
      selectionRef.current = { filterKey: requestFilterKey, scheduleId: null };
      setSelectedId(null);
      setFilters({ scheduleId: null }, true);
      setSelected(null);
      setGrid(null);
      await reloadSchedules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleCopy(values: CopyScheduleFormValues) {
    const scheduleId = currentSelectedId;
    if (!scheduleId) return;
    const requestFilterKey = filterKeyRef.current;
    setPending(true);
    try {
      const res = await copySchedule(scheduleId, values);
      if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      const warnMsg =
        res.warnings?.length > 0 ? ` · предупреждений: ${res.warnings.length}` : '';
      toast.success(`Скопировано уроков: ${res.copiedLessons}${warnMsg}`);
      setCopyOpen(false);
      setFilters({
        classId: values.targetClassId ? String(values.targetClassId) : classFilter,
        periodId: values.targetAcademicPeriodId ? String(values.targetAcademicPeriodId) : periodId,
        scheduleId: String(res.schedule.id),
      });
      await reloadSchedules();
      await loadDetail(res.schedule.id);
    } catch (err) {
      if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      // 409 от копирования означает «в цели уже есть уроки» — показываем
      // состояние 2015:14646 с кнопкой «Заменить» вместо тоста.
      if (err instanceof ApiError && err.status === 409) {
        setCopyStage('conflict');
      } else {
        toast.error(err instanceof Error ? err.message : 'Ошибка копирования');
      }
    } finally {
      setPending(false);
    }
  }

  function openCreateLesson(slot?: { weekday: Weekday; lessonPeriodId: number }) {
    if (!currentSelectedId) return;
    setLessonMode('create');
    setEditingLesson(null);
    setLockedSlot(slot ?? null);
    setLessonOpen(true);
  }

  /** «Перейти к слоту →» из баннера проверки открывает соответствующий урок или пустой слот. */
  function handleGoToSlot(finding: ConflictFinding) {
    if (!currentGrid || !finding.weekday || finding.lessonNumber == null) return;
    const lesson = currentGrid.lessons.find(
      (l) => l.weekday === finding.weekday && l.lessonNumber === finding.lessonNumber,
    );
    if (lesson) {
      openEditLesson(lesson);
      return;
    }
    const period = currentGrid.periods.find((p) => p.lessonNumber === finding.lessonNumber);
    if (period) {
      openCreateLesson({ weekday: finding.weekday as Weekday, lessonPeriodId: period.id });
    }
  }

  function openEditLesson(lesson: ScheduleLesson) {
    if (!currentSelectedId) return;
    setLessonMode('edit');
    setEditingLesson(lesson);
    setLockedSlot(null);
    setLessonOpen(true);
  }

  /**
   * Из слота расписания — в карточку фактического урока.
   *
   * Слот повторяется каждую неделю, а карточка всегда про конкретную дату, поэтому
   * открываем ближайший будущий урок этого слота. Если будущих не осталось (слот
   * доработал своё), показываем последний прошедший — иначе клик просто не сработал бы.
   */
  async function openActualLesson(lesson: ScheduleLesson) {
    const scheduleId = currentSelectedId;
    if (!scheduleId) return;
    const requestFilterKey = filterKeyRef.current;
    const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD в местной зоне
    try {
      const upcoming = await lessonsApi.list({
        scheduleLessonId: lesson.id,
        dateFrom: today,
        size: 1,
      });
      if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      let target = upcoming.content?.[0];
      if (!target) {
        // Список всегда идёт по возрастанию даты (клиентский sort бэкенд игнорирует),
        // поэтому последний прошедший урок — это последний элемент последней страницы.
        // Берём его через totalPages, а не выкачиванием всего слота одной страницей.
        const past = await lessonsApi.list({ scheduleLessonId: lesson.id, size: 1 });
        if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
        const lastPage = (past.totalPages ?? 0) - 1;
        target =
          lastPage > 0
            ? (await lessonsApi.list({ scheduleLessonId: lesson.id, size: 1, page: lastPage }))
                .content?.[0]
            : past.content?.[0];
        if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      }
      if (!target?.id) {
        toast.error('Для этого слота ещё нет фактических уроков');
        return;
      }
      navigate(`/lesson-schedule/lessons/${target.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось открыть урок');
    }
  }

  async function handleLessonSubmit(values: LessonFormValues) {
    const scheduleId = currentSelectedId;
    if (!scheduleId) return;
    const requestFilterKey = filterKeyRef.current;
    setPending(true);
    try {
      const payload = {
        weekday: values.weekday,
        lessonPeriodId: values.lessonPeriodId,
        subjectId: values.subjectId,
        teacherId: values.teacherId,
        targetType: values.targetType,
        subgroupId: values.subgroupId,
        room: values.room,
      };
      const result =
        lessonMode === 'edit' && editingLesson
          ? await updateScheduleLesson(scheduleId, editingLesson.id, payload)
          : await createScheduleLesson(scheduleId, payload);
      if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      if (result.warnings && result.warnings.length > 0) {
        toast.success(`Сохранено · ${result.warnings.map((w) => w.message).join('; ')}`);
      } else {
        toast.success(lessonMode === 'edit' ? 'Урок обновлён' : 'Урок добавлен');
      }
      setLessonOpen(false);
      setConflictReport(null);
      setSaveHint(`Все изменения сохранены · ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
      await loadDetail(scheduleId);
    } catch (err) {
      if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      toast.error(err instanceof Error ? err.message : 'Конфликт или ошибка');
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteLesson() {
    const scheduleId = currentSelectedId;
    if (!scheduleId || !editingLesson) return;
    if (!window.confirm('Удалить урок?')) return;
    const requestFilterKey = filterKeyRef.current;
    setPending(true);
    try {
      await deleteScheduleLesson(scheduleId, editingLesson.id);
      if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      toast.success('Урок удалён');
      setLessonOpen(false);
      setConflictReport(null);
      setSaveHint(`Все изменения сохранены · ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
      await loadDetail(scheduleId);
    } catch (err) {
      if (!selectionRequestIsCurrent(requestFilterKey, scheduleId)) return;
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setPending(false);
    }
  }

  const isDraft = currentSchedule?.status === 'DRAFT';
  const oneTimeEvents = useScheduleOneTimeEvents({
    yearId: yearId ? Number(yearId) : null,
    classId: currentSchedule ? currentSchedule.classId : null,
    // Даты есть только у действующей публикации: черновик — шаблон недели без привязки к числам.
    showOnGrid: currentSchedule?.status === 'PUBLISHED' && currentSchedule.current === true && !editing,
  });
  const periodsForForm = currentGrid?.periods ?? currentContext?.bellTemplate?.periods ?? [];
  const canPublish =
    isDraft &&
    (!conflictReport || conflictReport.summary.criticalCount === 0);

  const yearName = years.find((y) => y.id === String(currentSchedule?.academicYearId))?.name;
  const periodName = periods.find((p) => p.id === String(currentSchedule?.academicPeriodId))?.name;
  const className = classes.find((c) => c.id === String(currentSchedule?.classId))?.name;

  const publishSummary = useMemo(() => {
    if (!currentSchedule) return undefined;
    return {
      year: yearName ?? '—',
      period: periodName ?? '—',
      className: className ?? '—',
      lessonCount: currentGrid?.lessons.length ?? 0,
      publishedAt: `сегодня в ${new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
    };
  }, [currentSchedule, yearName, periodName, className, currentGrid]);

  const matchedSchedules = useMemo(() => {
    if (!scheduleListCurrent || !periodId || !classFilter) return [];
    return schedules.filter(
      (s) => s.academicYearId === Number(yearId)
        && s.classId === Number(classFilter)
        && s.academicPeriodId === Number(periodId),
    );
  }, [schedules, yearId, periodId, classFilter, scheduleListCurrent]);

  /**
   * Версии одной клетки «класс + период», между которыми есть смысл переключаться:
   * черновик и действующая публикация. Вытесненные публикации и архив — это история,
   * их в переключателе нет (иначе получаются несколько кнопок «Опубликовано»).
   */
  const versions = useMemo(
    () =>
      matchedSchedules
        .filter((s) => s.status === 'DRAFT' || (s.status === 'PUBLISHED' && s.current))
        .sort((a, b) => (a.status === 'DRAFT' ? 0 : 1) - (b.status === 'DRAFT' ? 0 : 1)),
    [matchedSchedules],
  );

  const settingsStatus: Record<SettingsCardKey, CardStatus> = useMemo(
    () => {
      const setupState: LoadState = yearsLoadError
        ? 'error'
        : yearsLoading
          ? 'loading'
          : years.length === 0
            ? 'idle'
            : !selectedYearIsValid || (!metadataReady && !metadataLoadError)
              ? 'loading'
              : metadataLoadError
                ? 'error'
                : 'ready';
      const summaryState: LoadState = yearsLoadError
        ? 'error'
        : yearsLoading
          ? 'loading'
          : years.length === 0
            ? 'idle'
            : !selectedYearIsValid || settingsSummaryYear !== yearId
              ? 'loading'
              : settingsSummaryState;
      const subgroupStatus: LoadState = yearsLoadError || metadataLoadError
        ? 'error'
        : yearsLoading
          ? 'loading'
          : years.length === 0
            ? 'idle'
            : !metadataReady || !classFilter || groupSetClassId !== classFilter
              ? (classFilter ? 'loading' : 'idle')
              : groupSetState;
      const missingYearStatus: CardStatus = { label: 'Нет учебного года', tone: 'muted' };

      return {
        templates: cardStatusForLoad(
          setupState,
          templates.length > 0
            ? { label: 'Настроено', tone: 'ok' }
            : { label: 'Нет шаблонов', tone: 'warn' },
          missingYearStatus,
        ),
        calendar: cardStatusForLoad(
          summaryState,
          workingDaysSource === 'DB'
            ? { label: 'Настроено', tone: 'ok' }
            : { label: 'По умолчанию', tone: 'muted' },
          missingYearStatus,
        ),
        teachers: cardStatusForLoad(
          summaryState,
          availability == null
            ? { label: 'Нет данных', tone: 'muted' }
            : availability.total === 0
              ? { label: 'Нет учителей', tone: 'warn' }
              : availability.needsReview > 0
                ? { label: `Требуют проверки: ${availability.needsReview}`, tone: 'warn' }
                : { label: 'Настроено', tone: 'ok' },
          missingYearStatus,
        ),
        subgroups: cardStatusForLoad(
          subgroupStatus,
          groupSetCount == null
            ? { label: 'Не удалось загрузить', tone: 'error' }
            : groupSetCount > 0
              ? { label: `Наборов: ${groupSetCount}`, tone: 'ok' }
              : { label: 'Не заданы', tone: 'muted' },
          years.length === 0 && !yearsLoading && !yearsLoadError
            ? missingYearStatus
            : { label: 'Выберите класс', tone: 'muted' },
        ),
        // У импорта нет состояния «настроено»: это действие, а не настройка.
        import: { label: 'Файл .xlsx', tone: 'muted' },
      };
    },
    [
      yearsLoadError,
      yearsLoading,
      years.length,
      selectedYearIsValid,
      metadataReady,
      metadataLoadError,
      settingsSummaryYear,
      yearId,
      settingsSummaryState,
      classFilter,
      groupSetClassId,
      groupSetState,
      templates,
      workingDaysSource,
      availability,
      groupSetCount,
    ],
  );

  return (
    <div className="relative space-y-5">
      {/* Figma 2015:5790 — settings-block-container: заголовок 14px Bold, карточки 42px */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-ink">Настройки расписания</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SETTINGS_CARDS.map((card) => {
            const Icon = card.icon;
            const status = settingsStatus[card.key];
            return (
              <Link
                key={card.to}
                to={scheduleSettingsHref(card.to, filters)}
                className="flex items-center justify-between gap-2.5 rounded-lg border border-line bg-white p-3 transition hover:border-navy-700"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon className="size-4 shrink-0 text-navy-700" />
                  <span className="truncate text-13 font-semibold text-ink">{card.label}</span>
                </span>
                <span
                  className={cx(
                    'shrink-0 rounded px-2 py-0.5 text-11 font-semibold',
                    CARD_STATUS_TONES[status.tone],
                  )}
                >
                  {status.label}
                </span>
              </Link>
            );
          })}
          {/* Пятая карточка — не ссылка: горизонт правится тут же, отдельного экрана
              у одной настройки быть не должно. */}
          <LessonHorizonCard academicYearId={yearId ? Number(yearId) : null} />
        </div>
      </section>

      {/* Figma 2015:5829 — top-control-panel: radius 12, p 16, тень 0 4px 6px /.03 */}
      <section className="rounded-xl bg-white p-4 shadow-panel">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <Select
              value={yearId}
              onChange={(e) => setFilters({ year: e.target.value, periodId: null, classId: null, scheduleId: null })}
              disabled={yearsLoading || yearsLoadError || years.length === 0}
              className={FILTER_CONTROL}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
            <Select
              value={periodId}
              onChange={(e) => setFilters({ periodId: e.target.value, scheduleId: null })}
              disabled={!metadataReady}
              className={FILTER_CONTROL}
            >
              <option value="">Период</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select
              value={classFilter}
              onChange={(e) => setFilters({ classId: e.target.value, scheduleId: null })}
              disabled={!metadataReady}
              className={FILTER_CONTROL}
            >
              <option value="">Класс</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <div className="rounded-lg border border-line bg-gray-50 px-3 py-2 text-13 font-medium text-ink">
              {currentSchedule?.bellTemplateName ?? 'Шаблон звонков'}
            </div>

            {/* Статус открытой версии: без него черновик и публикация выглядят одинаково. */}
            {currentSchedule && <ScheduleStatusBadge schedule={currentSchedule} />}

            {/* Черновик и публикация класса существуют одновременно — даём переключиться. */}
            {versions.length > 1 && (
              <div className="flex items-center gap-1 rounded-lg border border-line bg-gray-50 p-[3px]">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => {
                      if (version.id !== selectedId) void loadDetail(version.id);
                    }}
                    className={cx(
                      'rounded-md px-2.5 py-1 text-11 font-semibold transition',
                      version.id === selectedId
                        ? 'bg-white text-navy-700 shadow-[0_1px_1px_rgba(0,0,0,0.04)]'
                        : 'text-muted hover:text-navy-700',
                    )}
                  >
                    {scheduleStatusLabel(version)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Просмотр — одна кнопка (2015:5852). Редактирование — четыре (2015:4953). */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {yearId && !editing && (
              <PanelButton
                tone="muted"
                icon={<CalendarPlus className="size-3 shrink-0" />}
                onClick={oneTimeEvents.openCreate}
              >
                Разовое событие
              </PanelButton>
            )}
            {!currentSchedule && scheduleListCurrent && periodId && classFilter && (
              <PanelButton
                tone="accent"
                icon={<Plus className="size-3 shrink-0" />}
                onClick={() => {
                  setCreateClassId(classFilter);
                  setCreatePeriodId(periodId);
                  setCreateOpen(true);
                }}
              >
                Создать
              </PanelButton>
            )}

            {currentSchedule && currentSchedule.status !== 'ARCHIVED' && !editing && (
              <PanelButton tone="accent" loading={pending} onClick={handleEditClick}>
                Редактировать
              </PanelButton>
            )}

            {currentSchedule && editing && (
              <>
                <PanelButton
                  tone="muted"
                  icon={<Copy className="size-3 shrink-0" />}
                  onClick={() => {
                    setCopyStage('source');
                    setCopyOpen(true);
                  }}
                >
                  Копировать
                </PanelButton>
                <PanelButton
                  tone="accent"
                  loading={checkPending}
                  icon={<Check className="size-3 shrink-0" />}
                  onClick={() => void handleCheck()}
                >
                  Проверить
                </PanelButton>
                <PanelButton
                  tone="muted"
                  disabled={!canPublish || checkPending}
                  onClick={() => void handlePublishClick()}
                >
                  Опубликовать
                </PanelButton>
                {/* Архива в макете нет, но это единственный доступ к архивации. */}
                <PanelButton tone="ghost" onClick={() => void handleArchive()}>
                  Архив
                </PanelButton>
              </>
            )}
          </div>
        </div>
      </section>

      {saveHint && (
        <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          {saveHint}
        </div>
      )}

      {yearsLoading && <LoadingBlock label="Загружаем учебные годы..." />}
      {!yearsLoading && yearsLoadError && (
        <ErrorBlock
          message="Не удалось загрузить учебные годы. Проверьте соединение и попробуйте ещё раз."
          onRetry={() => {
            setYearsLoadError(false);
            setYearsLoading(true);
            setYearsRetry((attempt) => attempt + 1);
          }}
        />
      )}
      {!yearsLoading && !yearsLoadError && years.length === 0 && (
        <div className="card">
          <EmptyBlock
            title="Учебные годы не найдены"
            description="Создайте учебный год, чтобы настроить расписание школы."
            action={(
              <Link
                to="/admin/academic-year"
                className="inline-flex h-10 items-center rounded-xl bg-navy-700 px-4 text-sm font-semibold text-white hover:bg-navy-800"
              >
                Открыть учебные годы
              </Link>
            )}
          />
        </div>
      )}
      {!yearsLoading && !yearsLoadError && years.length > 0 && !metadataReady && !metadataLoadError && (
        <LoadingBlock label={metadataLoading ? 'Загружаем настройки расписания...' : 'Подготавливаем расписание...'} />
      )}
      {!yearsLoading && !yearsLoadError && metadataLoadError && (
        <ErrorBlock
          message="Не удалось загрузить периоды, классы и шаблоны звонков. Проверьте соединение и попробуйте ещё раз."
          onRetry={() => {
            setMetadataLoadError(false);
            setMetadataLoading(true);
            setMetadataRetry((attempt) => attempt + 1);
          }}
        />
      )}
      {metadataReady && !filtersReady && !metadataLoadError && (
        <LoadingBlock label="Подготавливаем фильтры расписания..." />
      )}
      {filtersReady && loading && <LoadingBlock label="Загружаем расписания..." />}
      {filtersReady && scheduleError && !loading && (
        <ErrorBlock message={scheduleError} onRetry={() => void reloadSchedules()} />
      )}

      {filtersReady && !loading && loadedFilterKey === filterKey && !scheduleError && (
        <>
          <ScheduleConflictPanel
            report={conflictReport}
            periods={currentGrid?.periods}
            className={className}
            onGoToSlot={handleGoToSlot}
          />

          <ScheduleLegendBar />
          {currentGrid && currentGrid.periods.length > 0 && oneTimeEvents.weekBar}

          {checkPending ? (
            <CheckingCard />
          ) : detailLoading ? (
            <LoadingBlock />
          ) : detailError ? (
            <ErrorBlock message={detailError} onRetry={() => {
              if (selectedId != null) void loadDetail(selectedId);
            }} />
          ) : !currentSchedule ? (
            <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
              <EmptyBlock
                title={
                  periodId && classFilter
                    ? 'Расписание ещё не создано'
                    : 'Выберите период и класс'
                }
                description={
                  periodId && classFilter
                    ? 'Создайте черновик для выбранного класса и периода.'
                    : 'Укажите учебный год, период и класс в панели выше.'
                }
              />
              {scheduleListCurrent && periodId && classFilter && matchedSchedules.length === 0 && (
                <Button
                  className="mt-4"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => {
                    setCreateClassId(classFilter);
                    setCreatePeriodId(periodId);
                    setCreateOpen(true);
                  }}
                >
                  Создать расписание
                </Button>
              )}
            </div>
          ) : !currentGrid || currentGrid.periods.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-14 text-center">
              <h3 className="text-lg font-semibold text-navy-900">
                Сначала назначьте шаблон звонков для этого класса
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                Шаблон звонков определяет количество уроков и их время. Без него невозможно
                построить расписание.
              </p>
              <Link
                to={scheduleSettingsHref('/lesson-schedule/bell-templates', filters)}
                className="mt-5 inline-flex h-10 items-center rounded-xl bg-navy-700 px-4 text-sm font-semibold text-white hover:bg-navy-800"
              >
                Перейти к шаблонам
              </Link>
            </div>
          ) : (
            <ScheduleWeeklyGrid
              grid={currentGrid}
              readOnly={!(isDraft && editing)}
              criticals={conflictReport?.criticals}
              warnings={conflictReport?.warnings}
              onAddSlot={(weekday, periodIdSlot) =>
                openCreateLesson({ weekday, lessonPeriodId: periodIdSlot })
              }
              onEditLesson={openEditLesson}
              onOpenLesson={openActualLesson}
              {...oneTimeEvents.gridProps}
            />
          )}

          {currentSchedule && currentHistory.length > 0 && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer select-none font-medium text-slate-600">
                История изменений
              </summary>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {currentHistory.map((h) => (
                  <li key={h.id}>
                    {h.actionType} · {h.createdAt}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <Modal
        open={createOpen && metadataReady && scheduleListCurrent}
        onClose={() => setCreateOpen(false)}
        title="Создать расписание"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} loading={pending}>
              Создать
            </Button>
          </>
        }
      >
        <form ref={createFormRef} onSubmit={handleCreate} className="space-y-3">
          <Field label="Класс" required error={createClassError}>
            <Select
              value={createClassId}
              onChange={(e) => setCreateClassId(e.target.value)}
              required
            >
              <option value="">Выберите</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Период" required error={createPeriodError}>
            <Select
              value={createPeriodId}
              onChange={(e) => setCreatePeriodId(e.target.value)}
              required
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Шаблон звонков">
            <Select value={bellTemplateId} onChange={(e) => setBellTemplateId(e.target.value)}>
              <option value="">По умолчанию класса</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Modal>

      <ScheduleLessonFormModal
        open={lessonOpen && selectionIsCurrent}
        onClose={() => setLessonOpen(false)}
        onSubmit={handleLessonSubmit}
        onDelete={lessonMode === 'edit' ? handleDeleteLesson : undefined}
        pending={pending}
        mode={lessonMode}
        initial={editingLesson}
        lockedSlot={lockedSlot}
        periods={periodsForForm}
        context={currentContext}
        weekdays={currentGrid?.weekdays}
      />

      {currentSchedule && (
        <CopyScheduleModal
          open={copyOpen && selectionIsCurrent}
          stage={copyStage}
          onStageChange={setCopyStage}
          onClose={() => setCopyOpen(false)}
          onSubmit={handleCopy}
          pending={pending}
          periods={metadataReady ? periods : []}
          classes={metadataReady ? classes : []}
          templates={templates}
          sourceClassId={currentSchedule.classId}
          sourceGroupSets={currentContext?.groupSets ?? []}
          sourceYearName={yearName}
          sourcePeriodName={periodName}
          sourceClassName={className}
        />
      )}

      <EditScheduleDialog
        open={editWarnOpen && selectionIsCurrent}
        className={classes.find((c) => c.id === String(currentSchedule?.classId))?.name}
        pending={pending}
        onClose={() => setEditWarnOpen(false)}
        onConfirm={() => void handleConfirmEdit()}
      />

      <PublishConfirmDialog
        open={publishOpen && selectionIsCurrent}
        stage={publishStage}
        report={conflictReport}
        summary={publishSummary}
        loading={pending}
        onClose={() => setPublishOpen(false)}
        onConfirm={(codes) => void handleConfirmPublish(codes)}
        // «Повторить» возвращает к подтверждению, а не публикует сразу:
        // при наличии предупреждений их нужно подтвердить заново чекбоксом.
        onRetry={() => setPublishStage('confirm')}
      />

      {oneTimeEvents.modals}
    </div>
  );
}
