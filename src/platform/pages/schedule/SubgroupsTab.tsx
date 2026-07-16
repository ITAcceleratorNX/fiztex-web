import { useMemo, useState } from 'react';
import { Archive, Plus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { cx, pluralRu } from '@/lib/format';
import { isSubgroupsInUse } from '@/lib/schedule2bApi';
import type { GroupSet, SubgroupInUse } from '@/lib/schedule2bTypes';
import { useSchoolClasses } from '@/platform/hooks/useScheduleSettings';
import {
  useAcademicPeriods,
  useArchiveGroupSet,
  useGroupSets,
  useSchoolSubjects,
  useUnassignedCounts,
} from '@/platform/hooks/useSubgroups';
import { CreateGroupSetModal } from './CreateGroupSetModal';
import { GroupSetScreen } from './GroupSetScreen';
import { SubgroupsInUseDialog } from './SubgroupsInUseDialog';
import { parseSubgroupsInUseDetails } from './subgroupHelpers';

const CLASS_ID_PARAM = 'classId';
const SET_ID_PARAM = 'setId';

export type SubgroupsTabState = {
  classId: number | null;
  setId: number | null;
};

export function parseSubgroupsTabState(params: URLSearchParams): SubgroupsTabState {
  const classRaw = params.get(CLASS_ID_PARAM);
  const setRaw = params.get(SET_ID_PARAM);
  const classId = classRaw != null ? Number(classRaw) : NaN;
  const setId = setRaw != null ? Number(setRaw) : NaN;
  return {
    classId: Number.isFinite(classId) && classId > 0 ? classId : null,
    setId: Number.isFinite(setId) && setId > 0 ? setId : null,
  };
}

export function writeSubgroupsTabState(next: URLSearchParams, state: SubgroupsTabState) {
  if (state.classId != null) next.set(CLASS_ID_PARAM, String(state.classId));
  else next.delete(CLASS_ID_PARAM);
  if (state.setId != null) next.set(SET_ID_PARAM, String(state.setId));
  else next.delete(SET_ID_PARAM);
}

export function SubgroupsTab({
  yearId,
  state,
  onStateChange,
}: {
  yearId: number;
  state: SubgroupsTabState;
  onStateChange: (next: SubgroupsTabState) => void;
}) {
  const toast = useToast();
  const classesQuery = useSchoolClasses(yearId);
  const subjectsQuery = useSchoolSubjects();
  const periodsQuery = useAcademicPeriods(yearId);
  const setsQuery = useGroupSets(
    state.classId != null ? { classId: state.classId, status: 'ACTIVE' } : null,
  );
  const archiveSet = useArchiveGroupSet();

  const [createOpen, setCreateOpen] = useState(false);
  const [inUseRows, setInUseRows] = useState<SubgroupInUse[]>([]);
  const [pendingArchiveSetId, setPendingArchiveSetId] = useState<number | null>(null);

  const classes = classesQuery.data?.content ?? [];
  const sets = setsQuery.data ?? [];
  const subjectsById = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of subjectsQuery.data?.content ?? []) map.set(s.id, s.name);
    return map;
  }, [subjectsQuery.data]);
  const periodsById = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of periodsQuery.data ?? []) map.set(p.id, p.name);
    return map;
  }, [periodsQuery.data]);

  const setIds = sets.map((s) => s.id);
  const unassignedQueries = useUnassignedCounts(setIds);
  const unassignedBySetId = useMemo(() => {
    const map = new Map<number, number>();
    setIds.forEach((id, index) => {
      const count = unassignedQueries[index]?.data;
      if (typeof count === 'number') map.set(id, count);
    });
    return map;
  }, [setIds, unassignedQueries]);

  const selectedClass = classes.find((c) => c.id === state.classId) ?? null;

  function selectClass(classIdRaw: string) {
    const classId = classIdRaw ? Number(classIdRaw) : null;
    onStateChange({
      classId: classId != null && Number.isFinite(classId) ? classId : null,
      setId: null,
    });
  }

  function openSet(setId: number) {
    onStateChange({ ...state, setId });
  }

  function closeSet() {
    onStateChange({ ...state, setId: null });
  }

  async function onArchiveSet(set: GroupSet) {
    try {
      await archiveSet.mutateAsync({ setId: set.id, confirmImpact: false });
      toast.success(`Набор «${set.name}» заархивирован`);
      if (state.setId === set.id) closeSet();
    } catch (err) {
      if (isSubgroupsInUse(err)) {
        setInUseRows(parseSubgroupsInUseDetails(err.details));
        setPendingArchiveSetId(set.id);
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Не удалось заархивировать набор');
    }
  }

  async function confirmArchiveImpact() {
    if (pendingArchiveSetId == null) return;
    try {
      await archiveSet.mutateAsync({ setId: pendingArchiveSetId, confirmImpact: true });
      toast.success('Набор заархивирован');
      if (state.setId === pendingArchiveSetId) closeSet();
      setInUseRows([]);
      setPendingArchiveSetId(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось заархивировать набор');
    }
  }

  if (state.setId != null && state.classId != null) {
    return (
      <GroupSetScreen
        key={state.setId}
        setId={state.setId}
        onBack={closeSet}
      />
    );
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-slate-500">
        Наборы групп внутри класса: общее деление или по предмету. Составы наборов независимы —
        один ученик может быть в разных группах разных наборов.
      </p>

      <div className="mb-5 sm:max-w-sm">
        <Field label="Класс">
          <Select
            value={state.classId != null ? String(state.classId) : ''}
            onChange={(e) => selectClass(e.target.value)}
            disabled={classesQuery.isLoading || classes.length === 0}
          >
            <option value="">Выберите класс</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {classesQuery.isLoading && <LoadingBlock label="Загрузка классов…" />}
      {classesQuery.isError && (
        <ErrorBlock
          message={
            classesQuery.error instanceof Error
              ? classesQuery.error.message
              : 'Не удалось загрузить классы'
          }
          onRetry={() => void classesQuery.refetch()}
        />
      )}

      {!classesQuery.isLoading && !classesQuery.isError && classes.length === 0 && (
        <EmptyBlock
          title="Нет классов"
          description="Создайте классы в Platform Core для выбранного учебного года."
        />
      )}

      {state.classId == null && classes.length > 0 && (
        <EmptyBlock
          icon={<Users className="h-7 w-7" />}
          title="Выберите класс"
          description="Затем откроется список наборов групп или предложение создать первый."
        />
      )}

      {state.classId != null && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">
              Наборы{selectedClass ? ` · ${selectedClass.name}` : ''}
            </h2>
            <Button
              type="button"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
            >
              Новый набор
            </Button>
          </div>

          {setsQuery.isLoading && <LoadingBlock label="Загрузка наборов…" />}
          {setsQuery.isError && (
            <ErrorBlock
              message={
                setsQuery.error instanceof Error
                  ? setsQuery.error.message
                  : 'Не удалось загрузить наборы'
              }
              onRetry={() => void setsQuery.refetch()}
            />
          )}

          {!setsQuery.isLoading && !setsQuery.isError && sets.length === 0 && (
            <EmptyBlock
              icon={<Users className="h-7 w-7" />}
              title="Класс не делится на подгруппы"
              description="Расписание создаётся для всего класса. Создайте набор, если нужно разделить учеников (например, на английский)."
              action={
                <Button type="button" onClick={() => setCreateOpen(true)}>
                  Создать набор
                </Button>
              }
            />
          )}

          {sets.length > 0 && (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {sets.map((set) => {
                const unassigned = unassignedBySetId.get(set.id) ?? 0;
                return (
                  <li key={set.id}>
                    <div
                      className={cx(
                        'flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center',
                        'hover:bg-slate-50/80',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => openSet(set.id)}
                        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-800">{set.name}</p>
                          {unassigned > 0 && (
                            <Badge tone="amber">нераспределённых: {unassigned}</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {set.subjectId != null
                            ? subjectsById.get(set.subjectId) ?? `Предмет #${set.subjectId}`
                            : 'Без предмета'}
                          {' · '}
                          {set.academicPeriodId != null
                            ? periodsById.get(set.academicPeriodId) ??
                              `Период #${set.academicPeriodId}`
                            : 'Весь год'}
                          {' · '}
                          {set.subgroupCount}{' '}
                          {pluralRu(set.subgroupCount, ['подгруппа', 'подгруппы', 'подгрупп'])}
                          {' · '}
                          {set.assignedStudentCount}{' '}
                          {pluralRu(set.assignedStudentCount, [
                            'ученик',
                            'ученика',
                            'учеников',
                          ])}
                        </p>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={<Archive className="h-4 w-4" />}
                        disabled={archiveSet.isPending}
                        aria-label={`Архивировать набор «${set.name}»`}
                        onClick={() => void onArchiveSet(set)}
                      >
                        Архив
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {state.classId != null && (
        <CreateGroupSetModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          yearId={yearId}
          classId={state.classId}
          onCreated={(setId) => onStateChange({ classId: state.classId, setId })}
        />
      )}

      <SubgroupsInUseDialog
        open={inUseRows.length > 0}
        rows={inUseRows}
        loading={archiveSet.isPending}
        title="Набор используется в расписании"
        onCancel={() => {
          setInUseRows([]);
          setPendingArchiveSetId(null);
        }}
        onConfirmImpact={() => void confirmArchiveImpact()}
      />
    </div>
  );
}
