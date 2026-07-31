import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, UserPlus, Users } from 'lucide-react';
import { Select } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/StateBlock';
import { useToast } from '@/context/ToastContext';
import { ApiError } from '@/lib/api';
import { cx } from '@/lib/format';
import {
  isStudentAlreadyInSet,
  isStudentNotInClass,
  isSubgroupsInUse,
  subgroupsApi,
} from '@/lib/schedule2bApi';
import type { AcademicYearRef } from '@/lib/scheduleSettingsTypes';
import type { GroupSet, SubgroupInUse, SubgroupStudent } from '@/lib/schedule2bTypes';
import { useSchoolClasses } from '@/platform/hooks/useScheduleSettings';
import {
  subgroupsKeys,
  useAcademicPeriods,
  useArchiveGroupSet,
  useArchiveSubgroup,
  useAutoSplit,
  useCreateSubgroup,
  useGroupSetAggregate,
  useGroupSets,
  usePatchSubgroup,
  useSchoolSubjects,
} from '@/platform/hooks/useSubgroups';
import { AutoSplitDialog } from './AutoSplitDialog';
import { CreateGroupSetModal } from './CreateGroupSetModal';
import { DuplicatesAlert } from './DuplicatesAlert';
import { AddSubgroupCard, ClassRosterCard, SubgroupCard } from './GroupSetPanels';
import { ScheduleBreadcrumbs } from './ScheduleBreadcrumbs';
import { ScheduleConfirmModal } from './ScheduleConfirmModal';
import { SubgroupsInUseDialog } from './SubgroupsInUseDialog';
import { useArchiveThenAutoSplit } from './useArchiveThenAutoSplit';
import {
  activeSubgroups,
  diffMembership,
  duplicateStudentIds,
  membershipEquals,
  membershipFromSubgroups,
  parseStudentAlreadyInSetDetails,
  parseSubgroupsInUseDetails,
  sortStudentsByName,
  studentShortName,
  type Membership,
} from './subgroupHelpers';

/** Figma 2015:5831 — тот же select, что в расписании и шаблонах звонков. */
const FILTER_CONTROL =
  'w-auto min-w-44 rounded-lg border-line bg-gray-50 px-3 py-2 text-13 font-medium text-ink';

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

/** Отложенное действие, которое сотрёт несохранённый черновик состава. */
type GuardedAction = { run: () => void };

export function SubgroupsTab({
  years,
  yearsLoading,
  yearId,
  onYearChange,
  state,
  onStateChange,
}: {
  years: AcademicYearRef[];
  yearsLoading?: boolean;
  yearId: number | null;
  onYearChange: (yearId: number | null) => void;
  state: SubgroupsTabState;
  onStateChange: (next: SubgroupsTabState) => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();

  const classesQuery = useSchoolClasses(yearId);
  const classes = useMemo(() => classesQuery.data?.content ?? [], [classesQuery.data]);

  const setsQuery = useGroupSets(
    state.classId != null ? { classId: state.classId, status: 'ACTIVE' } : null,
  );
  const sets = useMemo(() => setsQuery.data ?? [], [setsQuery.data]);

  const aggregateQuery = useGroupSetAggregate(state.setId);
  const aggregate = aggregateQuery.data;

  const subjectsQuery = useSchoolSubjects();
  const periodsQuery = useAcademicPeriods(yearId);

  const createSubgroup = useCreateSubgroup(state.setId);
  const patchSubgroup = usePatchSubgroup(state.setId);
  const archiveSubgroup = useArchiveSubgroup(state.setId);
  const autoSplit = useAutoSplit(state.setId);
  const archiveSet = useArchiveGroupSet();

  const splitFlow = useArchiveThenAutoSplit({ archiveSubgroup, autoSplit });

  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Membership | null>(null);
  const [seedKey, setSeedKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [createSetOpen, setCreateSetOpen] = useState(false);
  const [archiveSetOpen, setArchiveSetOpen] = useState(false);
  const [archiveSubgroupId, setArchiveSubgroupId] = useState<number | null>(null);
  const [guarded, setGuarded] = useState<GuardedAction | null>(null);
  const [setInUseRows, setSetInUseRows] = useState<SubgroupInUse[]>([]);

  const subgroups = useMemo(
    () => (aggregate ? activeSubgroups(aggregate.subgroups) : []),
    [aggregate],
  );
  const serverMembership = useMemo(() => membershipFromSubgroups(subgroups), [subgroups]);

  /** Пересеиваем черновик, только когда состав на сервере действительно изменился. */
  const serverKey = useMemo(
    () =>
      `${state.setId ?? 0}|` +
      subgroups
        .map((sg) => `${sg.id}:${[...(serverMembership[sg.id] ?? [])].sort((a, b) => a - b).join(',')}`)
        .join('|'),
    [state.setId, subgroups, serverMembership],
  );

  useEffect(() => {
    if (!aggregate) {
      setDraft(null);
      setSeedKey('');
      return;
    }
    if (seedKey === serverKey) return;
    setDraft(serverMembership);
    setSeedKey(serverKey);
  }, [aggregate, serverKey, seedKey, serverMembership]);

  /** Класс сменился — набор надо выбрать заново. */
  useEffect(() => {
    if (state.classId == null || setsQuery.isLoading || setsQuery.isError) return;
    const ids = sets.map((s) => s.id);
    const next = state.setId != null && ids.includes(state.setId) ? state.setId : ids[0] ?? null;
    if (next === state.setId) return;
    onStateChange({ classId: state.classId, setId: next });
  }, [sets, state.classId, state.setId, setsQuery.isLoading, setsQuery.isError, onStateChange]);

  const studentsById = useMemo(() => {
    const map = new Map<number, SubgroupStudent>();
    for (const student of aggregate?.unassignedStudents ?? []) map.set(student.studentId, student);
    for (const sg of aggregate?.subgroups ?? []) {
      for (const student of sg.students ?? []) map.set(student.studentId, student);
    }
    return map;
  }, [aggregate]);

  const roster = useMemo(() => sortStudentsByName([...studentsById.values()]), [studentsById]);

  const membership = draft ?? serverMembership;
  const assignedIds = useMemo(
    () => new Set(Object.values(membership).flat()),
    [membership],
  );
  const duplicates = useMemo(() => duplicateStudentIds(membership), [membership]);
  const duplicateSet = useMemo(() => new Set(duplicates), [duplicates]);
  const dirty = draft != null && !membershipEquals(serverMembership, draft);

  const selectedSet = sets.find((s) => s.id === state.setId) ?? null;
  const busy =
    saving ||
    createSubgroup.isPending ||
    patchSubgroup.isPending ||
    archiveSubgroup.isPending ||
    autoSplit.isPending ||
    archiveSet.isPending;

  /** Любое действие, которое сотрёт черновик, сначала спрашивает. */
  const guard = useCallback(
    (run: () => void) => {
      if (dirty) setGuarded({ run });
      else run();
    },
    [dirty],
  );

  function editDraft(next: (current: Membership) => Membership) {
    setDraft((prev) => next(prev ?? serverMembership));
  }

  function assign(studentId: number, targetSubgroupId: number) {
    editDraft((current) => ({
      ...current,
      [targetSubgroupId]: [...(current[targetSubgroupId] ?? []), studentId],
    }));
  }

  function moveStudent(studentId: number, fromSubgroupId: number, targetSubgroupId: number) {
    editDraft((current) => ({
      ...current,
      [fromSubgroupId]: (current[fromSubgroupId] ?? []).filter((id) => id !== studentId),
      [targetSubgroupId]: [...(current[targetSubgroupId] ?? []), studentId],
    }));
  }

  function removeFromSubgroup(studentId: number, subgroupId: number) {
    editDraft((current) => ({
      ...current,
      [subgroupId]: (current[subgroupId] ?? []).filter((id) => id !== studentId),
    }));
  }

  function keepOnlyIn(studentId: number, keepSubgroupId: number) {
    editDraft((current) => {
      const next: Membership = {};
      for (const [key, ids] of Object.entries(current)) {
        const subgroupId = Number(key);
        next[subgroupId] =
          subgroupId === keepSubgroupId ? ids : ids.filter((id) => id !== studentId);
      }
      return next;
    });
  }

  async function refreshSet() {
    if (state.setId == null) return;
    await Promise.all([
      qc.invalidateQueries({ queryKey: subgroupsKeys.groupSetRoot(state.setId) }),
      qc.invalidateQueries({ queryKey: [...subgroupsKeys.all, 'group-sets'] }),
    ]);
  }

  /**
   * В макете есть «Сохранить состав» (2015:12253), значит перемещения копятся
   * локально. Удаления идут первыми: иначе перенос упрётся в
   * STUDENT_ALREADY_IN_SET_SUBGROUP.
   */
  async function saveMembership() {
    if (draft == null || state.setId == null) return;
    const diff = diffMembership(serverMembership, draft);
    if (diff.removals.length === 0 && diff.additions.length === 0) return;

    setSaving(true);
    try {
      for (const removal of diff.removals) {
        await subgroupsApi.removeStudent(removal.subgroupId, removal.studentId);
      }
      for (const addition of diff.additions) {
        await subgroupsApi.addStudents(addition.subgroupId, addition.studentIds);
      }
      await refreshSet();
      toast.success('Состав сохранён');
    } catch (err) {
      if (isStudentNotInClass(err)) {
        toast.error('Кто-то из учеников уже не состоит в этом классе — состав перезагружен');
      } else if (isStudentAlreadyInSet(err)) {
        const conflict = parseStudentAlreadyInSetDetails((err as ApiError).details)[0];
        const student = conflict ? studentsById.get(conflict.studentId) : undefined;
        toast.error(
          conflict
            ? `${student ? studentShortName(student) : 'Ученик'} уже в «${conflict.subgroupName}» — состав перезагружен`
            : 'Ученик уже в другой группе набора — состав перезагружен',
        );
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить состав');
      }
      await refreshSet();
    } finally {
      setSaving(false);
    }
  }

  async function addSubgroup() {
    try {
      await createSubgroup.mutateAsync(`Группа ${subgroups.length + 1}`);
      toast.success('Подгруппа создана');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать подгруппу');
    }
  }

  async function renameSubgroup(subgroupId: number, name: string) {
    try {
      await patchSubgroup.mutateAsync({ subgroupId, name });
      toast.success('Название сохранено');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось переименовать');
    }
  }

  async function archiveGroupSet(confirmImpact: boolean) {
    if (state.setId == null) return;
    try {
      await archiveSet.mutateAsync({ setId: state.setId, confirmImpact });
      setSetInUseRows([]);
      setArchiveSetOpen(false);
      onStateChange({ classId: state.classId, setId: null });
      toast.success('Набор заархивирован');
    } catch (err) {
      if (isSubgroupsInUse(err)) {
        setArchiveSetOpen(false);
        setSetInUseRows(parseSubgroupsInUseDetails(err.details));
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Не удалось заархивировать набор');
    }
  }

  const setMeta = useMemo(() => {
    if (!selectedSet) return null;
    const subject =
      selectedSet.subjectId != null
        ? subjectsQuery.data?.content.find((s) => s.id === selectedSet.subjectId)?.name
        : null;
    const period =
      selectedSet.academicPeriodId != null
        ? periodsQuery.data?.find((p) => p.id === selectedSet.academicPeriodId)?.name
        : null;
    return [subject ?? 'Без предмета', period ?? 'Весь год'].join(' · ');
  }, [selectedSet, subjectsQuery.data, periodsQuery.data]);

  const noClassSelected = yearId == null || state.classId == null;
  const noSets =
    !noClassSelected && !setsQuery.isLoading && !setsQuery.isError && sets.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <ScheduleBreadcrumbs current="Подгруппы классов" />

      {/* Фильтры — тот же стиль, что панель расписания (2015:5831). */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Select
          value={yearId != null ? String(yearId) : ''}
          disabled={yearsLoading || years.length === 0}
          onChange={(e) =>
            guard(() => onYearChange(e.target.value ? Number(e.target.value) : null))
          }
          className={FILTER_CONTROL}
        >
          {years.length === 0 && <option value="">Учебный год</option>}
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </Select>
        <Select
          value={state.classId != null ? String(state.classId) : ''}
          disabled={yearId == null || classesQuery.isLoading || classes.length === 0}
          onChange={(e) =>
            guard(() =>
              onStateChange({
                classId: e.target.value ? Number(e.target.value) : null,
                setId: null,
              }),
            )
          }
          className={FILTER_CONTROL}
        >
          <option value="">Класс</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {classesQuery.isError && (
        <ErrorBlock
          message="Не удалось загрузить классы"
          onRetry={() => void classesQuery.refetch()}
        />
      )}

      {/* 2015:12050 — год и класс ещё не выбраны */}
      {noClassSelected && !classesQuery.isError && (
        <EmptyHero
          icon={<Users className="size-6 text-gray-400" />}
          title="Выберите учебный год и класс, чтобы начать"
        />
      )}

      {!noClassSelected && setsQuery.isLoading && <LoadingBlock label="Загрузка наборов…" />}
      {!noClassSelected && setsQuery.isError && (
        <ErrorBlock
          message="Не удалось загрузить наборы групп"
          onRetry={() => void setsQuery.refetch()}
        />
      )}

      {/* 2015:12078 — у класса нет подгрупп */}
      {noSets && (
        <EmptyHero
          icon={<UserPlus className="size-6 text-gray-400" />}
          title="У этого класса пока нет подгрупп"
          description="Разделите класс на несколько учебных групп для профильных занятий"
          action={
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => setCreateSetOpen(true)}
                className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Создать группы
              </button>
              <Link
                to="/lesson-schedule"
                className="text-13 font-semibold text-navy-700 underline hover:text-navy-800"
              >
                Продолжить со всем классом
              </Link>
            </div>
          }
        />
      )}

      {!noClassSelected && sets.length > 0 && (
        <div className="flex flex-wrap items-start gap-6">
          <ClassRosterCard
            students={roster}
            assignedIds={assignedIds}
            subgroups={subgroups}
            search={search}
            onSearchChange={setSearch}
            onSplit={() => guard(() => splitFlow.setAutoSplitOpen(true))}
            splitDisabled={state.setId == null || roster.length === 0}
            onAssign={assign}
            disabled={busy}
          />

          <div className="flex min-w-[320px] flex-1 flex-col gap-4">
            {/* 2015:12165 — переключатель наборов и создание нового */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {sets.map((groupSet) => (
                  <SetChip
                    key={groupSet.id}
                    groupSet={groupSet}
                    active={groupSet.id === state.setId}
                    onClick={() =>
                      guard(() => onStateChange({ classId: state.classId, setId: groupSet.id }))
                    }
                  />
                ))}
              </div>

              <div className="flex items-center gap-4">
                {selectedSet && (
                  <button
                    type="button"
                    onClick={() => guard(() => setArchiveSetOpen(true))}
                    disabled={busy}
                    className="text-13 font-semibold text-muted transition hover:text-red-500 disabled:opacity-40"
                  >
                    Архивировать набор
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => guard(() => setCreateSetOpen(true))}
                  className="text-sm font-semibold text-navy-700 underline transition hover:text-navy-800"
                >
                  + Новый набор групп
                </button>
              </div>
            </div>

            {setMeta && <p className="text-13 text-gray-400">{setMeta}</p>}

            {aggregateQuery.isLoading && <LoadingBlock label="Загрузка состава…" />}
            {aggregateQuery.isError && (
              <ErrorBlock
                message="Не удалось загрузить состав набора"
                onRetry={() => void aggregateQuery.refetch()}
              />
            )}

            <DuplicatesAlert
              duplicateIds={duplicates}
              studentsById={studentsById}
              membership={membership}
              subgroups={subgroups}
              disabled={busy}
              onKeepOnlyIn={keepOnlyIn}
            />

            {/* 2015:12167 — карточки групп */}
            {aggregate && (
              <div className="flex flex-wrap items-stretch gap-5">
                {subgroups.map((subgroup) => (
                  <SubgroupCard
                    key={subgroup.id}
                    subgroup={subgroup}
                    students={sortStudentsByName(
                      (membership[subgroup.id] ?? [])
                        .map((id) => studentsById.get(id))
                        .filter((s): s is SubgroupStudent => s != null),
                    )}
                    allSubgroups={subgroups}
                    duplicateIds={duplicateSet}
                    disabled={busy}
                    onRename={(name) => void renameSubgroup(subgroup.id, name)}
                    onArchive={() => guard(() => setArchiveSubgroupId(subgroup.id))}
                    onStudentAction={(studentId, action) => {
                      if (action.kind === 'move') {
                        moveStudent(studentId, subgroup.id, action.targetSubgroupId);
                      } else if (action.kind === 'remove') {
                        removeFromSubgroup(studentId, subgroup.id);
                      }
                    }}
                  />
                ))}
                <AddSubgroupCard onClick={() => guard(() => void addSubgroup())} disabled={busy} />
              </div>
            )}

            {/* 2015:12250 — «Отмена» / «Сохранить состав» */}
            {aggregate && (
              <div className="flex flex-wrap items-center justify-end gap-3 pt-6">
                {dirty && (
                  <p className="mr-auto text-13 text-amber-700">Есть несохранённые изменения</p>
                )}
                <button
                  type="button"
                  onClick={() => setDraft(serverMembership)}
                  disabled={!dirty || busy}
                  className="rounded-lg border border-line px-[18px] py-2.5 text-sm font-semibold text-muted transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => void saveMembership()}
                  disabled={!dirty || busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-[18px] py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-line disabled:text-gray-400"
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Сохранить состав
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {state.classId != null && yearId != null && (
        <CreateGroupSetModal
          open={createSetOpen}
          onClose={() => setCreateSetOpen(false)}
          yearId={yearId}
          classId={state.classId}
          onCreated={(setId) => onStateChange({ classId: state.classId, setId })}
        />
      )}

      <AutoSplitDialog
        open={splitFlow.autoSplitOpen}
        studentCount={roster.length}
        loading={splitFlow.splitPending}
        onClose={() => splitFlow.setAutoSplitOpen(false)}
        onConfirm={(names) => void splitFlow.runAutoSplit(names)}
      />

      <ScheduleConfirmModal
        open={splitFlow.notEmptyOpen}
        onClose={splitFlow.cancelNotEmpty}
        onConfirm={() => void splitFlow.archiveAllThenSplit(subgroups.map((s) => s.id))}
        title="В наборе уже есть группы"
        message="Автоделение работает только на пустом наборе. Заархивировать текущие подгруппы и открыть деление снова?"
        confirmLabel="Заархивировать и продолжить"
        danger
        loading={splitFlow.archivePending}
      />

      <ScheduleConfirmModal
        open={archiveSubgroupId != null}
        onClose={() => setArchiveSubgroupId(null)}
        onConfirm={() => {
          const id = archiveSubgroupId;
          setArchiveSubgroupId(null);
          if (id != null) void splitFlow.archiveOne(id);
        }}
        title="Архивировать подгруппу?"
        message="Ученики вернутся в список нераспределённых. Подгруппу можно будет создать заново."
        confirmLabel="Архивировать"
        danger
        loading={splitFlow.archivePending}
      />

      <ScheduleConfirmModal
        open={archiveSetOpen}
        onClose={() => setArchiveSetOpen(false)}
        onConfirm={() => void archiveGroupSet(false)}
        title="Архивировать набор?"
        message={
          selectedSet
            ? `Набор «${selectedSet.name}» и все его подгруппы уедут в архив.`
            : 'Набор и все его подгруппы уедут в архив.'
        }
        confirmLabel="Архивировать"
        danger
        loading={archiveSet.isPending}
      />

      <ScheduleConfirmModal
        open={guarded != null}
        onClose={() => setGuarded(null)}
        onConfirm={() => {
          const action = guarded;
          setGuarded(null);
          setDraft(serverMembership);
          action?.run();
        }}
        title="Состав не сохранён"
        message="Перемещения учеников ещё не отправлены на сервер. Если продолжить, они будут потеряны."
        confirmLabel="Продолжить"
        danger
      />

      <SubgroupsInUseDialog
        open={splitFlow.inUseRows.length > 0}
        rows={splitFlow.inUseRows}
        loading={splitFlow.archivePending}
        onCancel={splitFlow.cancelInUse}
        onConfirmImpact={() => void splitFlow.confirmArchiveImpact()}
      />

      <SubgroupsInUseDialog
        open={setInUseRows.length > 0}
        rows={setInUseRows}
        loading={archiveSet.isPending}
        title="Набор используется в расписании"
        onCancel={() => setSetInUseRows([])}
        onConfirmImpact={() => void archiveGroupSet(true)}
      />
    </div>
  );
}

/** Наборы в макетах не показаны — чип по образцу бейджей карточек групп. */
function SetChip({
  groupSet,
  active,
  onClick,
}: {
  groupSet: GroupSet;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'rounded-lg border px-3 py-1.5 text-13 font-semibold transition',
        active
          ? 'border-navy-700 bg-navy-700 text-white'
          : 'border-line bg-white text-muted hover:text-navy-700',
      )}
    >
      {groupSet.name}
    </button>
  );
}

/** Пустое состояние: круг 64 с рамкой, заголовок и подпись по центру. */
function EmptyHero({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 pt-20">
      <span className="flex size-16 items-center justify-center rounded-full border border-line bg-white">
        {icon}
      </span>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p
          className={cx(
            description ? 'text-base font-semibold text-ink' : 'text-15 font-medium text-muted',
          )}
        >
          {title}
        </p>
        {description && <p className="text-13 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
