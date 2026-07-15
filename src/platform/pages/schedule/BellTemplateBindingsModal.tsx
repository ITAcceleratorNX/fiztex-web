import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { isClassesAlreadyBoundError, boundConflictsFromError } from '@/lib/scheduleSettingsApi';
import { groupClassesByGrade } from '@/lib/platformCoreApi';
import type { BellTemplate, BoundClassConflict } from '@/lib/scheduleSettingsTypes';
import {
  buildOccupiedClassMap,
  useAssignBindings,
  useManyTemplateBindings,
  useSchoolClasses,
  useTemplateBindings,
  useUnassignBinding,
} from '@/platform/hooks/useScheduleSettings';
import { ClassGradePicker } from './ClassGradePicker';

export function BellTemplateBindingsModal({
  open,
  onClose,
  yearId,
  template,
  allTemplates,
}: {
  open: boolean;
  onClose: () => void;
  yearId: number;
  template: BellTemplate | null;
  allTemplates: BellTemplate[];
}) {
  const toast = useToast();
  const templateId = template?.id ?? null;
  const isHidden = template?.status === 'HIDDEN';

  const classesQuery = useSchoolClasses(open ? yearId : null);
  const ownBindingsQuery = useTemplateBindings(open && templateId ? templateId : null);
  const templateIds = useMemo(() => allTemplates.map((t) => t.id), [allTemplates]);
  const allBindingsQueries = useManyTemplateBindings(open ? templateIds : []);

  const assignMutation = useAssignBindings(templateId, yearId);
  const unassignMutation = useUnassignBinding(templateId, yearId);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [replaceConflicts, setReplaceConflicts] = useState<BoundClassConflict[] | null>(null);
  const [unassignClassId, setUnassignClassId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gradeGroups = useMemo(
    () => groupClassesByGrade(classesQuery.data?.content ?? []),
    [classesQuery.data],
  );

  const occupied = useMemo(
    () =>
      buildOccupiedClassMap(
        allTemplates,
        allBindingsQueries.map((q) => q.data),
        templateId ?? undefined,
      ),
    [allTemplates, allBindingsQueries, templateId],
  );

  const ownClassIds = useMemo(
    () => new Set((ownBindingsQuery.data ?? []).map((b) => b.classId)),
    [ownBindingsQuery.data],
  );

  useEffect(() => {
    if (!open) {
      setInitialized(false);
      setReplaceConflicts(null);
      setUnassignClassId(null);
      setError(null);
      return;
    }
    if (!initialized && ownBindingsQuery.data) {
      setSelected(new Set(ownBindingsQuery.data.map((b) => b.classId)));
      setInitialized(true);
    }
  }, [open, ownBindingsQuery.data, initialized]);

  function toggleClass(classId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  function toggleGrade(classIds: number[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = classIds.every((id) => next.has(id));
      if (allSelected) {
        for (const id of classIds) next.delete(id);
      } else {
        for (const id of classIds) next.add(id);
      }
      return next;
    });
  }

  async function applyAssign(classIds: number[], replaceExisting: boolean) {
    if (classIds.length === 0) return;
    await assignMutation.mutateAsync({ classIds, replaceExisting });
  }

  async function applyChanges(replaceExisting: boolean) {
    if (!template) return;
    setPending(true);
    setError(null);
    try {
      const toAdd = [...selected].filter((id) => !ownClassIds.has(id));
      const toRemove = [...ownClassIds].filter((id) => !selected.has(id));

      if (toAdd.length > 0) {
        try {
          await applyAssign(toAdd, replaceExisting);
        } catch (err) {
          if (isClassesAlreadyBoundError(err)) {
            setReplaceConflicts(boundConflictsFromError(err));
            return;
          }
          throw err;
        }
      }

      for (const classId of toRemove) {
        await unassignMutation.mutateAsync(classId);
      }

      setReplaceConflicts(null);
      toast.success('Привязки обновлены');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось обновить привязки');
    } finally {
      setPending(false);
    }
  }

  async function confirmUnassign() {
    if (unassignClassId == null) return;
    setPending(true);
    try {
      await unassignMutation.mutateAsync(unassignClassId);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(unassignClassId);
        return next;
      });
      setUnassignClassId(null);
      toast.success('Привязка снята');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось снять привязку');
    } finally {
      setPending(false);
    }
  }

  const bindingsLoading =
    classesQuery.isLoading || ownBindingsQuery.isLoading || allBindingsQueries.some((q) => q.isLoading);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Привязка классов"
        subtitle={template?.name}
        size="lg"
        footer={
          isHidden ? undefined : (
            <>
              <Button variant="secondary" onClick={onClose} disabled={pending}>
                Отмена
              </Button>
              <Button loading={pending} onClick={() => void applyChanges(false)}>
                Применить
              </Button>
            </>
          )
        }
      >
        {isHidden && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Шаблон скрыт — сначала активируйте его, затем назначайте классы.
          </div>
        )}

        {bindingsLoading && <LoadingBlock label="Загрузка классов…" />}
        {(classesQuery.isError || ownBindingsQuery.isError) && !bindingsLoading && (
          <ErrorBlock
            message="Не удалось загрузить данные привязок"
            onRetry={() => {
              void classesQuery.refetch();
              void ownBindingsQuery.refetch();
            }}
          />
        )}

        {!bindingsLoading && !classesQuery.isError && gradeGroups.length === 0 && (
          <EmptyBlock
            title="Нет активных классов"
            description="Создайте классы в разделе «Классы»."
          />
        )}

        {!bindingsLoading && !isHidden && gradeGroups.length > 0 && (
          <ClassGradePicker
            gradeGroups={gradeGroups}
            selectedClassIds={selected}
            onToggleClass={toggleClass}
            onToggleGrade={toggleGrade}
            classMeta={(classId) => {
              const occupiedBy = occupied.get(classId);
              const isOwn = ownClassIds.has(classId);
              return (
                <>
                  {isOwn && <span className="text-xs text-emerald-600">этот шаблон</span>}
                  {occupiedBy && (
                    <span className="truncate text-xs text-amber-700">
                      занят: {occupiedBy.templateName}
                    </span>
                  )}
                </>
              );
            }}
            classTrailing={(classId) =>
              ownClassIds.has(classId) ? (
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Снять привязку"
                  onClick={() => setUnassignClassId(classId)}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null
            }
          />
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Modal>

      <ConfirmDialog
        open={replaceConflicts != null}
        onClose={() => setReplaceConflicts(null)}
        title="Переназначить классы?"
        confirmLabel="Переназначить"
        loading={pending}
        message={
          <div>
            {(replaceConflicts ?? []).length > 0 ? (
              <>
                <p className="mb-2">Эти классы уже привязаны к другим шаблонам:</p>
                <ul className="list-disc space-y-1 pl-5">
                  {(replaceConflicts ?? []).map((c) => (
                    <li key={c.classId}>
                      {c.className} → {c.currentTemplateName}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>
                Часть классов уже занята другим шаблоном (детали недоступны — возможен race).
                Переназначить выбранные классы на этот шаблон?
              </p>
            )}
          </div>
        }
        onConfirm={() => void applyChanges(true)}
      />

      <ConfirmDialog
        open={unassignClassId != null}
        onClose={() => setUnassignClassId(null)}
        title="Снять привязку?"
        confirmLabel="Снять"
        danger
        loading={pending}
        message="Класс больше не будет связан с этим шаблоном звонков."
        onConfirm={() => void confirmUnassign()}
      />
    </>
  );
}
