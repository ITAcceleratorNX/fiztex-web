import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Info, Loader2, Pencil, Search } from 'lucide-react';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { cx, formatDate } from '@/lib/format';
import { isTemplateInUseError, scheduleSettingsApi } from '@/lib/scheduleSettingsApi';
import type { BellTemplate, TemplateUsage } from '@/lib/scheduleSettingsTypes';
import {
  scheduleSettingsKeys,
  useBellTemplate,
  useBellTemplates,
  useManyTemplateBindings,
  useTemplateUsage,
} from '@/platform/hooks/useScheduleSettings';
import { useQueryClient } from '@tanstack/react-query';
import { BellTemplateBindingsModal } from './BellTemplateBindingsModal';
import { LessonPeriodsEditor } from './LessonPeriodsEditor';
import { ScheduleBreadcrumbs } from './ScheduleBreadcrumbs';
import { ScheduleConfirmModal } from './ScheduleConfirmModal';
import { TemplateInUseWarning } from './TemplateInUseWarning';
import { periodsToDraft, type PeriodDraft } from './periodDraft';

/** Отложенное действие, которое ждёт подтверждения «шаблон используется». */
type PendingImpact =
  | { kind: 'add'; row: PeriodDraft }
  | { kind: 'update'; row: PeriodDraft }
  | { kind: 'delete'; row: PeriodDraft };

export function BellTemplatesTab({ yearId }: { yearId: number }) {
  const toast = useToast();
  const qc = useQueryClient();

  const templatesQuery = useBellTemplates(yearId);
  const templates = useMemo(
    () => templatesQuery.data?.content ?? [],
    [templatesQuery.data],
  );

  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<PeriodDraft[]>([]);
  const [seededFor, setSeededFor] = useState<number | null>(null);
  const [bindingsOpen, setBindingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PeriodDraft | null>(null);
  const [pendingImpact, setPendingImpact] = useState<PendingImpact | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const detailQuery = useBellTemplate(selectedId);
  const detail = detailQuery.data ?? null;
  const usageQuery = useTemplateUsage(selectedId);

  const templateIds = useMemo(() => templates.map((t) => t.id), [templates]);
  const bindingsQueries = useManyTemplateBindings(templateIds);
  const bindingNames = useMemo(() => {
    const index = templateIds.indexOf(selectedId ?? -1);
    if (index < 0) return [] as string[];
    return (bindingsQueries[index]?.data ?? []).map((b) => b.className);
  }, [templateIds, selectedId, bindingsQueries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? templates.filter((t) => t.name.toLowerCase().includes(q)) : templates;
  }, [templates, search]);

  // Первый шаблон выбирается автоматически.
  useEffect(() => {
    if (selectedId != null || templates.length === 0) return;
    setSelectedId(templates[0]!.id);
  }, [templates, selectedId]);

  // Сетка уроков приходит только из get-by-id: в списке periods=[].
  useEffect(() => {
    if (!detail || detail.id !== selectedId) return;
    if (seededFor === detail.id) return;
    setRows(periodsToDraft(detail.periods));
    setNameDraft(detail.name);
    setSeededFor(detail.id);
  }, [detail, selectedId, seededFor]);

  function selectTemplate(id: number) {
    setSelectedId(id);
    setSeededFor(null);
    setEditing(false);
    setPickerOpen(false);
  }

  async function refreshTemplate(id: number) {
    await Promise.all([
      qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplate(id) }),
      qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplates(yearId) }),
      qc.invalidateQueries({ queryKey: scheduleSettingsKeys.templateUsage(id) }),
    ]);
    setSeededFor(null);
  }

  async function runPersist(action: PendingImpact, confirmImpact: boolean) {
    if (!selectedId) return;
    setBusy(true);
    try {
      if (action.kind === 'delete') {
        if (action.row.id != null) {
          await scheduleSettingsApi.deletePeriod(selectedId, action.row.id, confirmImpact);
        }
      } else if (action.row.id == null) {
        await scheduleSettingsApi.addPeriod(selectedId, {
          lessonNumber: action.row.lessonNumber,
          startTime: action.row.startTime,
          endTime: action.row.endTime,
          sortOrder: action.row.lessonNumber,
          confirmImpact,
        });
      } else {
        await scheduleSettingsApi.updatePeriod(selectedId, action.row.id, {
          lessonNumber: action.row.lessonNumber,
          startTime: action.row.startTime,
          endTime: action.row.endTime,
          sortOrder: action.row.lessonNumber,
          confirmImpact,
        });
      }
      setPendingImpact(null);
      await refreshTemplate(selectedId);
    } catch (err) {
      if (isTemplateInUseError(err)) {
        setPendingImpact(action);
        return;
      }
      toast.error(err instanceof Error ? err.message : 'Не удалось сохранить урок');
      await refreshTemplate(selectedId);
    } finally {
      setBusy(false);
    }
  }

  function commitRow(row: PeriodDraft) {
    void runPersist({ kind: row.id == null ? 'add' : 'update', row }, false);
  }

  async function saveName() {
    if (!selectedId || !detail) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === detail.name) {
      setNameDraft(detail.name);
      return;
    }
    try {
      await scheduleSettingsApi.updateBellTemplate(selectedId, { name: trimmed });
      await refreshTemplate(selectedId);
      toast.success('Название обновлено');
    } catch (err) {
      setNameDraft(detail.name);
      toast.error(err instanceof Error ? err.message : 'Не удалось переименовать');
    }
  }

  async function createTemplate() {
    setBusy(true);
    try {
      const created = await scheduleSettingsApi.createBellTemplate({
        academicYearId: yearId,
        name: 'Новый шаблон',
      });
      await qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplates(yearId) });
      selectTemplate(created.id);
      setEditing(true);
      toast.success('Шаблон создан');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось создать шаблон');
    } finally {
      setBusy(false);
    }
  }

  async function copyTemplate() {
    if (!selectedId || !detail) return;
    setBusy(true);
    try {
      const copied = await scheduleSettingsApi.copyBellTemplate(selectedId, {
        name: `${detail.name} (копия)`,
      });
      await qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplates(yearId) });
      selectTemplate(copied.id);
      setEditing(true);
      toast.success('Создана копия шаблона');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось скопировать');
    } finally {
      setBusy(false);
    }
  }

  const noTemplates =
    !templatesQuery.isLoading && !templatesQuery.isError && templates.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <ScheduleBreadcrumbs current="Шаблоны звонков" />

      {/* 2015:8040 — dropdown-trigger-area */}
      <div className="flex flex-wrap items-start gap-4">
        <label className="relative flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-line bg-gray-50 px-2.5 py-1.5">
          <Search className="size-3.5 shrink-0 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск шаблона"
            className="w-full bg-transparent text-13 text-ink outline-none placeholder:text-gray-400"
          />
        </label>

        <div className="relative w-[236px]">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            disabled={templates.length === 0}
            className="flex w-full items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink disabled:opacity-50"
          >
            <span className="truncate">{detail?.name ?? 'Выберите шаблон'}</span>
            <ChevronDown className={cx('size-4 shrink-0 transition', pickerOpen && 'rotate-180')} />
          </button>

          {pickerOpen && filtered.length > 0 && (
            <div className="absolute z-20 mt-1 flex w-full flex-col gap-1 rounded-lg border border-line bg-white p-1 shadow-popover">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTemplate(t.id)}
                  className={cx(
                    'rounded-lg p-2 text-left text-13 font-medium transition hover:bg-gray-50',
                    t.id === selectedId ? 'text-navy-700' : 'text-ink',
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void createTemplate()}
          disabled={busy}
          className="py-2 text-sm font-semibold text-navy-700 transition hover:text-navy-800 disabled:opacity-50"
        >
          + Новый шаблон
        </button>
      </div>

      {templatesQuery.isLoading && <LoadingBlock label="Загрузка шаблонов…" />}
      {templatesQuery.isError && (
        <ErrorBlock
          message="Не удалось загрузить шаблоны"
          onRetry={() => void templatesQuery.refetch()}
        />
      )}

      {/* 2015:8052 — empty-state-card */}
      {noTemplates && (
        <div className="flex flex-col items-center justify-center gap-6 rounded-xl border border-line bg-white p-16">
          <span className="flex size-16 items-center justify-center rounded-full bg-info-bg">
            <Info className="size-6 text-navy-700" />
          </span>
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-lg font-semibold text-ink">Шаблонов пока нет</p>
            <p className="text-sm text-muted">Создайте первый шаблон для настройки расписания</p>
          </div>
          <button
            type="button"
            onClick={() => void createTemplate()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Создать шаблон
          </button>
        </div>
      )}

      {selectedId != null && !noTemplates && (
        <>
          {/* 2015:8524 — template-header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {editing ? (
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => void saveName()}
                  className="rounded-lg border border-line px-2 py-1 text-xl font-semibold text-ink outline-none focus:border-navy-700"
                />
              ) : (
                <h2 className="text-xl font-semibold text-ink">{detail?.name ?? '—'}</h2>
              )}
              {editing && <Pencil className="size-4 text-gray-400" />}

              {bindingNames.length > 0 && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-11 font-semibold text-gray-600">
                  {bindingNames.slice(0, 3).join(', ')}
                  {bindingNames.length > 3 ? ` +${bindingNames.length - 3}` : ''}
                </span>
              )}

              <StatusBadge template={detail} />

              {detail && (
                <span className="text-xs text-gray-400">
                  Обновлено {formatDate(detail.updatedAt)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <HeaderButton onClick={() => setBindingsOpen(true)}>Назначить классы</HeaderButton>
              {!editing && (
                <>
                  <HeaderButton onClick={() => void copyTemplate()} disabled={busy}>
                    Создать копию
                  </HeaderButton>
                  <HeaderButton onClick={() => setEditing(true)} icon>
                    Редактировать
                  </HeaderButton>
                </>
              )}
              {editing && <HeaderButton onClick={() => setEditing(false)}>Готово</HeaderButton>}
            </div>
          </div>

          {detailQuery.isLoading && <LoadingBlock label="Загрузка уроков…" />}

          {detail && (
            <LessonPeriodsEditor
              rows={rows}
              onChange={setRows}
              onCommitRow={commitRow}
              onRequestDelete={(row) => setDeleteTarget(row)}
              disabled={!editing || busy}
            />
          )}
        </>
      )}

      <BellTemplateBindingsModal
        open={bindingsOpen}
        onClose={() => setBindingsOpen(false)}
        yearId={yearId}
        template={detail}
        allTemplates={templates}
      />

      <TemplateInUseWarning
        open={pendingImpact != null}
        usage={(usageQuery.data as TemplateUsage | undefined) ?? null}
        loading={busy}
        onCancel={() => {
          setPendingImpact(null);
          if (selectedId) void refreshTemplate(selectedId);
        }}
        onConfirmImpact={() => {
          if (pendingImpact) void runPersist(pendingImpact, true);
        }}
        onCopy={() => {
          setPendingImpact(null);
          void copyTemplate();
        }}
      />

      <ScheduleConfirmModal
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Удалить урок?"
        message={
          deleteTarget
            ? `Урок №${deleteTarget.lessonNumber} (${deleteTarget.startTime}–${deleteTarget.endTime}) будет удалён.`
            : ''
        }
        confirmLabel="Удалить"
        danger
        loading={busy}
        onConfirm={() => {
          if (!deleteTarget) return;
          const row = deleteTarget;
          setDeleteTarget(null);
          if (row.id == null) {
            setRows((prev) => prev.filter((r) => r.key !== row.key));
            return;
          }
          void runPersist({ kind: 'delete', row }, false);
        }}
      />
    </div>
  );
}

function StatusBadge({ template }: { template: BellTemplate | null }) {
  if (!template) return null;
  return template.status === 'ACTIVE' ? (
    <span className="rounded bg-success-bg px-2 py-0.5 text-11 font-semibold text-success-fg">
      Активен
    </span>
  ) : (
    <span className="rounded bg-gray-100 px-2 py-0.5 text-11 font-semibold text-gray-600">
      Черновик
    </span>
  );
}

/** 2015:8533 — btn-secondary в шапке шаблона. */
function HeaderButton({
  onClick,
  disabled,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon?: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-13 font-semibold text-muted transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon && <Pencil className="size-3.5" />}
      {children}
    </button>
  );
}
