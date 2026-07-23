import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  Check,
  Copy,
  Loader2,
  Plus,
  Save,
  Users,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { scheduleSettingsApi } from '@/lib/scheduleSettingsApi';
import type { Weekday } from '@/lib/scheduleSettingsTypes';
import { CopyScheduleModal, type CopyScheduleFormValues } from './schedule/CopyScheduleModal';
import { PublishConfirmDialog } from './schedule/PublishConfirmDialog';
import { ScheduleConflictPanel } from './schedule/ScheduleConflictPanel';
import {
  ScheduleLessonFormModal,
  type LessonFormValues,
} from './schedule/ScheduleLessonFormModal';
import { ScheduleLegendBar, ScheduleWeeklyGrid } from './schedule/ScheduleWeeklyGrid';
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
  type ConstructorContextView,
  type ScheduleGridView,
  type ScheduleHistoryRow,
  type ScheduleLesson,
} from '../services';
import type { AcademicPeriod, AcademicYear, SchoolClass } from '../types';

const SETTINGS_CARDS = [
  {
    to: '/admin/schedule-settings?tab=templates',
    label: 'Шаблоны звонков',
    icon: Bell,
  },
  {
    to: '/admin/schedule-settings?tab=calendar',
    label: 'Школьный календарь',
    icon: CalendarDays,
  },
  {
    to: '/admin/schedule-settings?tab=teachers',
    label: 'Занятость учителей',
    icon: UserCheck,
  },
  {
    to: '/admin/schedule-settings?tab=subgroups',
    label: 'Подгруппы классов',
    icon: Users,
  },
] as const;

export function LessonSchedulePage() {
  const toast = useToast();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [schedules, setSchedules] = useState<ClassSchedule[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<ClassSchedule | null>(null);
  const [grid, setGrid] = useState<ScheduleGridView | null>(null);
  const [history, setHistory] = useState<ScheduleHistoryRow[]>([]);
  const [context, setContext] = useState<ConstructorContextView | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: number; name: string }>>([]);
  const [conflictReport, setConflictReport] = useState<ConflictCheckReport | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [createClassId, setCreateClassId] = useState('');
  const [createPeriodId, setCreatePeriodId] = useState('');
  const [bellTemplateId, setBellTemplateId] = useState('');
  const [pending, setPending] = useState(false);
  const [checkPending, setCheckPending] = useState(false);

  const [lessonMode, setLessonMode] = useState<'create' | 'edit'>('create');
  const [editingLesson, setEditingLesson] = useState<ScheduleLesson | null>(null);
  const [lockedSlot, setLockedSlot] = useState<{
    weekday: Weekday;
    lessonPeriodId: number;
  } | null>(null);

  useEffect(() => {
    void listAcademicYears()
      .then((y) => {
        setYears(y);
        const active = y.find((item) => item.status === 'ACTIVE') ?? y[0];
        if (active) setYearId(active.id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка загрузки'));
  }, []);

  useEffect(() => {
    if (!yearId) return;
    void Promise.all([
      listPeriods(yearId),
      listClasses({ academicYearId: yearId }),
      scheduleSettingsApi.listBellTemplates(Number(yearId)),
    ])
      .then(([p, c, tPage]) => {
        setPeriods(p);
        setClasses(c);
        setTemplates((tPage.content ?? []).map((t) => ({ id: t.id, name: t.name })));
        if (p[0]) {
          setPeriodId((prev) => prev || p[0].id);
          setCreatePeriodId((prev) => prev || p[0].id);
        }
        if (c[0]) {
          setClassFilter((prev) => prev || c[0].id);
          setCreateClassId((prev) => prev || c[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ошибка метаданных'));
  }, [yearId]);

  const reloadSchedules = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listSchedules({
        academicYearId: Number(yearId),
        academicPeriodId: periodId ? Number(periodId) : undefined,
        classId: classFilter ? Number(classFilter) : undefined,
      });
      setSchedules(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить расписания');
    } finally {
      setLoading(false);
    }
  }, [yearId, periodId, classFilter]);

  useEffect(() => {
    void reloadSchedules();
  }, [reloadSchedules]);

  const loadDetail = useCallback(
    async (id: number) => {
      setSelectedId(id);
      setDetailLoading(true);
      setConflictReport(null);
      try {
        const [sched, gridView, hist] = await Promise.all([
          getSchedule(id),
          getScheduleGrid(id),
          listScheduleHistory(id),
        ]);
        setSelected(sched);
        setGrid(gridView);
        setHistory(hist);
        const ctx = await getConstructorContext({
          academicYearId: sched.academicYearId,
          classId: sched.classId,
          academicPeriodId: sched.academicPeriodId,
        });
        setContext(ctx);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Не удалось открыть расписание');
      } finally {
        setDetailLoading(false);
      }
    },
    [toast],
  );

  // Auto-pick schedule for selected year/period/class (prefer draft).
  useEffect(() => {
    if (!periodId || !classFilter || schedules.length === 0) {
      if (!loading && periodId && classFilter && schedules.length === 0) {
        setSelected(null);
        setSelectedId(null);
        setGrid(null);
      }
      return;
    }
    const classId = Number(classFilter);
    const period = Number(periodId);
    const match = schedules
      .filter((s) => s.classId === classId && s.academicPeriodId === period)
      .sort((a, b) => {
        const rank = (s: ClassSchedule) =>
          s.status === 'DRAFT' ? 0 : s.status === 'PUBLISHED' ? 1 : 2;
        return rank(a) - rank(b);
      })[0];
    if (match && match.id !== selectedId) {
      void loadDetail(match.id);
    }
  }, [schedules, periodId, classFilter, loading, selectedId, loadDetail]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const usePeriod = createPeriodId || periodId;
    const useClass = createClassId || classFilter;
    if (!yearId || !usePeriod || !useClass) {
      toast.error('Выберите год, период и класс');
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
      toast.success('Расписание создано');
      setCreateOpen(false);
      setPeriodId(usePeriod);
      setClassFilter(useClass);
      await reloadSchedules();
      await loadDetail(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setPending(false);
    }
  }

  async function runConflictCheck(): Promise<ConflictCheckReport | null> {
    if (!selectedId) return null;
    setCheckPending(true);
    try {
      const report = await checkSchedule(selectedId);
      setConflictReport(report);
      return report;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка проверки');
      return null;
    } finally {
      setCheckPending(false);
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
    setPublishOpen(true);
  }

  async function handleConfirmPublish(confirmedWarningCodes: string[]) {
    if (!selectedId || !conflictReport) return;
    setPending(true);
    try {
      await publishSchedule(selectedId, {
        expectedRevision: conflictReport.draftRevision,
        confirmedWarningCodes,
      });
      toast.success('Расписание опубликовано');
      setPublishOpen(false);
      setConflictReport(null);
      await reloadSchedules();
      await loadDetail(selectedId);
    } catch (err) {
      if (err instanceof ApiError && err.details && typeof err.details === 'object') {
        const details = err.details as Partial<ConflictCheckReport>;
        if (details.criticals || details.warnings) {
          setConflictReport(details as ConflictCheckReport);
        }
      }
      toast.error(err instanceof Error ? err.message : 'Ошибка публикации');
    } finally {
      setPending(false);
    }
  }

  async function handleCreateDraft() {
    if (!selectedId) return;
    setPending(true);
    try {
      const draft = await createDraftFromPublication(selectedId);
      toast.success('Черновик создан на основе публикации');
      await reloadSchedules();
      await loadDetail(draft.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось создать черновик');
    } finally {
      setPending(false);
    }
  }

  async function handleArchive() {
    if (!selectedId || !window.confirm('Архивировать расписание?')) return;
    try {
      await archiveSchedule(selectedId);
      toast.success('Архивировано');
      setSelectedId(null);
      setSelected(null);
      setGrid(null);
      await reloadSchedules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function handleCopy(values: CopyScheduleFormValues) {
    if (!selectedId) return;
    setPending(true);
    try {
      const res = await copySchedule(selectedId, values);
      const warnMsg =
        res.warnings?.length > 0 ? ` · предупреждений: ${res.warnings.length}` : '';
      toast.success(`Скопировано уроков: ${res.copiedLessons}${warnMsg}`);
      setCopyOpen(false);
      if (values.targetClassId) setClassFilter(String(values.targetClassId));
      if (values.targetAcademicPeriodId) setPeriodId(String(values.targetAcademicPeriodId));
      await reloadSchedules();
      await loadDetail(res.schedule.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка копирования');
    } finally {
      setPending(false);
    }
  }

  function openCreateLesson(slot?: { weekday: Weekday; lessonPeriodId: number }) {
    setLessonMode('create');
    setEditingLesson(null);
    setLockedSlot(slot ?? null);
    setLessonOpen(true);
  }

  function openEditLesson(lesson: ScheduleLesson) {
    setLessonMode('edit');
    setEditingLesson(lesson);
    setLockedSlot(null);
    setLessonOpen(true);
  }

  async function handleLessonSubmit(values: LessonFormValues) {
    if (!selectedId) return;
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
          ? await updateScheduleLesson(selectedId, editingLesson.id, payload)
          : await createScheduleLesson(selectedId, payload);
      if (result.warnings && result.warnings.length > 0) {
        toast.success(`Сохранено · ${result.warnings.map((w) => w.message).join('; ')}`);
      } else {
        toast.success(lessonMode === 'edit' ? 'Урок обновлён' : 'Урок добавлен');
      }
      setLessonOpen(false);
      setConflictReport(null);
      setSaveHint(`Все изменения сохранены · ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
      await loadDetail(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Конфликт или ошибка');
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteLesson() {
    if (!selectedId || !editingLesson) return;
    if (!window.confirm('Удалить урок?')) return;
    setPending(true);
    try {
      await deleteScheduleLesson(selectedId, editingLesson.id);
      toast.success('Урок удалён');
      setLessonOpen(false);
      setConflictReport(null);
      setSaveHint(`Все изменения сохранены · ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
      await loadDetail(selectedId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setPending(false);
    }
  }

  function handleSaveDraftClick() {
    if (!selectedId) return;
    void loadDetail(selectedId).then(() => {
      setSaveHint(
        `Все изменения сохранены · ${new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
        })}`,
      );
      toast.success('Черновик актуален');
    });
  }

  const isDraft = selected?.status === 'DRAFT';
  const isPublished = selected?.status === 'PUBLISHED';
  const periodsForForm = grid?.periods ?? context?.bellTemplate?.periods ?? [];
  const canPublish =
    isDraft &&
    (!conflictReport || conflictReport.summary.criticalCount === 0);

  const matchedSchedules = useMemo(() => {
    if (!periodId || !classFilter) return schedules;
    return schedules.filter(
      (s) => s.classId === Number(classFilter) && s.academicPeriodId === Number(periodId),
    );
  }, [schedules, periodId, classFilter]);

  return (
    <div className="relative space-y-5">
      {/* Settings cards — Figma: settings-block-container */}
      <section>
        <h2 className="mb-2.5 text-sm font-semibold text-navy-900">Настройки расписания</h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {SETTINGS_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.to}
                to={card.to}
                className="flex items-center gap-3 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-slate-200/80 transition hover:ring-brand-300"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-navy-900">
                    {card.label}
                  </span>
                </span>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Настроено
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Top control panel */}
      <section className="rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
              className="h-9 min-w-[9rem] rounded-lg border-slate-200 bg-slate-50 text-sm"
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
            <Select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="h-9 min-w-[8rem] rounded-lg border-slate-200 bg-slate-50 text-sm"
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
              onChange={(e) => setClassFilter(e.target.value)}
              className="h-9 min-w-[7rem] rounded-lg border-slate-200 bg-slate-50 text-sm"
            >
              <option value="">Класс</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
              {selected?.bellTemplateName ?? 'Шаблон звонков'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!selected && periodId && classFilter && (
              <Button
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setCreateClassId(classFilter);
                  setCreatePeriodId(periodId);
                  setCreateOpen(true);
                }}
              >
                Создать
              </Button>
            )}
            {isDraft && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Save className="h-4 w-4" />}
                onClick={handleSaveDraftClick}
                className="text-navy-700 ring-navy-200"
              >
                Сохранить черновик
              </Button>
            )}
            {selected && selected.status !== 'ARCHIVED' && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => setCopyOpen(true)}
              >
                Копировать
              </Button>
            )}
            {isDraft && (
              <Button
                size="sm"
                loading={checkPending}
                icon={!checkPending ? <Check className="h-4 w-4" /> : undefined}
                onClick={() => void handleCheck()}
              >
                Проверить
              </Button>
            )}
            {isDraft && (
              <Button
                variant="secondary"
                size="sm"
                disabled={!canPublish || checkPending}
                loading={checkPending && publishOpen}
                onClick={() => void handlePublishClick()}
                className={!canPublish ? 'opacity-50' : ''}
              >
                Опубликовать
              </Button>
            )}
            {isPublished && (
              <Button
                variant="secondary"
                size="sm"
                loading={pending}
                onClick={() => void handleCreateDraft()}
              >
                Новый черновик
              </Button>
            )}
            {selected && selected.status !== 'ARCHIVED' && (
              <Button variant="ghost" size="sm" onClick={() => void handleArchive()}>
                Архив
              </Button>
            )}
          </div>
        </div>
      </section>

      {saveHint && (
        <div className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          {saveHint}
        </div>
      )}

      {loading && <LoadingBlock />}
      {error && !loading && <ErrorBlock message={error} onRetry={() => void reloadSchedules()} />}

      {!loading && !error && (
        <>
          <ScheduleConflictPanel
            report={conflictReport}
            onClear={() => setConflictReport(null)}
          />

          <ScheduleLegendBar />

          {detailLoading ? (
            <LoadingBlock />
          ) : !selected ? (
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
              {periodId && classFilter && matchedSchedules.length === 0 && (
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
          ) : !grid || grid.periods.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-14 text-center">
              <h3 className="text-lg font-semibold text-navy-900">
                Сначала назначьте шаблон звонков для этого класса
              </h3>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                Шаблон звонков определяет количество уроков и их время. Без него невозможно
                построить расписание.
              </p>
              <Link
                to="/admin/schedule-settings?tab=templates"
                className="mt-5 inline-flex h-10 items-center rounded-xl bg-navy-700 px-4 text-sm font-semibold text-white hover:bg-navy-800"
              >
                Перейти к шаблонам
              </Link>
            </div>
          ) : (
            <ScheduleWeeklyGrid
              grid={grid}
              readOnly={!isDraft}
              criticals={conflictReport?.criticals}
              warnings={conflictReport?.warnings}
              onAddSlot={(weekday, periodIdSlot) =>
                openCreateLesson({ weekday, lessonPeriodId: periodIdSlot })
              }
              onEditLesson={openEditLesson}
            />
          )}

          {selected && history.length > 0 && (
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer select-none font-medium text-slate-600">
                История изменений
              </summary>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {history.map((h) => (
                  <li key={h.id}>
                    {h.actionType} · {h.createdAt}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {/* Checking overlay — Figma: checking-central-card */}
      {checkPending && (
        <div className="absolute inset-0 z-20 flex items-start justify-center bg-slate-100/70 pt-40 backdrop-blur-[1px]">
          <div className="flex w-full max-w-md flex-col items-center rounded-2xl bg-white px-8 py-10 shadow-pop ring-1 ring-slate-200">
            <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
            <p className="mt-4 text-lg font-semibold text-navy-900">Проверяем расписание…</p>
            <p className="mt-1 text-sm text-slate-500">Это может занять несколько секунд</p>
          </div>
        </div>
      )}

      <Modal
        open={createOpen}
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
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Класс" required>
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
          <Field label="Период" required>
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
        open={lessonOpen}
        onClose={() => setLessonOpen(false)}
        onSubmit={handleLessonSubmit}
        onDelete={lessonMode === 'edit' ? handleDeleteLesson : undefined}
        pending={pending}
        mode={lessonMode}
        initial={editingLesson}
        lockedSlot={lockedSlot}
        periods={periodsForForm}
        context={context}
        weekdays={grid?.weekdays}
      />

      {selected && (
        <CopyScheduleModal
          open={copyOpen}
          onClose={() => setCopyOpen(false)}
          onSubmit={handleCopy}
          pending={pending}
          periods={periods}
          classes={classes}
          templates={templates}
          sourceClassId={selected.classId}
          sourceGroupSets={context?.groupSets ?? []}
        />
      )}

      <PublishConfirmDialog
        open={publishOpen}
        report={conflictReport}
        loading={pending}
        onClose={() => setPublishOpen(false)}
        onConfirm={(codes) => void handleConfirmPublish(codes)}
      />
    </div>
  );
}
