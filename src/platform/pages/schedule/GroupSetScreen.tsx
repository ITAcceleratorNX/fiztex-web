import { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Split } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { pluralRu } from '@/lib/format';
import {
  isStudentAlreadyInSet,
  isStudentNotInClass,
} from '@/lib/schedule2bApi';
import type { SubgroupStudent } from '@/lib/schedule2bTypes';
import {
  useAddSubgroupStudents,
  useArchiveSubgroup,
  useAutoSplit,
  useCreateSubgroup,
  useGroupSetAggregate,
  useMoveSubgroupStudent,
  usePatchSubgroup,
  useRemoveSubgroupStudent,
} from '@/platform/hooks/useSubgroups';
import { AutoSplitDialog } from './AutoSplitDialog';
import { DuplicatesAlert } from './DuplicatesAlert';
import { SubgroupColumn, UnassignedPanel } from './GroupSetPanels';
import type { StudentMenuAction } from './StudentActionMenu';
import { SubgroupsInUseDialog } from './SubgroupsInUseDialog';
import {
  activeSubgroups,
  parseStudentAlreadyInSetDetails,
  sortStudentsByName,
} from './subgroupHelpers';
import { useArchiveThenAutoSplit } from './useArchiveThenAutoSplit';

export function GroupSetScreen({
  setId,
  onBack,
}: {
  setId: number;
  onBack: () => void;
}) {
  const toast = useToast();
  const query = useGroupSetAggregate(setId);
  const autoSplit = useAutoSplit(setId);
  const addStudents = useAddSubgroupStudents(setId);
  const removeStudent = useRemoveSubgroupStudent(setId);
  const moveStudent = useMoveSubgroupStudent(setId);
  const patchSubgroup = usePatchSubgroup(setId);
  const createSubgroup = useCreateSubgroup(setId);
  const archiveSubgroup = useArchiveSubgroup(setId);

  const splitFlow = useArchiveThenAutoSplit({
    archiveSubgroup,
    autoSplit,
  });

  const [alreadyInPrompt, setAlreadyInPrompt] = useState<null | {
    studentId: number;
    fromSubgroupId: number;
    fromName: string;
    targetSubgroupId: number;
  }>(null);
  const [busyStudentId, setBusyStudentId] = useState<number | null>(null);

  const aggregate = query.data;
  const subgroups = useMemo(
    () => (aggregate ? activeSubgroups(aggregate.subgroups) : []),
    [aggregate],
  );
  const unassigned = useMemo(
    () => sortStudentsByName(aggregate?.unassignedStudents ?? []),
    [aggregate],
  );
  const duplicates = aggregate?.duplicates ?? [];
  const mutating =
    autoSplit.isPending ||
    addStudents.isPending ||
    removeStudent.isPending ||
    moveStudent.isPending ||
    patchSubgroup.isPending ||
    createSubgroup.isPending ||
    archiveSubgroup.isPending;

  async function handleAdd(studentId: number, targetSubgroupId: number) {
    setBusyStudentId(studentId);
    try {
      await addStudents.mutateAsync({ subgroupId: targetSubgroupId, studentIds: [studentId] });
      toast.success('Ученик добавлен в группу');
    } catch (err) {
      if (isStudentAlreadyInSet(err)) {
        const rows = parseStudentAlreadyInSetDetails(err.details);
        const row = rows.find((r) => r.studentId === studentId) ?? rows[0];
        if (row) {
          setAlreadyInPrompt({
            studentId,
            fromSubgroupId: row.subgroupId,
            fromName: row.subgroupName,
            targetSubgroupId,
          });
          return;
        }
      }
      if (isStudentNotInClass(err)) {
        toast.error('Ученик не состоит в этом классе');
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Не удалось добавить');
    } finally {
      setBusyStudentId(null);
    }
  }

  async function confirmMoveFromConflict() {
    if (!alreadyInPrompt) return;
    const prompt = alreadyInPrompt;
    setAlreadyInPrompt(null);
    setBusyStudentId(prompt.studentId);
    try {
      await moveStudent.mutateAsync({
        subgroupId: prompt.fromSubgroupId,
        studentId: prompt.studentId,
        targetSubgroupId: prompt.targetSubgroupId,
      });
      toast.success('Ученик перенесён');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось перенести');
    } finally {
      setBusyStudentId(null);
    }
  }

  async function handleMemberAction(
    subgroupId: number,
    student: SubgroupStudent,
    action: StudentMenuAction,
  ) {
    setBusyStudentId(student.studentId);
    try {
      if (action.kind === 'remove') {
        await removeStudent.mutateAsync({ subgroupId, studentId: student.studentId });
        toast.success('Ученик убран из подгруппы');
      } else if (action.kind === 'move') {
        await moveStudent.mutateAsync({
          subgroupId,
          studentId: student.studentId,
          targetSubgroupId: action.targetSubgroupId,
        });
        toast.success('Ученик перенесён');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить состав');
    } finally {
      setBusyStudentId(null);
    }
  }

  async function onRename(subgroupId: number, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await patchSubgroup.mutateAsync({ subgroupId, name: trimmed });
      toast.success('Название сохранено');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось переименовать');
    }
  }

  async function onCreateSubgroup() {
    try {
      await createSubgroup.mutateAsync(`Группа ${subgroups.length + 1}`);
      toast.success('Подгруппа создана');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать подгруппу');
    }
  }

  async function onKeepOnlyIn(studentId: number, keepId: number, fromIds: number[]) {
    setBusyStudentId(studentId);
    try {
      for (const fromId of fromIds) {
        await moveStudent.mutateAsync({
          subgroupId: fromId,
          studentId,
          targetSubgroupId: keepId,
        });
      }
      toast.success(
        `Оставлен только в «${subgroups.find((s) => s.id === keepId)?.name ?? keepId}»`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось исправить');
    } finally {
      setBusyStudentId(null);
    }
  }

  if (query.isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <LoadingBlock label="Загрузка набора…" />
      </div>
    );
  }

  if (query.isError || !aggregate) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <ErrorBlock
          message={
            query.error instanceof Error ? query.error.message : 'Не удалось загрузить набор'
          }
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  const set = aggregate.groupSet;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
          >
            <ArrowLeft className="h-4 w-4" />
            К списку наборов
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{set.name}</h2>
            {set.status === 'ARCHIVED' ? (
              <Badge tone="gray">архив</Badge>
            ) : (
              <Badge tone="green" dot>
                активен
              </Badge>
            )}
            {unassigned.length > 0 && (
              <Badge tone="amber">нераспределённых: {unassigned.length}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {subgroups.length}{' '}
            {pluralRu(subgroups.length, ['подгруппа', 'подгруппы', 'подгрупп'])}
            {' · '}
            {set.assignedStudentCount}{' '}
            {pluralRu(set.assignedStudentCount, ['ученик', 'ученика', 'учеников'])} в группах
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            disabled={mutating || set.status === 'ARCHIVED'}
            loading={createSubgroup.isPending}
            onClick={() => void onCreateSubgroup()}
          >
            Подгруппа
          </Button>
          <Button
            type="button"
            size="sm"
            icon={<Split className="h-4 w-4" />}
            disabled={mutating || set.status === 'ARCHIVED'}
            onClick={() => splitFlow.setAutoSplitOpen(true)}
          >
            Разделить по алфавиту на 2
          </Button>
        </div>
      </div>

      <DuplicatesAlert
        duplicates={duplicates}
        subgroups={subgroups}
        disabled={mutating}
        onKeepOnlyIn={(studentId, keepId, fromIds) =>
          void onKeepOnlyIn(studentId, keepId, fromIds)
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {subgroups.length === 0 && (
            <div className="sm:col-span-2 xl:col-span-3">
              <EmptyBlock
                title="Подгрупп пока нет"
                description="Разделите класс по алфавиту или создайте пустые подгруппы вручную."
                action={
                  <Button
                    type="button"
                    onClick={() => splitFlow.setAutoSplitOpen(true)}
                    disabled={mutating}
                  >
                    Разделить по алфавиту на 2
                  </Button>
                }
              />
            </div>
          )}
          {subgroups.map((sg) => (
            <SubgroupColumn
              key={sg.id}
              subgroup={sg}
              allSubgroups={subgroups}
              disabled={mutating || set.status === 'ARCHIVED'}
              busyStudentId={busyStudentId}
              onRename={(name) => void onRename(sg.id, name)}
              onArchive={() => void splitFlow.archiveOne(sg.id)}
              onStudentAction={(student, action) =>
                void handleMemberAction(sg.id, student, action)
              }
            />
          ))}
        </div>

        <UnassignedPanel
          students={unassigned}
          subgroups={subgroups}
          disabled={mutating || set.status === 'ARCHIVED'}
          busyStudentId={busyStudentId}
          onAction={(student, action) => {
            if (action.kind === 'add') void handleAdd(student.studentId, action.targetSubgroupId);
          }}
        />
      </div>

      <AutoSplitDialog
        open={splitFlow.autoSplitOpen}
        studentCount={unassigned.length + set.assignedStudentCount}
        loading={autoSplit.isPending}
        onClose={() => splitFlow.setAutoSplitOpen(false)}
        onConfirm={(names) => void splitFlow.runAutoSplit(names)}
      />

      <ConfirmDialog
        open={splitFlow.notEmptyOpen}
        onClose={splitFlow.cancelNotEmpty}
        onConfirm={() => void splitFlow.archiveAllThenSplit(subgroups.map((s) => s.id))}
        title="В наборе уже есть группы"
        message="Автоделение работает только на пустом наборе. Заархивировать текущие подгруппы и открыть деление снова?"
        confirmLabel="Заархивировать и продолжить"
        cancelLabel="Отмена"
        danger
        loading={archiveSubgroup.isPending}
      />

      <ConfirmDialog
        open={alreadyInPrompt != null}
        onClose={() => setAlreadyInPrompt(null)}
        onConfirm={() => void confirmMoveFromConflict()}
        title="Ученик уже в другой группе"
        message={
          alreadyInPrompt
            ? `Ученик уже в «${alreadyInPrompt.fromName}». Перенести в выбранную группу?`
            : null
        }
        confirmLabel="Перенести"
        cancelLabel="Отмена"
      />

      <SubgroupsInUseDialog
        open={splitFlow.inUseRows.length > 0}
        rows={splitFlow.inUseRows}
        loading={archiveSubgroup.isPending}
        onCancel={splitFlow.cancelInUse}
        onConfirmImpact={() => void splitFlow.confirmArchiveImpact()}
      />
    </div>
  );
}
