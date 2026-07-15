import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, TextInput, TextArea } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { isTemplateInUseError, scheduleSettingsApi } from '@/lib/scheduleSettingsApi';
import type { BellTemplate, ScheduleSettingsAction } from '@/lib/scheduleSettingsTypes';
import {
  scheduleSettingsKeys,
  useBellTemplate,
  useSettingsHistory,
  useTemplateUsage,
} from '@/platform/hooks/useScheduleSettings';
import { useQueryClient } from '@tanstack/react-query';
import { LessonPeriodsEditor } from './LessonPeriodsEditor';
import { TemplateInUseDialog } from './TemplateInUseDialog';
import {
  diffPeriods,
  emptyPeriodDraft,
  periodsToDraft,
  validatePeriodDrafts,
  type PeriodDraft,
} from './periodDraft';
import { formatHistoryDate, formatHistoryPayload, historyActionLabel } from './historyLabels';

type FormTab = 'editor' | 'history';

export function BellTemplateFormModal({
  open,
  onClose,
  yearId,
  yearName,
  template,
  onSaved,
  onOpenCopy,
}: {
  open: boolean;
  onClose: () => void;
  yearId: number;
  yearName: string;
  template: BellTemplate | null;
  onSaved: (saved: BellTemplate) => void;
  /** After «создать копию» from in-use dialog — open the new template. */
  onOpenCopy: (copied: BellTemplate) => void;
}) {
  const isEdit = template != null;
  const toast = useToast();
  const qc = useQueryClient();

  const [formTab, setFormTab] = useState<FormTab>('editor');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<PeriodDraft[]>([emptyPeriodDraft()]);
  const [seededForId, setSeededForId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [inUseError, setInUseError] = useState<ApiError | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PeriodDraft | null>(null);

  // List DTO has periods=[] — never seed editor/diff from the list row.
  const detailQuery = useBellTemplate(open && template ? template.id : null);
  const detail = detailQuery.data ?? null;

  const usageQuery = useTemplateUsage(isEdit && open ? template.id : null);
  const historyQuery = useSettingsHistory(
    isEdit && open && formTab === 'history' ? 'BELL_TEMPLATE' : null,
    isEdit && open && formTab === 'history' ? template.id : null,
  );

  useEffect(() => {
    if (!open) {
      setSeededForId(null);
      return;
    }
    setFormTab('editor');
    setError(null);
    setInUseError(null);
    setDeleteTarget(null);

    if (!template) {
      setName('');
      setDescription('');
      setRows([emptyPeriodDraft()]);
      setSeededForId(null);
      return;
    }

    if (!detail || detail.id !== template.id) return;
    if (seededForId === detail.id) return;

    setName(detail.name);
    setDescription(detail.description ?? '');
    setRows(detail.periods.length > 0 ? periodsToDraft(detail.periods) : [emptyPeriodDraft()]);
    setSeededForId(detail.id);
  }, [open, template, detail, seededForId]);

  const detailReady = !isEdit || (detail != null && seededForId === template.id);
  const validation = useMemo(() => validatePeriodDrafts(rows), [rows]);
  const usage = usageQuery.data;
  const isUsed =
    usage != null && (usage.draftSchedules > 0 || usage.publishedSchedules > 0);

  async function invalidateTemplate(id: number) {
    await Promise.all([
      qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplates(yearId) }),
      qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplate(id) }),
      qc.invalidateQueries({ queryKey: scheduleSettingsKeys.templateUsage(id) }),
      qc.invalidateQueries({
        queryKey: scheduleSettingsKeys.settingsHistory('BELL_TEMPLATE', id),
      }),
    ]);
  }

  async function persist(confirmImpact: boolean): Promise<BellTemplate> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Укажите название шаблона');
    }
    if (rows.length === 0) {
      throw new Error('Добавьте хотя бы один урок');
    }
    if (validation.hasErrors) {
      throw new Error('Исправьте ошибки в сетке уроков');
    }

    if (!isEdit || !template) {
      const created = await scheduleSettingsApi.createBellTemplate({
        academicYearId: yearId,
        name: trimmedName,
        description: description.trim() || null,
      });
      for (const row of [...rows].sort((a, b) => a.lessonNumber - b.lessonNumber)) {
        await scheduleSettingsApi.addPeriod(created.id, {
          lessonNumber: row.lessonNumber,
          startTime: row.startTime,
          endTime: row.endTime,
          sortOrder: row.lessonNumber,
          confirmImpact,
        });
      }
      const fresh = await scheduleSettingsApi.getBellTemplate(created.id);
      await invalidateTemplate(fresh.id);
      return fresh;
    }

    if (!detail || detail.id !== template.id) {
      throw new Error('Шаблон ещё не загружен');
    }

    const metaChanged =
      trimmedName !== detail.name || (description.trim() || null) !== (detail.description ?? null);
    if (metaChanged) {
      await scheduleSettingsApi.updateBellTemplate(detail.id, {
        name: trimmedName,
        description: description.trim() || null,
        confirmImpact,
      });
    }

    // Intentional batch save (§8): delete → update → add sequentially (unique lessonNumber).
    // confirmImpact on each call covers ТЗ §9; no per-row useDeleteLessonPeriod (would race / dual UX).
    const diff = diffPeriods(detail.periods, rows);
    for (const periodId of diff.toDelete) {
      await scheduleSettingsApi.deletePeriod(detail.id, periodId, confirmImpact);
    }
    for (const item of diff.toUpdate) {
      await scheduleSettingsApi.updatePeriod(detail.id, item.periodId, {
        lessonNumber: item.lessonNumber,
        startTime: item.startTime,
        endTime: item.endTime,
        sortOrder: item.sortOrder,
        confirmImpact,
      });
    }
    for (const item of diff.toAdd) {
      await scheduleSettingsApi.addPeriod(detail.id, {
        ...item,
        confirmImpact,
      });
    }

    const fresh = await scheduleSettingsApi.getBellTemplate(detail.id);
    await invalidateTemplate(fresh.id);
    return fresh;
  }

  async function runSave(confirmImpact: boolean) {
    setPending(true);
    setError(null);
    try {
      const saved = await persist(confirmImpact);
      setInUseError(null);
      toast.success(isEdit ? 'Шаблон сохранён' : 'Шаблон создан');
      onSaved(saved);
      onClose();
    } catch (err) {
      if (isTemplateInUseError(err)) {
        setInUseError(err);
        return;
      }
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await runSave(false);
  }

  async function handleCopyFromDialog() {
    if (!template) return;
    setPending(true);
    try {
      const copied = await scheduleSettingsApi.copyBellTemplate(template.id, {
        name: `${template.name} (копия)`,
      });
      await invalidateTemplate(template.id);
      qc.setQueryData(scheduleSettingsKeys.bellTemplate(copied.id), copied);
      await qc.invalidateQueries({ queryKey: scheduleSettingsKeys.bellTemplates(yearId) });
      setInUseError(null);
      toast.success('Создана копия шаблона');
      onClose();
      onOpenCopy(copied);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось скопировать');
    } finally {
      setPending(false);
    }
  }

  function requestDeleteRow(row: PeriodDraft) {
    if (isEdit && row.id != null) {
      setDeleteTarget(row);
      return;
    }
    setRows((prev) => prev.filter((r) => r.key !== row.key));
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEdit ? 'Редактирование шаблона' : 'Новый шаблон звонков'}
        subtitle={yearName}
        size="xl"
        footer={
          formTab === 'editor' ? (
            <>
              <Button variant="secondary" onClick={onClose} disabled={pending}>
                Отмена
              </Button>
              <Button
                type="submit"
                form="bell-template-form"
                loading={pending}
                disabled={!detailReady || validation.hasErrors || rows.length === 0}
              >
                Сохранить
              </Button>
            </>
          ) : undefined
        }
      >
        {isEdit && (
          <Tabs value={formTab} onValueChange={(v) => setFormTab(v as FormTab)} className="mb-4">
            <TabsList>
              <TabsTrigger value="editor">Редактор</TabsTrigger>
              <TabsTrigger value="history">История</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {formTab === 'editor' && !detailReady && (
          <>
            {detailQuery.isError ? (
              <ErrorBlock
                message={
                  detailQuery.error instanceof Error
                    ? detailQuery.error.message
                    : 'Не удалось загрузить шаблон'
                }
                onRetry={() => void detailQuery.refetch()}
              />
            ) : (
              <LoadingBlock label="Загрузка шаблона и уроков…" />
            )}
          </>
        )}

        {formTab === 'editor' && detailReady && (
          <form id="bell-template-form" onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            {isEdit && usageQuery.isLoading && (
              <p className="text-xs text-slate-400">Проверяем использование шаблона…</p>
            )}
            {isEdit && isUsed && usage && (
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Назначен {usage.bindings} классам, расписаний: {usage.draftSchedules} черновиков,{' '}
                  {usage.publishedSchedules} опубликованных. Изменения времени затронут их.
                </p>
              </div>
            )}

            <Field label="Название" required error={error && !name.trim() ? error : undefined}>
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
                required
                autoFocus
              />
            </Field>

            <Field label="Учебный год" hint="Берётся из селектора раздела">
              <TextInput value={yearName} disabled readOnly />
            </Field>

            <Field label="Описание">
              <TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={pending}
                placeholder="Необязательно"
              />
            </Field>

            <LessonPeriodsEditor
              rows={rows}
              validation={validation}
              onChange={setRows}
              onRequestDelete={requestDeleteRow}
              disabled={pending}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}

        {formTab === 'history' && isEdit && (
          <HistoryPanel
            loading={historyQuery.isLoading}
            error={historyQuery.isError}
            onRetry={() => void historyQuery.refetch()}
            entries={historyQuery.data?.content ?? []}
          />
        )}
      </Modal>

      <TemplateInUseDialog
        open={inUseError != null}
        error={inUseError}
        usageFallback={usage}
        loading={pending}
        onCancel={() => setInUseError(null)}
        onConfirmImpact={() => void runSave(true)}
        onCopy={() => void handleCopyFromDialog()}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        title="Удалить урок?"
        message={
          deleteTarget
            ? `Урок №${deleteTarget.lessonNumber} (${deleteTarget.startTime}–${deleteTarget.endTime}) будет удалён при сохранении шаблона.`
            : ''
        }
        confirmLabel="Удалить"
        danger
        onConfirm={() => {
          if (deleteTarget) {
            setRows((prev) => prev.filter((r) => r.key !== deleteTarget.key));
          }
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

function HistoryPanel({
  loading,
  error,
  onRetry,
  entries,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  entries: Array<{
    id: number;
    actionType: ScheduleSettingsAction;
    actorFullName: string;
    payload: string | null;
    createdAt: string;
  }>;
}) {
  if (loading) return <LoadingBlock label="Загрузка истории…" />;
  if (error) return <ErrorBlock message="Не удалось загрузить историю" onRetry={onRetry} />;
  if (entries.length === 0) {
    return <EmptyBlock title="История пуста" description="Действий по шаблону пока нет." />;
  }

  return (
    <ul className="max-h-[28rem] space-y-3 overflow-y-auto">
      {entries.map((entry) => {
        const payloadLines = formatHistoryPayload(entry.payload);
        return (
          <li key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">
                {historyActionLabel(entry.actionType)}
              </p>
              <p className="text-xs text-slate-400">{formatHistoryDate(entry.createdAt)}</p>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{entry.actorFullName}</p>
            {payloadLines.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                {payloadLines.map((line) => (
                  <li key={line} className="font-mono">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
