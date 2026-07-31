import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Minus, X } from 'lucide-react';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { isClassesAlreadyBoundError, boundConflictsFromError } from '@/lib/scheduleSettingsApi';
import { groupClassesByGrade } from '@/lib/platformCoreApi';
import { cx, pluralRu } from '@/lib/format';
import type { BellTemplate, BoundClassConflict } from '@/lib/scheduleSettingsTypes';
import {
  buildOccupiedClassMap,
  useAssignBindings,
  useManyTemplateBindings,
  useSchoolClasses,
  useTemplateBindings,
  useUnassignBinding,
} from '@/platform/hooks/useScheduleSettings';
import { ModalActions, ModalCard, MODAL_SECONDARY } from './ModalCard';
import { ScheduleConfirmModal } from './ScheduleConfirmModal';

/** Чекбокс по 2015:9273 — 16px, radius 4, рамка 1.5px #9ca3af. */
function PickerCheckbox({
  checked,
  indeterminate,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
}) {
  const on = checked || indeterminate;
  return (
    <span
      aria-hidden
      className={cx(
        'flex size-4 shrink-0 items-center justify-center rounded border-[1.5px] transition',
        on ? 'border-navy-700 bg-navy-700 text-white' : 'border-gray-400 bg-white',
        disabled && 'opacity-50',
      )}
    >
      {indeterminate ? (
        <Minus className="size-3" strokeWidth={3} />
      ) : checked ? (
        <Check className="size-3" strokeWidth={3} />
      ) : null}
    </span>
  );
}

/**
 * Назначение шаблона классам. Figma 2015:9262 «modal-centered-card» —
 * карточка 440, p 24, gap 20; список параллелей с чекбоксами, max-h 320.
 */
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

  async function applyChanges(replaceExisting: boolean) {
    if (!template) return;
    setPending(true);
    setError(null);
    try {
      const toAdd = [...selected].filter((id) => !ownClassIds.has(id));
      const toRemove = [...ownClassIds].filter((id) => !selected.has(id));

      if (toAdd.length > 0) {
        try {
          await assignMutation.mutateAsync({ classIds: toAdd, replaceExisting });
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
      toast.success('Классы назначены');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось обновить привязки');
    } finally {
      setPending(false);
    }
  }

  const loading =
    classesQuery.isLoading ||
    ownBindingsQuery.isLoading ||
    allBindingsQueries.some((q) => q.isLoading);

  return (
    <>
      <ModalCard
        open={open}
        onClose={onClose}
        labelledBy="bindings-title"
        className="max-w-[440px] gap-5 p-6"
      >
        {/* 2015:9263 — modal-header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 id="bindings-title" className="text-xl font-bold text-ink">
              Назначить шаблон
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="text-gray-400 transition hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="text-13 text-gray-400">
            {isHidden ? 'Шаблон скрыт — сначала активируйте его' : 'Выберите хотя бы один класс'}
          </p>
        </div>

        {loading && <LoadingBlock label="Загрузка классов…" />}

        {(classesQuery.isError || ownBindingsQuery.isError) && !loading && (
          <ErrorBlock
            message="Не удалось загрузить данные привязок"
            onRetry={() => {
              void classesQuery.refetch();
              void ownBindingsQuery.refetch();
            }}
          />
        )}

        {!loading && !classesQuery.isError && gradeGroups.length === 0 && (
          <EmptyBlock title="Нет активных классов" description="Создайте классы в разделе «Классы»." />
        )}

        {/* 2015:9270 — scrollable-class-list */}
        {!loading && !isHidden && gradeGroups.length > 0 && (
          <div className="flex max-h-[320px] flex-col gap-4 overflow-y-auto pr-1">
            {gradeGroups.map((group) => {
              const ids = group.classes.map((c) => c.id);
              const selectedCount = ids.filter((id) => selected.has(id)).length;
              const allOn = selectedCount === ids.length && ids.length > 0;
              const someOn = selectedCount > 0 && !allOn;

              return (
                <div key={group.grade} className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => toggleGrade(ids)}
                    className="flex items-center gap-3 py-1 text-left"
                  >
                    <PickerCheckbox checked={allOn} indeterminate={someOn} />
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{group.grade} класс</span>
                      <span className="text-13 text-muted">
                        {ids.length} {pluralRu(ids.length, ['класс', 'класса', 'классов'])}
                      </span>
                    </span>
                  </button>

                  <div className="flex flex-col gap-2 pl-7">
                    {group.classes.map((schoolClass) => {
                      const occupiedBy = occupied.get(schoolClass.id);
                      return (
                        <button
                          key={schoolClass.id}
                          type="button"
                          onClick={() => toggleClass(schoolClass.id)}
                          className="flex items-center gap-3 text-left"
                        >
                          <PickerCheckbox checked={selected.has(schoolClass.id)} />
                          <span className="text-sm text-muted">{schoolClass.name}</span>
                          {occupiedBy && (
                            <span className="truncate text-11 text-amber-700">
                              занят: {occupiedBy.templateName}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="text-13 text-red-600">{error}</p>}

        {/* 2015:9353 — modal-footer */}
        <ModalActions>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={cx(MODAL_SECONDARY, 'text-muted')}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void applyChanges(false)}
            disabled={pending || isHidden || selected.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-line disabled:text-gray-400"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Назначить
          </button>
        </ModalActions>
      </ModalCard>

      <ScheduleConfirmModal
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
    </>
  );
}
